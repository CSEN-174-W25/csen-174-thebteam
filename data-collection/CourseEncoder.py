import csv
import firebase_admin
from firebase_admin import credentials, firestore
import vertexai
from vertexai.language_models import TextEmbeddingModel, TextEmbeddingInput

def initialize_firebase():
    """
    Initializes Firebase Admin SDK and returns a Firestore client.
    """
    # Replace with the path to your Firebase service account key JSON file.
    service_account_path = "./bteam-6f36c-firebase-adminsdk-fbsvc-de6d814156.json"
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred)
    return firestore.client()

def initialize_vertexai():
    """
    Initializes Vertex AI and returns a pre-trained text embedding model.
    """
    # Replace with your Google Cloud project ID and desired location.
    project_id = "bteam-6f36c"
    location = "us-central1"  # Adjust if needed try us-west1 or us-west2 
    
    # Initialize Vertex AI with your project settings.
    vertexai.init(project=project_id, location=location)
    
    # Load the pre-trained text embedding model.
    embedding_model = TextEmbeddingModel.from_pretrained("text-embedding-004")
    return embedding_model

def process_csv_and_store(csv_path, db, embedding_model):
    """
    Processes each row in the CSV file, where each row is expected to be structured as:
    college, department, number, course, description, tag, [pre_reqs].
    
    Every entry must have college, department, number, course, description, and tag.
    The pre_reqs field is optional.
    
    For every row, we build a text prompt from the available data,
    generate an embedding using Vertex AI, and store the course details
    along with the embedding in Firestore.
    """
    # Set the task type and output dimensionality as used in the sample.
    task = "RETRIEVAL_DOCUMENT"
    dimensionality = 256
    docs = []
    
    with open(csv_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)
        # Skip the header row
        next(reader, None)
        for row in reader:
            # Ensure there are at least six columns (required fields).
            if len(row) < 6:
                print(f"Skipping incomplete row (missing required fields): {row}")
                continue

            # Extract required fields.
            college     = row[0].strip()
            department  = row[1].strip()
            number      = row[2].strip()
            course      = row[3].strip()
            description = row[4].strip()
            tag         = row[5].strip()
            # Pre_reqs is optional.
            pre_reqs    = row[6].strip() if len(row) > 6 else ""
            
            # Build the text prompt for the embedding using all fields.
            text_input = (
                f"{college} {department} {number} {course}. "
                f"{description}. Tag: {tag}"
            )
            
            try:
                # Create a TextEmbeddingInput for the text.
                inputs = [TextEmbeddingInput(text_input, task)]
                kwargs = dict(output_dimensionality=dimensionality)
                # Call get_embeddings() with the input wrapped in a list.
                embeddings = embedding_model.get_embeddings(inputs, **kwargs)
                embedding_vector = embeddings[0].values
            except Exception as e:
                print(f"Error processing row {row}: {e}")
                continue  # Skip this row on error
            
            # Prepare the data dictionary for Firestore.
            data = {
                "college": college,
                "department": department,
                "number": number,
                "course": course,
                "description": description,
                "tag": tag,
                "pre_reqs": pre_reqs,
                "embedding": embedding_vector,
            }
            
            # Create a composite document ID using college, department, and number.
            # Sanitize the doc_id to remove any forbidden characters such as '/'
            doc_id = f"{tag}-{number}".replace(" ", "_").replace("/", "_")
            # check for duplicates
            if doc_id in docs:
                # if tag is ECON, append the college
                if tag == "ECON":
                    doc_id = f"{tag}-{number}-{college}".replace(" ", "_").replace("/", "_")
                    docs.append(doc_id)
                elif tag == "":
                    doc_id = f"{college}-{number}-{course}".replace(" ", "_").replace("/", "_")
                    docs.append(doc_id)
                else:
                    print(f"Skipping duplicate course: {doc_id}")
                    continue
            else:
                docs.append(doc_id)
            
            # If doc_id is empty (i.e., all fields were missing), let Firestore generate an ID.
            if not doc_id.strip("_"):
                db.collection("course_embeddings_clean").add(data)
                print("Stored embedding with auto-generated document ID.")
            else:
                db.collection("course_embeddings_clean").document(doc_id).set(data)
                print(f"Stored embedding for course: {doc_id}")

def main():
    """
    Data Preprocessing:
    1. Remove duplicate courses (eg HIST-57)
    2. Some courses have the same number but different departments (ECON 170 in CAS and LSB)
    3. Some courses have the same number but are scholar variants BUSN 179 and BUSN 179S
    """
    # Initialize Firestore from Firebase.
    db = initialize_firebase()
    
    # Initialize Vertex AI embedding model.
    embedding_model = initialize_vertexai()
    
    # Specify the path to your CSV file containing course data.
    csv_path = "./data/courses.csv"
    
    # Process the CSV file and store embeddings in Firestore.
    process_csv_and_store(csv_path, db, embedding_model)

if __name__ == '__main__':
    main()