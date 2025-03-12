import os

def is_path_allowed(path, workspace_paths):
    """Check if the given path is within allowed workspace paths"""
    if not workspace_paths:
        return True  # If no workspace paths defined, allow all
        
    path = os.path.abspath(path)
    
    for workspace in workspace_paths:
        workspace = os.path.abspath(workspace)
        if path.startswith(workspace):
            return True
            
    return False
