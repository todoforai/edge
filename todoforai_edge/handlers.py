import os
import json
import asyncio
import logging
import difflib
from pathlib import Path
from .utils import async_request
from .messages import (
    edge_status_msg, block_message_result_msg, block_error_result_msg, 
    block_diff_result_msg, block_start_result_msg, block_done_result_msg,
    block_save_result_msg, task_action_update_msg, dir_list_response_msg,
    cd_response_msg, ctx_julia_result_msg, diff_file_result_msg
)
from .workspace_handler import handle_ctx_workspace_request
from .constants import Edge2Front as EF, Edge2Agent as EA
from .path_utils import is_path_allowed

logger = logging.getLogger("todo4ai-client")




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
        await client._send_response(dir_list_response_msg(todo_id, paths))
    except Exception as error:
        logger.error(f"Error listing directory: {str(error)}")
        await client._send_response(block_error_result_msg(request_id, todo_id, str(error)))


async def handle_todo_cd(payload, client):
    """Handle todo change directory request and update workspace list"""
    request_id = payload.get("requestId")
    edge_id = payload.get("edgeId")
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
        
        await client._send_response(cd_response_msg(edge_id, path, request_id, True))
    except Exception as error:
        logger.error(f"Error changing directory: {str(error)}")
        await client._send_response(cd_response_msg(edge_id, path, request_id, False))


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
        await client._send_response(block_error_result_msg(block_id, todo_id, error_msg))
        return
    
    # Send start message
    await client._send_response(block_start_result_msg(todo_id, block_id, "execute"))
    
    try:
        # Execute the shell command
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        # Send the response back
        await client._send_response(block_done_result_msg(todo_id, request_id, block_id, "execute"))
    except Exception as error:
        logger.error(f"Error executing command: {str(error)}")
        await client._send_response(block_error_result_msg(block_id, todo_id, str(error)))


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
            
        await client._send_response(block_save_result_msg(block_id, todo_id, "SUCCESS"))
            
    except Exception as error:
        logger.error(f"Error saving file: {str(error)}")
        await client._send_response(block_save_result_msg(block_id, todo_id, "ERROR"))


async def handle_block_refresh(payload, client):
    """Handle block refresh request"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId", "")
    data = payload.get("data", "")
    
    await client._send_response(block_message_result_msg(todo_id, block_id, "REFRESHING"))


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
        
        message = block_message_result_msg(todo_id, block_id, f"Processed key: {key}")
        message["payload"]["processed"] = True
        await client._send_response(message)
    except Exception as error:
        logger.error(f"Error processing keyboard event: {str(error)}")
        await client._send_response(block_error_result_msg(block_id, todo_id, str(error)))


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
        await client._send_response(block_message_result_msg(todo_id, block_id, f"Processed signal: {signal_type}"))
    except Exception as error:
        logger.error(f"Error processing signal: {str(error)}")
        await client._send_response(block_error_result_msg(block_id, todo_id, str(error)))


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
            await client._send_response(block_diff_result_msg(todo_id, block_id, "", content))
        else:
            # Read the original file content
            with open(filepath, 'r') as f:
                original_content = f.read()
            
            # Send the diff result using the new protocol structure
            await client._send_response(block_diff_result_msg(todo_id, block_id, original_content, content))
    except Exception as error:
        logger.error(f"Error generating diff: {str(error)}")
        await client._send_response(block_error_result_msg(block_id, todo_id, str(error)))


async def handle_task_action_new(payload, client):
    """Handle new task action request"""
    task_id = payload.get("taskId")
    edge_id = payload.get("edgeId")
    agent_id = payload.get("agentId")
    
    try:
        # This is a placeholder - implementation depends on specific requirements
        # Typically this would involve starting a new task or process
        logger.info(f"New task action received: {task_id} for agent {agent_id}")
        
        await client._send_response(task_action_update_msg(task_id, edge_id, "started"))
    except Exception as error:
        logger.error(f"Error starting task: {str(error)}")
        await client._send_response(task_action_update_msg(task_id, edge_id, "error", str(error)))


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
        await client._send_response(
            ctx_julia_result_msg(todo_id, request_id, ["example/file.jl"], ["# This is a placeholder Julia result"])
        )
    except Exception as error:
        logger.error(f"Error processing Julia request: {str(error)}")
        await client._send_response(ctx_julia_result_msg(todo_id, request_id, error=str(error)))


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
        await client._send_response(
            diff_file_result_msg(todo_id, request_id, original_content, modified_content)
        )
    except Exception as error:
        logger.error(f"Error generating file diff: {str(error)}")
        await client._send_response(diff_file_result_msg(todo_id, request_id, error=str(error)))

