import pandas as pd
from google.cloud import firestore
from google.cloud.firestore_v1.vector import Vector
import os

import firebase_admin
from firebase_admin import credentials

def add_doc_example():
    keyfile = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    print(keyfile)
    cred = credentials.Certificate(keyfile)
    firebase_admin.initialize_app(cred)

    firestore_client = firestore.Client()
    collection = firestore_client.collection("coffee-beans")
    doc = {
        "name": "Kahawa coffee beans",
        "description": "Information about the Kahawa coffee beans.",
        "embedding_field": Vector([0.18332680, 0.24160706, 0.3416704]),
    }

    collection.add(doc)

class CourseEncoder:
    def data_to_text(self):
        pass

    def encode(self):
        pass

    def add_doc(self):
        pass