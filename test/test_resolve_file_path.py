import os
import tempfile
from pathlib import Path
import pytest
from todoforai_edge.handlers import resolve_file_path, get_parent_directory_if_needed

def test_resolve_file_path_with_fallback():
    """Test resolve_file_path with fallback root paths"""
    
    # Create temporary directory structure
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create edge directory structure
        edge_dir = os.path.join(temp_dir, "edge")
        os.makedirs(edge_dir)
        
        # Create backend directory structure  
        backend_dir = os.path.join(temp_dir, "backend")
        backend_src_dir = os.path.join(backend_dir, "src", "api", "shared")
        os.makedirs(backend_src_dir)
        
        # Create the target file
        target_file = os.path.join(backend_src_dir, "channels.ts")
        with open(target_file, 'w') as f:
            f.write("// test file")
        
        # Test parameters
        path = "backend/src/api/shared/channels.ts"
        root_path = edge_dir
        fallback_root_paths = [backend_dir]
        
        # Call resolve_file_path
        result = resolve_file_path(path, root_path, fallback_root_paths)
        
        # The result should be the actual file path
        expected = target_file
        assert result == expected, f"Expected {expected}, got {result}"
        assert os.path.exists(result), f"Resolved path {result} should exist"

def test_get_parent_directory_if_needed():
    """Test get_parent_directory_if_needed function"""
    
    # Test case from the issue
    path = "backend/src/api/shared/channels.ts"
    root_path = "/home/six/repo/todoforai/edge"
    fallback_root_paths = ["/home/six/repo/todoforai/backend"]
    
    result = get_parent_directory_if_needed(path, root_path, fallback_root_paths)
    
    # Should return the parent of the backend workspace
    expected = "/home/six/repo/todoforai"
    assert result == expected, f"Expected {expected}, got {result}"

def test_resolve_file_path_real_scenario():
    """Test the actual scenario from the issue"""
    
    path = "backend/src/api/shared/channels.ts"
    root_path = "/home/six/repo/todoforai/edge"
    fallback_root_paths = ["/home/six/repo/todoforai/backend"]
    
    # This should work if the file exists
    result = resolve_file_path(path, root_path, fallback_root_paths)
    
    # The result should be the backend file path
    expected = "/home/six/repo/todoforai/backend/src/api/shared/channels.ts"
    assert result == expected, f"Expected {expected}, got {result}"

if __name__ == "__main__":
    test_resolve_file_path_with_fallback()
    test_get_parent_directory_if_needed()
    test_resolve_file_path_real_scenario()
    print("All tests passed!")