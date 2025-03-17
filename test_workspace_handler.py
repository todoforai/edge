import os
import tempfile
import shutil
import logging
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

# Import the function to test
from todoforai_edge.workspace_handler import get_filtered_files_and_folders

def create_test_workspace():
    """Create a temporary test workspace with various files and directories"""
    # Create a temporary directory
    temp_dir = tempfile.mkdtemp()
    print(f"Created temporary workspace at: {temp_dir}")
    
    # Create directory structure
    os.makedirs(os.path.join(temp_dir, "src"), exist_ok=True)
    os.makedirs(os.path.join(temp_dir, "node_modules"), exist_ok=True)
    os.makedirs(os.path.join(temp_dir, ".git"), exist_ok=True)
    os.makedirs(os.path.join(temp_dir, "build"), exist_ok=True)
    
    # Create test files
    with open(os.path.join(temp_dir, "src", "app.js"), "w") as f:
        f.write("console.log('Hello');")
    
    with open(os.path.join(temp_dir, "README.md"), "w") as f:
        f.write("# Test markdown")
    
    with open(os.path.join(temp_dir, "build", "output.bin"), "w") as f:
        f.write("binary data")
    
    with open(os.path.join(temp_dir, "node_modules", "package.json"), "w") as f:
        f.write("node_modules stuff")
    
    with open(os.path.join(temp_dir, ".git", "HEAD"), "w") as f:
        f.write("git stuff")
    
    # Create a gitignore file
    with open(os.path.join(temp_dir, ".gitignore"), "w") as f:
        f.write("*.log\n")
        f.write("secret.txt\n")
        f.write("!important.log\n")
    
    # Create some files that should be ignored/included
    with open(os.path.join(temp_dir, "app.log"), "w") as f:
        f.write("log data")
    
    with open(os.path.join(temp_dir, "important.log"), "w") as f:
        f.write("important log")
    
    with open(os.path.join(temp_dir, "secret.txt"), "w") as f:
        f.write("secret data")
    
    return temp_dir

def test_get_filtered_files_and_folders():
    """Test the get_filtered_files_and_folders function"""
    # Create test workspace
    workspace_path = create_test_workspace()
    
    try:
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
        
        # Verify results
        # 1. Check that node_modules and .git are in filtered directories
        filtered_dir_names = [os.path.basename(d) for d in filtered_dirs]
        assert "node_modules" in filtered_dir_names, "node_modules should be filtered"
        assert ".git" in filtered_dir_names, "git directory should be filtered"
        
        # 2. Check that app.log is filtered (by gitignore)
        filtered_file_names = [os.path.basename(f) for f in filtered_files]
        assert "app.log" in filtered_file_names, "app.log should be filtered by gitignore"
        
        # 3. Check that secret.txt is filtered (by gitignore)
        assert "secret.txt" in filtered_file_names, "secret.txt should be filtered by gitignore"
        
        # 4. Check that README.md is in project files
        project_file_names = [os.path.basename(f) for f in project_files]
        assert "README.md" in project_file_names, "README.md should be in project files"
        
        # 5. Check that important.log is in project files (negation pattern in gitignore)
        assert "important.log" in project_file_names, "important.log should be in project files (negation pattern)"
        
        print("\nAll tests passed!")
        
    finally:
        # Clean up
        shutil.rmtree(workspace_path)

if __name__ == "__main__":
    test_get_filtered_files_and_folders()
