import unittest
import pandas as pd
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.CourseEncoder import CourseEncoder

class TestCourseEncoder(unittest.TestCase):

    def setUp(self):
        self.scraper = CourseEncoder()

    def test_initialization(self):
        self.assertIsNotNone(self.scraper)
        self.assertIsInstance(self.scraper, CourseEncoder)

    def test_len(self):
        actual_length = len(self.scraper)
        self.assertIsInstance(actual_length, int)
        self.assertEqual(actual_length, 2530)

    def test_data_to_text(self):
        actual_text = self.scraper.data_to_text()
        self.assertIsInstance(actual_text, str)
        self.assertTrue(len(actual_text) > 0)

    def test_encode(self):
        actual_encoded = self.scraper.encode()
        self.assertIsInstance(actual_encoded, pd.DataFrame)
        self.assertTrue(len(actual_encoded) > 0)
    
    def test_add_doc(self):
        self.assertIsNotNone(self.scraper.add_doc())

if __name__ == '__main__':
    unittest.main()
