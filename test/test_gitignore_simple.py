import os
import logging
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

# Import the functions to test
from todoforai_edge.workspace_handler import (
    get_accumulated_ignore_patterns, 
    is_ignored_by_patterns, 
    GitIgnoreCache, 
    IGNORE_FILES
)

def is_file_ignored(folder_path, file_path):
    """Check if a specific file is ignored by gitignore patterns"""
    cache = GitIgnoreCache()
    patterns = get_accumulated_ignore_patterns(
        os.path.dirname(file_path), 
        folder_path, 
        IGNORE_FILES, 
        cache
    )
    return is_ignored_by_patterns(file_path, patterns)

def test_gitignore_simple():
    """Test specific file paths against gitignore patterns"""
    # Define the base folder path - adjust this to point to your frontend folder
    base_folder = "../frontend"  # Change this to the actual path
    
    # Test cases based on the Julia examples
    test_cases = [
        # (file_path, expected_result)
        (f"{base_folder}/src-tauri/target/release/bundle/appimage/build_appimage.sh", True),
        (f"{base_folder}/src-tauri/build_appimage.sh", False),
        (f"{base_folder}/src-tauri/.next", True),
        (f"{base_folder}/.next", True),
        (f"{base_folder}/.next/also", True),
        (f"{base_folder}/src-tauri/.pnp.js", True),
        (f"{base_folder}/src-tauri/.pnp.jss", False),
    ]
    
    print("\n=== Testing Specific File Paths ===")
    all_passed = True
    
    for file_path, expected_result in test_cases:
        # Make the path absolute for testing
        abs_file_path = os.path.abspath(file_path)
        abs_base_folder = os.path.abspath(base_folder)
        
        # Skip if the file doesn't exist (this is just a test of the pattern matching)
        if not os.path.exists(abs_base_folder):
            print(f"Warning: Base folder {abs_base_folder} doesn't exist. Using pattern matching only.")
        
        # Test the file against gitignore patterns
        actual_result = is_file_ignored(abs_base_folder, abs_file_path)
        
        # Check if the result matches the expected result
        result_mark = "✓" if actual_result == expected_result else "✗"
        status = "ignored" if actual_result else "included"
        expected = "ignored" if expected_result else "included"
        
        print(f"{result_mark} {os.path.relpath(abs_file_path, abs_base_folder)} is {status} (expected: {expected})")
        
        if actual_result != expected_result:
            all_passed = False
    
    if all_passed:
        print("\nAll tests passed!")
    else:
        print("\nSome tests failed!")

if __name__ == "__main__":
    test_gitignore_simple()