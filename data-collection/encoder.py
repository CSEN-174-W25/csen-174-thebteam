import csv
import firebase_admin
from firebase_admin import credentials, firestore
import vertexai
from vertexai.language_models import TextEmbeddingModel, TextEmbeddingInput
import time
import argparse
import logging
from tqdm import tqdm
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("embedding_creation.log"),
        logging.StreamHandler()
    ]
)

def initialize_firebase(service_account_path):
    """
    Initializes Firebase Admin SDK and returns a Firestore client.
    """
    try:
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        logging.info("Firebase initialized successfully")
        return db
    except Exception as e:
        logging.error(f"Failed to initialize Firebase: {e}")
        raise

def initialize_vertexai(project_id, location):
    """
    Initializes Vertex AI and returns a pre-trained text embedding model.
    """
    try:
        # Initialize Vertex AI with your project settings
        vertexai.init(project=project_id, location=location)
        
        # Load the pre-trained text embedding model
        embedding_model = TextEmbeddingModel.from_pretrained("text-embedding-004")
        logging.info("Vertex AI embedding model initialized successfully")
        return embedding_model
    except Exception as e:
        logging.error(f"Failed to initialize Vertex AI: {e}")
        raise

def create_rich_text_representation(course_data):
    """
    Creates a rich text representation of the course data for better embeddings.
    """
    # Extract fields with default empty strings for missing values
    college = course_data.get("college", "")
    department = course_data.get("department", "")
    number = course_data.get("number", "")
    course = course_data.get("course", "")
    description = course_data.get("description", "")
    tag = course_data.get("tag", "")
    pre_reqs = course_data.get("pre_reqs", "")
    
    # Create a rich text representation that includes all available information
    rich_text = f"""Course Name: {course}
        Department: {department}
        College: {college}
        Course Number: {number}
        Course Tag: {tag}
        Description: {description}
        Prerequisites: {pre_reqs}
        """
    # Add more contextual information to differentiate from the structured part
    summary = f"This is a {tag} {number} course titled '{course}' in the {department} department at {college}. "
    if description:
        summary += description + " "
    if pre_reqs:
        summary += f"Students should complete {pre_reqs} before enrolling in this course."
    result = rich_text + "\n" + summary
    return result

def generate_embedding(text_input, embedding_model, dimensionality=768, retries=3):
    """
    Generates embedding for a given text with retry logic.
    """
    task = "RETRIEVAL_DOCUMENT"
    for attempt in range(retries):
        try:
            inputs = [TextEmbeddingInput(text_input, task)]
            kwargs = dict(output_dimensionality=dimensionality)
            embeddings = embedding_model.get_embeddings(inputs, **kwargs)
            return embeddings[0].values
        except Exception as e:
            logging.warning(f"Attempt {attempt+1}/{retries} failed: {e}")
            if attempt == retries - 1:
                logging.error(f"Failed to generate embedding after {retries} attempts: {e}")
                raise
            time.sleep(2 ** attempt)  # Exponential backoff

def process_course(row, embedding_model, dimensionality, docs_set):
    """
    Process a single course row and return the document data and ID.
    """
    # Ensure there are at least six columns (required fields)
    if len(row) < 6:
        logging.warning(f"Skipping incomplete row (missing required fields): {row}")
        return None, None

    # Extract fields
    college = row[0].strip()
    department = row[1].strip()
    number = row[2].strip()
    course = row[3].strip()
    description = row[4].strip()
    tag = row[5].strip()
    pre_reqs = row[6].strip() if len(row) > 6 else ""
    
    # Create a course data dictionary
    course_data = {
        "college": college,
        "department": department,
        "number": number,
        "course": course,
        "description": description,
        "tag": tag,
        "pre_reqs": pre_reqs,
    }
    
    # Build rich text representation
    text_input = create_rich_text_representation(course_data)
    
    try:
        # Generate embedding
        embedding_vector = generate_embedding(text_input, embedding_model, dimensionality)
        
        # Add embedding to course data
        course_data["embedding"] = embedding_vector
        
        # Create document ID
        base_doc_id = f"{tag}-{number}".replace(" ", "_").replace("/", "_")
        doc_id = base_doc_id
        
        # Handle duplicate IDs
        if doc_id in docs_set:
            if tag == "ECON":
                doc_id = f"{tag}-{number}-{college}".replace(" ", "_").replace("/", "_")
            elif tag == "":
                doc_id = f"{college}-{number}-{course}".replace(" ", "_").replace("/", "_")
            else:
                doc_id = f"{tag}-{number}-{department}".replace(" ", "_").replace("/", "_")
            
            if doc_id in docs_set:
                # Add a unique timestamp suffix if still duplicate
                doc_id = f"{doc_id}-{int(time.time())}"
        
        docs_set.add(doc_id)
        return course_data, doc_id
    
    except Exception as e:
        logging.error(f"Error processing course {course}: {e}")
        return None, None

def batch_upload_to_firestore(db, batch_data):
    """
    Upload a batch of documents to Firestore using batch writes.
    """
    batch = db.batch()
    count = 0
    
    for doc_id, data in batch_data:
        if not doc_id.strip("_"):
            # Auto-generate ID if doc_id is empty
            ref = db.collection("course_embeddings_large").document()
        else:
            ref = db.collection("course_embeddings_large").document(doc_id)
        
        batch.set(ref, data)
        count += 1
    
    batch.commit()
    return count

def process_csv_and_store(csv_path, db, embedding_model, dimensionality=768, batch_size=25):
    """
    Process CSV file and store embeddings in Firestore with batching.
    """
    docs_set = set()
    current_batch = []
    total_processed = 0
    
    # First, load existing document IDs to avoid duplicates
    try:
        existing_docs = db.collection("course_embeddings_large").stream()
        for doc in existing_docs:
            docs_set.add(doc.id)
        logging.info(f"Loaded {len(docs_set)} existing document IDs")
    except Exception as e:
        logging.warning(f"Could not load existing documents: {e}")
    
    try:
        with open(csv_path, newline='', encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile)
            # Skip header
            next(reader, None)
            rows = list(reader)
            
            with tqdm(total=len(rows), desc="Processing courses") as pbar:
                for row in rows:
                    course_data, doc_id = process_course(row, embedding_model, dimensionality, docs_set)
                    
                    if course_data and doc_id:
                        current_batch.append((doc_id, course_data))
                    
                    # If batch is full, upload to Firestore
                    if len(current_batch) >= batch_size:
                        try:
                            uploaded = batch_upload_to_firestore(db, current_batch)
                            total_processed += uploaded
                            logging.info(f"Uploaded batch of {uploaded} documents. Total: {total_processed}")
                            current_batch = []
                        except Exception as e:
                            logging.error(f"Error uploading batch: {e}")
                    
                    pbar.update(1)
            
            # Upload any remaining documents
            if current_batch:
                try:
                    uploaded = batch_upload_to_firestore(db, current_batch)
                    total_processed += uploaded
                    logging.info(f"Uploaded final batch of {uploaded} documents. Total: {total_processed}")
                except Exception as e:
                    logging.error(f"Error uploading final batch: {e}")
    
    except Exception as e:
        logging.error(f"Error processing CSV file: {e}")
        raise
    
    return total_processed

def create_embedding_stats(db):
    """
    Create statistics about the embeddings for quality assessment.
    """
    logging.info("Generating embedding statistics...")
    stats = {"count": 0, "departments": {}, "colleges": {}}
    
    try:
        docs = db.collection("course_embeddings_large").stream()
        embeddings = []
        
        for doc in docs:
            data = doc.to_dict()
            embedding = data.get("embedding")
            if embedding:
                embeddings.append(np.array(embedding))
            
            # Count by department and college
            dept = data.get("department", "Unknown")
            college = data.get("college", "Unknown")
            
            if dept not in stats["departments"]:
                stats["departments"][dept] = 0
            stats["departments"][dept] += 1
            
            if college not in stats["colleges"]:
                stats["colleges"][college] = 0
            stats["colleges"][college] += 1
            
            stats["count"] += 1
        
        if embeddings:
            # Calculate embedding statistics if we have embeddings
            embeddings_array = np.array(embeddings)
            stats["embedding_dimension"] = embeddings_array.shape[1]
            stats["embedding_mean"] = float(np.mean(embeddings_array))
            stats["embedding_std"] = float(np.std(embeddings_array))
        
        # Save statistics to a JSON file
        with open("embedding_stats.json", "w") as f:
            json.dump(stats, f, indent=2)
        
        logging.info(f"Generated statistics for {stats['count']} embeddings")
        return stats
    
    except Exception as e:
        logging.error(f"Error generating embedding statistics: {e}")
        return {"error": str(e)}

def main():
    parser = argparse.ArgumentParser(description="Generate and store course embeddings")
    parser.add_argument("--csv", default="./data/courses.csv", help="Path to CSV file")
    parser.add_argument("--service-account", default="./bteam-6f36c-firebase-adminsdk-fbsvc-de6d814156.json", 
                        help="Path to Firebase service account file")
    parser.add_argument("--project-id", default="bteam-6f36c", help="Google Cloud project ID")
    parser.add_argument("--location", default="us-central1", help="Google Cloud location")
    parser.add_argument("--dimensionality", type=int, default=768, 
                        help="Embedding dimensionality (768 recommended for better quality)")
    parser.add_argument("--batch-size", type=int, default=25, help="Firestore batch size")
    parser.add_argument("--stats", action="store_true", help="Generate embedding statistics")
    
    args = parser.parse_args()
    
    try:
        # Initialize Firebase
        db = initialize_firebase(args.service_account)
        
        # Initialize Vertex AI
        embedding_model = initialize_vertexai(args.project_id, args.location)
        
        start_time = time.time()
        
        # Process CSV and store embeddings
        total_processed = process_csv_and_store(
            args.csv, db, embedding_model, 
            dimensionality=args.dimensionality,
            batch_size=args.batch_size
        )
        
        elapsed_time = time.time() - start_time
        logging.info(f"Processed {total_processed} courses in {elapsed_time:.2f} seconds")
        
        # Generate statistics if requested
        if args.stats or total_processed > 0:
            stats = create_embedding_stats(db)
            logging.info(f"Embedding statistics: {total_processed} courses, " 
                        f"{stats.get('embedding_dimension', 'unknown')} dimensions")
    
    except Exception as e:
        logging.error(f"Error in main function: {e}")

if __name__ == '__main__':
    main()