import pandas as pd

class DataHandler:
    def __init__(self, file_path):
        """Initialize the data handler with a file path."""
        self.file_path = file_path
        self.df = None  # Placeholder for DataFrame

    def load_data(self):
        """Reads a CSV file into a Pandas DataFrame."""
        self.df = pd.read_csv(self.file_path)
        return self.df

    def clean_data(self):
        """Handles missing values by filling them with default values."""
        if self.df is not None:
            self.df.fillna(0, inplace=True)  # Replace NaN with 0
        return self.df

    def save_data(self, output_path):
        """Saves the cleaned DataFrame to a new CSV file."""
        if self.df is not None:
            self.df.to_csv(output_path, index=False)

    def get_file_path(self):
        return self.file_path

def main():
    handler = DataHandler("data/courses.csv")
    df = handler.load_data()
    df = handler.clean_data()
    handler.save_data("data/cleaned_data.csv")

if __name__ == "__main__":
    main()