import os
import logging
from .messages import workspace_result_msg
from .path_utils import is_path_allowed

logger = logging.getLogger("todo4ai-client")

async def handle_ctx_workspace_request(payload, client):
    """Handle workspace context request"""
    user_id = payload.get("userId", "")
    agent_id = payload.get("agentId", "")
    root_path = payload.get("rootPath", ".")
    exclude_paths = payload.get("excludePaths", [])
    
    try:
        logger.info(f"Workspace context request received for path: {root_path}")
        
        # Check if path is allowed
        if not is_path_allowed(root_path, client.config.workspacepaths):
            raise PermissionError(f"Access to path '{root_path}' is not allowed")
        
        # Get all files in the workspace, excluding the specified paths
        file_chunks = await get_workspace_files(root_path, exclude_paths)
        
        # Send the response with file chunks
        await client._send_response(workspace_result_msg(user_id, agent_id, file_chunks))
        
    except Exception as error:
        logger.error(f"Error processing workspace request: {str(error)}")
        # Send empty file chunks with error
        await client._send_response(workspace_result_msg(user_id, agent_id, []))


async def get_workspace_files(root_path, exclude_paths):
    """Get all files in the workspace, excluding specified paths"""
    file_chunks = []
    
    # Convert exclude paths to absolute paths for easier comparison
    abs_exclude_paths = [os.path.abspath(p) for p in exclude_paths]
    
    # Walk through the directory tree
    for root, dirs, files in os.walk(root_path):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if os.path.abspath(os.path.join(root, d)) not in abs_exclude_paths]
        
        for file in files:
            file_path = os.path.join(root, file)
            
            # Skip excluded files
            if os.path.abspath(file_path) in abs_exclude_paths:
                continue
                
            # Skip binary files and large files
            if is_binary_file(file_path) or os.path.getsize(file_path) > 1024 * 1024:  # Skip files > 1MB
                continue
                
            try:
                # Read file content
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Create relative path from root
                rel_path = os.path.relpath(file_path, root_path)
                
                # Add to file chunks
                file_chunks.append({
                    "sources": rel_path,
                    "chunks": content
                })
                
            except Exception as e:
                logger.warning(f"Error reading file {file_path}: {str(e)}")
    
    return file_chunks


def is_binary_file(file_path):
    """Check if a file is binary"""
    try:
        # Check file extension first
        _, ext = os.path.splitext(file_path)
        if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', 
                          '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', 
                          '.so', '.pyc', '.class']:
            return True
            
        # Read a small chunk of the file
        with open(file_path, 'rb') as f:
            chunk = f.read(1024)
            
        # Check for null bytes which typically indicate binary content
        if b'\x00' in chunk:
            return True
            
        # Try to decode as text
        try:
            chunk.decode('utf-8')
            return False
        except UnicodeDecodeError:
            return True
            
    except Exception:
        # If any error occurs, consider it binary to be safe
        return True
