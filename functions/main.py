# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`
import numpy as np
from typing import Any
import logging

from firebase_functions import https_fn
from firebase_admin import firestore, initialize_app
import vertexai
from vertexai.language_models import TextEmbeddingModel, TextEmbeddingInput

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

def generate_response_prompt(query: str, relevant_docs):
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
    prompt = f"Based on the following course descriptions:\n\n{context}\n\nAnswer the query:\n{query}\n"
    logging.info("Response prompt generated.")
    return prompt

def call_gemini(prompt: str) -> str:
    """
    Calls the Vertex AI Gemini API using the GenAI client to generate chatbot content.
    """
    logging.info("Calling Gemini API with prompt: %s", prompt[:100])  # Log first 100 characters for brevity
    from google import genai
    from google.genai.types import HttpOptions

    try:
        client = genai.Client(http_options=HttpOptions(api_version="v1"), vertexai=vertexai, project=project_id, location=location)
        response = client.models.generate_content(
            model="gemini-2.0-flash-001",
            contents=prompt,
        )
        logging.info("Gemini API call succeeded.")
        return response.text
    except Exception as e:
        logging.error("Error calling Gemini API: %s", str(e))
        raise

@https_fn.on_call()
def rag(req: https_fn.CallableRequest) -> Any:
    """
    Cloud Function that implements RAG:
      1. Expects a JSON payload with a "query" field.
      2. Embeds the query and retrieves relevant course documents from Firestore.
      3. Generates a response prompt from the retrieved context.
      4. Sends the prompt to the Gemini API via the GenAI client.
      5. Returns the final chatbot response.
    """
    logging.info("rag function invoked.")
    try:
        query = req.data["query"]
        logging.info("Received query: %s", query)
    except KeyError:
        error_msg = 'The function must be called with a "query" field in the data.'
        logging.error(error_msg)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=error_msg
        )
    try:
        relevant_docs = retrieve_relevant_documents(query, top_k=5)
        response_prompt = generate_response_prompt(query, relevant_docs)
        chatbot_response = call_gemini(response_prompt)
        logging.info("Returning chatbot response.")
        return {"response": chatbot_response}
    except Exception as e:
        logging.error("Error in rag function: %s", str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNKNOWN,
            message="An error occurred while processing the request.",
            details=str(e)
        )