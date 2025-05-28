import os
import tempfile
import shutil
from pathlib import Path

from todoforai_edge.workspace_handler import (
    get_filtered_files_and_folders,
    is_ignored_by_patterns_in_file,
    gitignore_to_regex
)

def test_windows_path_separators():
    """Test that gitignore works correctly with Windows-style paths"""
    
    # Create a temporary directory
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Create test structure
        os.makedirs(os.path.join(temp_dir, "src", "components"))
        os.makedirs(os.path.join(temp_dir, "node_modules", "package"))
        
        # Create gitignore
        with open(os.path.join(temp_dir, ".gitignore"), "w") as f:
            f.write("node_modules/\n")
            f.write("*.log\n")
            f.write("build/\n")
        
        # Create test files
        test_files = [
            "src/app.js",
            "src/components/Button.js", 
            "node_modules/package/index.js",
            "app.log",
            "src/debug.log"
        ]
        
        for file_path in test_files:
            full_path = os.path.join(temp_dir, file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w") as f:
                f.write("test content")
        
        # Test the filtering
        project_files, filtered_files, filtered_dirs = get_filtered_files_and_folders(temp_dir)
        
        # Convert to relative paths for easier checking
        project_rel = [os.path.relpath(f, temp_dir) for f in project_files]
        filtered_rel = [os.path.relpath(f, temp_dir) for f in filtered_files]
        
        print("Project files:", project_rel)
        print("Filtered files:", filtered_rel)
        
        # Normalize path separators for comparison (convert to forward slashes)
        project_rel_norm = [p.replace(os.sep, '/') for p in project_rel]
        filtered_rel_norm = [p.replace(os.sep, '/') for p in filtered_rel]
        
        # Assertions
        assert "src/app.js" in project_rel_norm, "src/app.js should be in project files"
        assert "src/components/Button.js" in project_rel_norm, "src/components/Button.js should be in project files"
        assert "node_modules/package/index.js" in filtered_rel_norm, "node_modules files should be filtered"
        assert "app.log" in filtered_rel_norm, "*.log files should be filtered"
        assert "src/debug.log" in filtered_rel_norm, "*.log files should be filtered"
        
        print("✓ All Windows path separator tests passed!")
        
    finally:
        shutil.rmtree(temp_dir)

if __name__ == "__main__":
    test_windows_path_separators()