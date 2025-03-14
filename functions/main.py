import numpy as np
import logging
import datetime
import threading
import os
from typing import Any
from firebase_admin import firestore, initialize_app
from firebase_functions import https_fn
import vertexai
from vertexai.generative_models import GenerativeModel
from dotenv import load_dotenv

load_dotenv()

# Import AstraDB library
from langchain_astradb import AstraDBVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

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
logging.info("Vertex AI initialized.")

# Initialize AstraDB and OpenAI Embeddings
ASTRA_DB_API_ENDPOINT = os.getenv("ASTRA_DB_API_ENDPOINT")
ASTRA_DB_APPLICATION_TOKEN = os.getenv("ASTRA_DB_APPLICATION_TOKEN")
OPEN_AI_API_KEY = os.getenv("OPEN_AI_API_KEY")

# Initialize OpenAI Embeddings
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    api_key=OPEN_AI_API_KEY,
)

# Initialize AstraDB Vector Store
vector_store = AstraDBVectorStore(
    collection_name="courses",
    embedding=embeddings,
    api_endpoint=ASTRA_DB_API_ENDPOINT,
    token=ASTRA_DB_APPLICATION_TOKEN,
)

logging.info("AstraDB vector store initialized.")

def enhance_query_with_context(query: str, user_id: str) -> str:
    """
    Uses chat history context to enhance the query for better retrieval.
    """
    # Get the chat history
    chat_history_snapshot = db.collection("chat_histories").document(user_id).get()
    
    # If no chat history or only one message, return the original query
    if not chat_history_snapshot.exists:
        return query
        
    chat_data = chat_history_snapshot.to_dict()
    messages = chat_data.get("messages", [])
    
    # If there are fewer than 2 messages (not enough context), return original query
    if len(messages) < 2:
        return query
        
    # Get the last few messages for context
    recent_messages = messages[-min(5, len(messages)):]
    
    # Format as a conversation
    conversation = "\n".join([f"{msg['role']}: {msg['message']}" for msg in recent_messages])
    
    # Use Vertex AI to enhance the query
    try:
        model = GenerativeModel(
            model_name="gemini-1.5-flash-001",  # Using a smaller, faster model for this task
            generation_config={"temperature": 0.2, "max_output_tokens": 100}
        )
        
        enhancement_prompt = f"""Based on this conversation history and the user's latest query, create a search query that will find the most relevant course information.
                                The query should include key terms from both the conversation history and the latest query.
                                Only output the enhanced search query, nothing else.

                                Conversation history:
                                {conversation}

                                Latest query: {query}

                                Enhanced search query:"""

        response = model.generate_content([enhancement_prompt])
        enhanced_query = response.text.strip()
        
        logging.info(f"Enhanced query: '{enhanced_query}' (original: '{query}')")
        return enhanced_query
    except Exception as e:
        logging.error(f"Error enhancing query: {str(e)}")
        return query  # Fall back to original query if enhancement fails

def retrieve_relevant_documents(query: str, top_k: int = 5):
    """
    Uses AstraDB to retrieve the top_k most similar documents.
    """
    logging.info("Retrieving documents from AstraDB for query: %s", query)
    try:
        # Use AstraDB's similarity search
        relevant_docs = vector_store.similarity_search(query, k=top_k)
        logging.info("Retrieved %d documents from AstraDB.", len(relevant_docs))
        
        # Convert LangChain documents to a format compatible with your existing code
        formatted_docs = []
        for doc in relevant_docs:
            # Extract metadata
            metadata = doc.metadata
            # Create a tuple with a similarity score (we don't have actual scores from AstraDB's default search)
            # So we'll use a placeholder value of 1.0 for all docs
            formatted_docs.append((1.0, {
                'course': metadata.get('course_name', 'N/A'),
                'number': metadata.get('course_id', 'N/A').split()[-1] if metadata.get('course_id') else 'N/A',
                'department': metadata.get('department', 'N/A'),
                'description': doc.page_content,  # Using the page_content as description
                'tag': metadata.get('course_id', 'N/A').split()[0] if metadata.get('course_id') else 'N/A',
                'pre_reqs': metadata.get('pre_reqs', '')
            }))
        
        return formatted_docs
    except Exception as e:
        logging.error("Error retrieving documents from AstraDB: %s", str(e))
        raise

def format_chat_history(messages):
    """
    Formats chat history in a way that's more conducive to conversational flow.
    """
    if not messages:
        return ""
        
    # Only use the last 5-8 messages to keep context focused
    recent_messages = messages[-min(8, len(messages)):]
    
    # Format as a conversation with clear roles
    formatted_history = "\n\nPREVIOUS CONVERSATION:\n"
    
    for msg in recent_messages:
        role = "Student" if msg['role'] == "user" else "Advisor"
        formatted_history += f"{role}: {msg['message']}\n"
        
    return formatted_history

def generate_response_prompt(query: str, relevant_docs, user_id: str) -> str:
    """
    Generates a prompt by concatenating information from the retrieved documents.
    """
    logging.info("Generating response prompt.")

    # Get chat history
    chat_history_snapshot = db.collection("chat_histories").document(user_id).get()
    chat_history = ""
    if chat_history_snapshot.exists:
        chat_data = chat_history_snapshot.to_dict()
        messages = chat_data.get("messages", [])
        if messages:
            chat_history = format_chat_history(messages)

    # Start with any summary from chat history if available
    doc_ref = db.collection("chat_histories").document(user_id)
    doc_snapshot = doc_ref.get()

    context = ""
    if doc_snapshot.exists:
        data = doc_snapshot.to_dict()
        if "summary" in data:
            context += "CONVERSATION SUMMARY: " + data["summary"] + "\n\n"
    
    # Add relevant docs information
    context += "RELEVANT COURSE INFORMATION:\n\n"
    context += "\n\n".join(
        f"Course: {doc_item.get('tag', 'N/A')}-{doc_item.get('number', 'N/A')} {doc_item.get('course', 'N/A')}\n"
        f"Department: {doc_item.get('department', 'N/A')}\n"
        f"Description: {doc_item.get('description', '')}\n"
        f"Pre-requisites: {doc_item.get('pre_reqs', '')}"
        for score, doc_item in relevant_docs
    )

    # Add the chat history
    context += chat_history

    # Build the final prompt with the current query clearly marked
    prompt = f"{context}\n\nCURRENT QUERY: {query}\n\nRespond to the student's current query in a helpful, conversational manner."
    logging.info("Response prompt generated.")
    return prompt

def call_gemini(prompt: str) -> str:
    """
    Calls the Vertex AI Gemini API to generate chatbot content.
    """
    logging.info("Calling Gemini API with prompt: %s", prompt[:100])  # Log first 100 characters for brevity
    try:
        model = GenerativeModel(
            system_instruction=["""You are a friendly and helpful academic advisor chatbot for college students.

                                Your primary task is to help students find and understand relevant courses in a conversational, supportive manner.

                                IMPORTANT GUIDELINES:
                                1. Be conversational and personable - use a friendly, helpful tone as if you're having a real conversation.
                                2. Reference previous parts of the conversation naturally, like a human would.
                                3. Remember details the user has shared earlier and refer back to them when relevant.
                                4. Ask thoughtful follow-up questions to better understand the student's needs or interests.
                                5. When you don't know something, be honest and suggest what information might help you provide a better answer.
                                6. When referencing courses, use the format **course_tag-course_number course_name**, e.g., **CSEN-174 Software Engineering**.
                                7. Balance being informative with being concise - provide helpful details without overwhelming the student.
                                8. Use natural transitions between topics and acknowledge when the conversation changes direction.

                                Make sure your responses are grounded in the facts provided in the DOCUMENTS.
                                If the user has previously communicated with you, use the chat history to maintain continuity and context in the conversation."""],
            model_name="gemini-2.0-flash-001",
            generation_config={
                "temperature": 0.7,  # Slightly higher temperature for more conversational responses
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 1024,
            }
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
        "timestamp": datetime.datetime.now(datetime.timezone.utc)  # Use client-side timestamp
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
    threshold = 30  # Adjust this threshold as needed.
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
      2. Enhances the query using conversation context.
      3. Retrieves relevant course documents from AstraDB.
      4. Generates a response prompt from the retrieved context.
      5. Sends the prompt to the Gemini API.
      6. Returns the final chatbot response.
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

        # Enhance the query using conversation context
        enhanced_query = enhance_query_with_context(query, user_id)
        
        # Retrieve relevant documents and generate the response prompt.
        relevant_docs = retrieve_relevant_documents(enhanced_query, top_k=15)
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