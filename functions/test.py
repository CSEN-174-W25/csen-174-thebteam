import numpy as np
import logging
import datetime
import threading
from typing import Any
from firebase_admin import firestore, initialize_app
from firebase_functions import https_fn
import vertexai
from vertexai.language_models import TextEmbeddingModel, TextEmbeddingInput
from vertexai.generative_models import GenerativeModel

# Set up logging
logging.basicConfig(level=logging.INFO)

# Initialize Firebase Admin (using ADC; Cloud Functions provide credentials)
initialize_app()
db = firestore.client()
logging.info("Firebase initialized.")

# Initialize Vertex AI with your project settings.
project_id = "bteam-6f36c"
location = "us-central1"
vertexai.init(project=project_id, location=location)
embedding_model = TextEmbeddingModel.from_pretrained("text-embedding-005")
logging.info("Vertex AI embedding model initialized.")

def cosine_similarity(vec1, vec2):
    """Compute cosine similarity between two vectors."""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 == 0 or norm2 == 0:
        return 0
    return np.dot(vec1, vec2) / (norm1 * norm2)

def retrieve_relevant_documents(query: str, top_k: int = 5):
    """
    Embeds the query and retrieves the top_k most similar documents from Firestore.
    """
    logging.info("Embedding query: %s", query)
    task = "RETRIEVAL_DOCUMENT"
    dimensionality = 256
    query_input = TextEmbeddingInput(query, task)
    kwargs = {"output_dimensionality": dimensionality}
    embeddings = embedding_model.get_embeddings([query_input], **kwargs)
    query_embedding = embeddings[0].values
    logging.info("Query embedding generated.")

    docs = db.collection("course_embeddings").stream()
    scored_docs = []
    for doc in docs:
        data = doc.to_dict()
        stored_embedding = data.get("embedding")
        if stored_embedding:
            score = cosine_similarity(query_embedding, stored_embedding)
            scored_docs.append((score, data))
    scored_docs.sort(key=lambda x: x[0], reverse=True)
    logging.info("Retrieved %d documents from Firestore.", len(scored_docs))
    return scored_docs[:top_k]

def generate_response_prompt(query: str, relevant_docs, user_id: str) -> str:
    """
    Generates a prompt by concatenating information from the retrieved documents.
    """
    logging.info("Generating response prompt.")
    context = "\n\n".join(
        f"Course: {doc.get('course', 'N/A')}\n"
        f"Number: {doc.get('number', 'N/A')}\n"
        f"Department: {doc.get('department', 'N/A')}\n"
        f"Description: {doc.get('description', '')}\n"
        f"Tag: {doc.get('tag', '')}\n"
        f"Pre-requisites: {doc.get('pre_reqs', '')}"
        for score, doc in relevant_docs
    )
    # retrieve chat history from firebase
    chat_history = db.collection("chat_histories").document(user_id).get()
    if chat_history.exists:
        messages = chat_history.to_dict().get("messages", [])
        context += "\n\n".join(
            f"{msg['role']}: {msg['message']}" for msg in messages
        )
    prompt = f"DOCUMENTS: {context}\n\n QUERY: {query}\n "
    logging.info("Response prompt generated.")
    return prompt

def call_gemini(prompt: str) -> str:
    """
    Calls the Vertex AI Gemini API using the GenAI client to generate chatbot content.
    """
    logging.info("Calling Gemini API with prompt: %s", prompt[:100])  # Log first 100 characters for brevity
    # from google import genai
    # from google.genai.types import HttpOptions

    # try:
    #     client = genai.Client(http_options=HttpOptions(api_version="v1"), vertexai=vertexai, project=project_id, location=location, )
    #     response = client.models.generate_content(
    #         model="gemini-2.0-flash-001",
    #         contents=prompt,
    #     )
    #     logging.info("Gemini API call succeeded.")
    #     return response.text
    # except Exception as e:
    #     logging.error("Error calling Gemini API: %s", str(e))
    #     raise
    try:
        model=GenerativeModel(
            system_instruction=["""You are an academic advisor for college students.
                                Your task is to help college students find and understand relevant courses. 
                                Answer the QUERY in an informative and concise manner. 
                                Make sure your response is grounded in the facts provided in the DOCUMENTS.
                                When referencing courses, it should be in the format [tag-number course].
                                If the user has previously communicated with you, the chat history will be available for reference with your messages and the users' messages."""],
            model="gemini-2.0-flash-001",
        )
        response = model.generate_content([prompt])
        logging.info("Gemini API call succeeded.")
        return response.text
    except Exception as e:
        logging.error("Error calling Gemini API: %s", str(e))
        raise

def verify_token(request) -> dict:
    # Check if the callable request includes an auth attribute.
    auth_data = getattr(request, "auth", None)
    if not auth_data:
        logging.error("Missing authentication information in the callable request.")
        return None
    # Use attribute access to get the UID.
    logging.info("Token verified for UID: %s", auth_data.uid)
    # Return a dict for consistency in the rest of your code.
    return {"uid": auth_data.uid}

def update_chat_history(user_id: str, role: str, message: str):
    """
    Appends a message (with a role and content) to the user's chat history in Firestore.
    """
    doc_ref = db.collection("chat_histories").document(user_id)
    doc = doc_ref.get()
    if doc.exists:
        chat_data = doc.to_dict()
        messages = chat_data.get("messages", [])
    else:
        messages = []
    messages.append({
        "role": role,
        "message": message,
        "timestamp": datetime.timezone.utc.now() # Use client-side timestamp
    })
    doc_ref.set({"messages": messages}, merge=True)
    logging.info("Updated chat history for user %s with a %s message.", user_id, role)

def summarize_chat_history(user_id: str):
    """
    Summarizes the chat history for the user if it exceeds a certain threshold.
    This function should ideally run asynchronously.
    """
    doc_ref = db.collection("chat_histories").document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        return
    chat_data = doc.to_dict()
    messages = chat_data.get("messages", [])
    threshold = 20  # Adjust this threshold as needed.
    if len(messages) < threshold:
        return  # No need to summarize yet.

    # Prepare conversation text for summarization.
    conversation = "\n".join(
        [f"{msg['role']}: {msg['message']}" for msg in messages]
    )
    summary_prompt = f"Summarize the following conversation in a concise manner:\n\n{conversation}\n\nSummary:"
    try:
        summary = call_gemini(summary_prompt)
        # Optionally, store the summary and reset the messages (or archive them).
        doc_ref.set({"summary": summary, "messages": []}, merge=True)
        logging.info("Chat history for user %s summarized.", user_id)
    except Exception as e:
        logging.error("Error summarizing chat history for user %s: %s", user_id, str(e))

def schedule_summary(user_id: str):
    """
    Spawns a background thread to summarize the chat history.
    In production, consider using Cloud Tasks or Pub/Sub for asynchronous processing.
    """
    try:
        summarize_chat_history(user_id)
    except Exception as e:
        logging.error("Error in scheduled summary for user %s: %s", user_id, str(e))

@https_fn.on_call()
def rag(request: https_fn.CallableRequest) -> Any:
    """
    Cloud Function that implements RAG:
      1. Expects a JSON payload with a "query" field.
      2. Embeds the query and retrieves relevant course documents from Firestore.
      3. Generates a response prompt from the retrieved context.
      4. Sends the prompt to the Gemini API via the GenAI client.
      5. Returns the final chatbot response.
    """
    decoded_token = verify_token(request)
    if not decoded_token:
        return {"error": "Unauthorized"}
    
    user_id = decoded_token["uid"]
    logging.info("Authenticated user ID: %s", user_id)

    try:
        request_json = request.data
        query = request_json["query"]
        logging.info("Received query: %s", query)
    except (KeyError, TypeError):
        error_msg = 'The request must include a "query" field in the JSON payload.'
        logging.error(error_msg)
        return {"error": error_msg}

    try:
        # Save the user's query to chat history.
        update_chat_history(user_id, "user", query)

        # Retrieve relevant documents and generate the response prompt.
        relevant_docs = retrieve_relevant_documents(query, top_k=5)
        response_prompt = generate_response_prompt(query, relevant_docs, user_id)
        chatbot_response = call_gemini(response_prompt)

        # Save the Gemini response to chat history.
        update_chat_history(user_id, "bot", chatbot_response)

        # Schedule asynchronous summarization if needed.
        threading.Thread(target=schedule_summary, args=(user_id,)).start()

        logging.info("Returning chatbot response for user %s.", user_id)
        return {"response": chatbot_response}
    except Exception as e:
        logging.error("Error in processing request for user %s: %s", user_id, str(e))
        return {
            "error": "An error occurred while processing the request.",
            "details": str(e)
        }