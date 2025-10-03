import pandas as pd

def extract_columns(file_path):
    df = pd.read_excel(file_path)
    columns = df.columns[:5].tolist()
    data = df[columns].values.tolist()
    return data #return a listf of list where each list is a line from the spreadsheet

# Example usage
file_path = "C:\\Users\guipar\OneDrive - Piab\Documents\Test.xlsx"
extracted_data = extract_columns(file_path)
print(extracted_data)