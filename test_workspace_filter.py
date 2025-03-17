import sys
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

# Add the parent directory to sys.path to import the module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import the function to test
from todoforai_edge.workspace_handler import get_filtered_files_and_folders

def main():
    # Path to test
    workspace_path = "./test_workspace"
    
    # Get filtered files and folders
    project_files, filtered_files, filtered_dirs = get_filtered_files_and_folders(workspace_path)
    
    print("\n=== Project Files ===")
    for file in sorted(project_files):
        print(f"- {os.path.relpath(file, workspace_path)}")
    
    print("\n=== Filtered Files ===")
    for file in sorted(filtered_files):
        print(f"- {os.path.relpath(file, workspace_path)}")
    
    print("\n=== Filtered Directories ===")
    for directory in sorted(filtered_dirs):
        print(f"- {os.path.relpath(directory, workspace_path)}")

if __name__ == "__main__":
    main()
