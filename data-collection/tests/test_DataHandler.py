import unittest
import pandas as pd
from io import StringIO
from src.DataHandler import DataHandler 

class TestDataHandler(unittest.TestCase):

    def setUp(self):
        """Set up mock CSV data for testing."""
        self.mock_csv = StringIO("""Name,Age,Salary
        Alice,25,50000
        Bob,30,
        Charlie,35,70000""")  # Bob has a missing Salary (NaN)

        self.handler = DataHandler("mock_file.csv")  # Mock file path

    def test_initialization(self):
        """Test if the DataHandler object is initialized properly."""
        self.assertEqual(self.handler.file_path, "mock_file.csv")
        self.assertEqual(self.handler.df, None)

    def test_load_data(self):
        """Test if DataFrame is correctly loaded from CSV."""
        self.handler.df = pd.read_csv(self.mock_csv)  # Simulate loading data
        self.assertEqual(self.handler.df.shape, (3, 3))  # 3 rows, 3 columns

    def test_clean_data(self):
        """Test if missing values are replaced with 0."""
        self.handler.df = pd.read_csv(self.mock_csv)
        self.handler.clean_data()
        self.assertEqual(self.handler.df.iloc[1, 2], 0)

    def test_get_file_path(self):
        """Test if get_file_path() returns the correct file path."""
        self.assertEqual(self.handler.get_file_path(), "mock_file.csv")

    def test_save_data(self):
        """Test if save_data() properly saves the file."""
        self.handler.save_data("mock_file.csv") 

if __name__ == "__main__":
    unittest.main()