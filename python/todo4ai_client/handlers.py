import os
import json
import asyncio
import logging
import difflib
from pathlib import Path
from .utils import async_request
from .messages import (
    project_dir_result_msg, block_error_msg, block_start_msg, block_message_msg,
    block_save_result_msg, block_diff_result_msg, task_action_result_msg, ctx_result_msg,
    block_message_result_msg, block_error_result_msg, block_diff_result_msg_v2
)

logger = logging.getLogger("todo4ai-client")

# Helper function to check if path is within allowed workspace paths
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


# Handler functions
async def handle_todo_dir_list(payload, client):
    """Handle todo directory listing request"""
    request_id = payload.get("requestId")
    path = payload.get("path", ".")
    todo_id = payload.get("todoId", "")
    
    try:
        # Check if path is allowed
        if not is_path_allowed(path, client.config.workspacepaths):
            raise PermissionError(f"Access to path '{path}' is not allowed")
            
        items = []
        paths = []
        for item in Path(path).iterdir():
            item_type = "directory" if item.is_dir() else "file"
            items.append({"name": item.name, "type": item_type})
            paths.append(str(item))
        
        # Use the new protocol structure
        await client._send_response(EF.EDGE_DIR_LIST_RESPONSE, {
            "todoId": todo_id,
            "paths": paths
        })
    except Exception as error:
        logger.error(f"Error listing directory: {str(error)}")
        await client._send_response(EF.BLOCK_ERROR_RESULT, 
            block_error_result_msg(request_id, todo_id, str(error)))

async def handle_todo_cd(payload, client):
    """Handle todo change directory request and update workspace list"""
    request_id = payload.get("requestId")
    todo_id = payload.get("todoId")
    path = payload.get("path", ".")
    
    try:
        # Validate that the path exists and is a directory
        dir_path = Path(path)
        if not dir_path.exists() or not dir_path.is_dir():
            raise ValueError(f"Path does not exist or is not a directory: {path}")
        
        # Change the current working directory
        os.chdir(path)
        
        # Update workspace paths if this is a new path
        abs_path = os.path.abspath(path)
        if hasattr(client, 'config') and hasattr(client.config, 'workspacepaths'):
            if abs_path not in client.config.workspacepaths:
                client.config.workspacepaths.append(abs_path)
                
                # Update the edge configuration on the server if we have an edge_id
                if client.edge_id:
                    response = await async_request(
                        client,
                        'patch',
                        f"/api/v1/edges/{client.edge_id}",
                        {"workspacepaths": client.config.workspacepaths}
                    )
                    
                    if response:
                        logger.info(f"Updated workspace paths with: {abs_path}")
                    else:
                        logger.error(f"Failed to update workspace paths")
        
        await client._send_response(EF.EDGE_CD_RESULT, {
            "todoId": todo_id,
            "path": path,
            "success": True
        })
    except Exception as error:
        logger.error(f"Error changing directory: {str(error)}")
        await client._send_response(EF.EDGE_CD_RESULT, {
            "todoId": todo_id,
            "error": str(error),
            "success": False
        })

async def handle_block_execute(payload, client):
    """Handle shell script execution request"""
    block_id = payload.get("blockId")
    request_id = payload.get("requestId")
    todo_id = payload.get("todoId", "")
    command = payload.get("command", "")
    
    # Check if shell is enabled
    if not client.config.is_shell_enabled:
        error_msg = "Shell execution is not enabled for this edge"
        logger.warning(error_msg)
        await client._send_response(EF.BLOCK_ERROR_RESULT, 
            block_error_result_msg(block_id, todo_id, error_msg))
        return
    
    # Send start message
    await client._send_response(EF.BLOCK_START_RESULT, {
        "todoId": todo_id,
        "blockId": block_id,
        "mode": "execute"
    })
    
    try:
        # Execute the shell command
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        # Send the response back
        await client._send_response(EF.BLOCK_DONE_RESULT, {
            "todoId": todo_id,
            "messageId": request_id,
            "blockId": block_id,
            "mode": "execute",
            "stdout": stdout.decode(),
            "stderr": stderr.decode(),
            "exitCode": process.returncode,
            "success": process.returncode == 0
        })
    except Exception as error:
        logger.error(f"Error executing command: {str(error)}")
        await client._send_response(EF.BLOCK_ERROR_RESULT, 
            block_error_result_msg(block_id, todo_id, str(error)))

async def handle_block_save(payload, client):
    """Handle file save request - simple implementation"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId")
    filepath = payload.get("filepath")
    content = payload.get("content")
    
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Write content to file
        with open(filepath, 'w') as f:
            f.write(content)
            
        await client._send_response(EF.BLOCK_SAVE_RESULT, {
            "blockId": block_id,
            "todoId": todo_id,
            "result": "SUCCESS"  # Using enum value from CreateFileResult
        })
            
    except Exception as error:
        logger.error(f"Error saving file: {str(error)}")
        await client._send_response(EF.BLOCK_SAVE_RESULT, {
            "blockId": block_id,
            "todoId": todo_id,
            "result": "ERROR",
            "error": str(error)
        })

async def handle_block_refresh(payload, client):
    """Handle block refresh request"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId", "")
    data = payload.get("data", "")
    
    await client._send_response(EF.BLOCK_MESSAGE_RESULT, 
        block_message_result_msg(todo_id, block_id, "REFRESHING"))

async def handle_block_keyboard(payload, client):
    """Handle keyboard events"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId", "")
    data = payload.get("data", "")
    
    try:
        # Parse the data as JSON to get key information
        key_data = json.loads(data)
        key_code = key_data.get("keyCode")
        key = key_data.get("key")
        
        logger.info(f"Keyboard event received: {key} ({key_code})")
        
        await client._send_response(EF.BLOCK_MESSAGE_RESULT, {
            "todoId": todo_id,
            "blockId": block_id,
            "content": f"Processed key: {key}",
            "processed": True
        })
    except Exception as error:
        logger.error(f"Error processing keyboard event: {str(error)}")
        await client._send_response(EF.BLOCK_ERROR_RESULT, 
            block_error_result_msg(block_id, todo_id, str(error)))

async def handle_block_signal(payload, client):
    """Handle signal events (like SIGINT, SIGTERM)"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId", "")
    data = payload.get("data", "")
    
    try:
        # Parse the data as JSON to get signal information
        signal_data = json.loads(data)
        signal_type = signal_data.get("signal")
        
        logger.info(f"Signal received: {signal_type} for block {block_id}")
        
        # This is a placeholder - implementation depends on specific requirements
        await client._send_response(EF.BLOCK_SIGNAL_RESULT, 
            block_message_result_msg(todo_id, block_id, f"Processed signal: {signal_type}"))
    except Exception as error:
        logger.error(f"Error processing signal: {str(error)}")
        await client._send_response(EF.BLOCK_ERROR_RESULT, 
            block_error_result_msg(block_id, todo_id, str(error)))

async def handle_block_diff(payload, client):
    """Handle diff requests"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId", "")
    filepath = payload.get("filepath", "")
    content = payload.get("content", "")
    
    try:
        # Check if the file exists
        file_path = Path(filepath)
        if not file_path.exists():
            # If file doesn't exist, just return the new content as the diff
            await client._send_response(EF.BLOCK_DIFF_RESULT, 
                block_diff_result_msg_v2(todo_id, block_id, "", content))
        else:
            # Read the original file content
            with open(filepath, 'r') as f:
                original_content = f.read()
            
            # Send the diff result using the new protocol structure
            await client._send_response(EF.BLOCK_DIFF_RESULT, 
                block_diff_result_msg_v2(todo_id, block_id, original_content, content))
    except Exception as error:
        logger.error(f"Error generating diff: {str(error)}")
        await client._send_response(EF.BLOCK_ERROR_RESULT, 
            block_error_result_msg(block_id, todo_id, str(error)))

async def handle_task_action_new(payload, client):
    """Handle new task action request"""
    task_id = payload.get("taskId")
    edge_id = payload.get("edgeId")
    agent_id = payload.get("agentId")
    todo_id = payload.get("todoId")
    
    try:
        # This is a placeholder - implementation depends on specific requirements
        # Typically this would involve starting a new task or process
        logger.info(f"New task action received: {task_id} for agent {agent_id}")
        
        await client._send_response(EF.TASK_ACTION_UPDATE, {
            "taskId": task_id,
            "edgeId": edge_id,
            "status": "started"
        })
    except Exception as error:
        logger.error(f"Error starting task: {str(error)}")
        await client._send_response(EF.TASK_ACTION_UPDATE, {
            "taskId": task_id,
            "edgeId": edge_id,
            "status": "error",
            "error": str(error)
        })

async def handle_ctx_julia_request(payload, client):
    """Handle Julia context request"""
    request_id = payload.get("requestId")
    query = payload.get("query", "")
    todo_id = payload.get("todoId", "")
    
    try:
        # This is a placeholder - implementation depends on specific requirements
        # Typically this would involve executing a Julia query or search
        logger.info(f"Julia context request received: {query}")
        
        # Example implementation - could be replaced with actual Julia integration
        result = {
            "todoId": todo_id,
            "messageId": request_id,
            "filepaths": ["example/file.jl"],
            "contents": ["# This is a placeholder Julia result"]
        }
        
        await client._send_response(EA.CTX_JULIA_RESULT, result)
    except Exception as error:
        logger.error(f"Error processing Julia request: {str(error)}")
        await client._send_response(EA.CTX_JULIA_RESULT, {
            "todoId": todo_id,
            "messageId": request_id,
            "error": str(error)
        })

async def handle_ctx_workspace_request(payload, client):
    """Handle workspace context request"""
    request_id = payload.get("requestId")
    query = payload.get("query", "")
    todo_id = payload.get("todoId", "")
    
    try:
        # This is a placeholder - implementation depends on specific requirements
        # Typically this would involve searching the workspace
        logger.info(f"Workspace context request received: {query}")
        
        # Example implementation - could be replaced with actual workspace search
        result = {
            "todoId": todo_id,
            "messageId": request_id,
            "content": "This is a placeholder workspace search result"
        }
        
        await client._send_response(EA.CTX_WORKSPACE_RESULT, result)
    except Exception as error:
        logger.error(f"Error processing workspace request: {str(error)}")
        await client._send_response(EA.CTX_WORKSPACE_RESULT, {
            "todoId": todo_id,
            "messageId": request_id,
            "error": str(error)
        })

async def handle_diff_file_request(payload, client):
    """Handle file diff request"""
    request_id = payload.get("requestId")
    original_path = payload.get("originalPath", "")
    modified_path = payload.get("modifiedPath", "")
    todo_id = payload.get("todoId", "")
    
    try:
        # Check if both files exist
        if not Path(original_path).exists():
            raise FileNotFoundError(f"Original file not found: {original_path}")
        if not Path(modified_path).exists():
            raise FileNotFoundError(f"Modified file not found: {modified_path}")
        
        # Read file contents
        with open(original_path, 'r') as f:
            original_content = f.read()
        with open(modified_path, 'r') as f:
            modified_content = f.read()
        
        # Send the result using the new protocol structure
        await client._send_response(EF.DIFF_FILE_RESPONSE, {
            "todoId": todo_id,
            "messageId": request_id,
            "original_content": original_content,
            "modified_content": modified_content
        })
    except Exception as error:
        logger.error(f"Error generating file diff: {str(error)}")
        await client._send_response(EF.DIFF_FILE_RESPONSE, {
            "todoId": todo_id,
            "messageId": request_id,
            "error": str(error)
        })
