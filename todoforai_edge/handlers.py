import os
import json
import asyncio
import logging
import difflib
import traceback
from pathlib import Path
from .utils import async_request
from .messages import (
    edge_status_msg, block_message_result_msg, block_error_result_msg, 
    block_diff_result_msg, block_start_result_msg, block_done_result_msg,
    block_save_result_msg, task_action_update_msg, dir_list_response_msg,
    cd_response_msg, ctx_julia_result_msg, diff_file_result_msg,
    file_chunk_result_msg
)
from .workspace_handler import handle_ctx_workspace_request
from .constants import Edge2Front as EF, Edge2Agent as EA
from .path_utils import is_path_allowed
from .shell_handler import ShellProcess

logger = logging.getLogger("todo4ai-client")


# Handler functions for external use
async def handle_block_execute(payload, client):
    """Handle code execution request"""
    block_id = payload.get("blockId")
    message_id = payload.get("messageId", "")
    content = payload.get("content", "")
    todo_id = payload.get("todoId", "")
    print("handle_block_execute", payload)
    
    # The content is already the shell script
    code = content
    
    # Send start message
    await client._send_response(block_start_result_msg(todo_id, block_id, "execute", message_id))
    
    try:
        # Create a ShellProcess instance
        shell = ShellProcess()
        
        # Execute the code block
        await shell.execute_block(block_id, code, client, todo_id, message_id)
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error executing command: {str(error)}\nStacktrace:\n{stack_trace}")
        await client._send_response(block_error_result_msg(block_id, todo_id, f"{str(error)}\n\nStacktrace:\n{stack_trace}"))


async def handle_block_keyboard(payload, client):
    """Handle input to a running block."""
    block_id = payload.get("block_id", "")
    input_text = payload.get("content", "")
    
    shell = ShellProcess()
    success = await shell.send_input(block_id, input_text)
    
    return {"success": success}


async def handle_block_signal(payload, client):
    """Handle block interruption request."""
    todo_id = payload.get("todo_id", "")
    request_id = payload.get("request_id", "")
    block_id = payload.get("block_id", "")
    
    shell = ShellProcess()
    shell.interrupt_block(block_id)
    
    await client._send_response(block_message_result_msg(
        todo_id, block_id, "Process interrupted", request_id
    ))


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
        stack_trace = traceback.format_exc()
        logger.error(f"Error listing directory: {str(error)}\nStacktrace:\n{stack_trace}")
        await client._send_response(block_error_result_msg(request_id, todo_id, f"{str(error)}\n\nStacktrace:\n{stack_trace}"))


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
        stack_trace = traceback.format_exc()
        logger.error(f"Error changing directory: {str(error)}\nStacktrace:\n{stack_trace}")
        await client._send_response(cd_response_msg(edge_id, path, request_id, False, f"{str(error)}\n\nStacktrace:\n{stack_trace}"))


        


async def handle_block_save(payload, client):
    """Handle file save request - simple implementation"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId")
    filepath = payload.get("filepath")
    content = payload.get("content")
    
    try:
        # Only create directory if filepath has a directory component
        dirname = os.path.dirname(filepath)
        if dirname:  # Check if dirname is not empty
            os.makedirs(dirname, exist_ok=True)
        
        # Write content to file
        with open(filepath, 'w') as f:
            f.write(content)
            
        await client._send_response(block_save_result_msg(block_id, todo_id, "SUCCESS"))
            
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error saving file: {str(error)}\nStacktrace:\n{stack_trace}")
        await client._send_response(block_save_result_msg(block_id, todo_id, f"ERROR: {str(error)}\n\nStacktrace:\n{stack_trace}"))


async def handle_block_refresh(payload, client):
    """Handle block refresh request"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId", "")
    data = payload.get("data", "")
    
    await client._send_response(block_message_result_msg(todo_id, block_id, "REFRESHING"))


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
        stack_trace = traceback.format_exc()
        logger.error(f"Error generating diff: {str(error)}\nStacktrace:\n{stack_trace}")
        await client._send_response(block_error_result_msg(block_id, todo_id, f"{str(error)}\n\nStacktrace:\n{stack_trace}"))


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
        stack_trace = traceback.format_exc()
        logger.error(f"Error processing Julia request: {str(error)}\nStacktrace:\n{stack_trace}")
        await client._send_response(ctx_julia_result_msg(todo_id, request_id, error=f"{str(error)}\n\nStacktrace:\n{stack_trace}"))


async def handle_diff_file_request(payload, client):
    """Handle file diff request"""
    agent_id = payload.get("agentId")
    request_id = payload.get("requestId")
    filepath = payload.get("filepath", "")
    todo_id = payload.get("todoId", "")
    block_id = payload.get("blockId", "")
    print("handle_diff_file_request", payload)
    try:
        # Check if file exists
        if not Path(filepath).exists():
            raise FileNotFoundError(f"File not found: {filepath}")
        
        print("handle_diff_file_reques2t")
        # Read file content
        with open(filepath, 'r') as f:
            original_content = f.read()
        print("handle_diff_file_reques212t")
        
        # Send the result using the protocol structure
        await client._send_response(
            diff_file_result_msg(request_id, agent_id, todo_id, block_id, filepath, original_content)
        )
        print("SUCCESSSt")
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error generating file diff: {str(error)}\nStacktrace:\n{stack_trace}")
        await client._send_response(diff_file_result_msg(agent_id, todo_id, block_id, filepath, error=f"{str(error)}\n\nStacktrace:\n{stack_trace}"))

async def handle_file_chunk_request(payload, client):
    """Handle file chunk request - reads a file and returns its content"""
    agent_id = payload.get("agentId", "")
    path = payload.get("path", "")
    request_id = payload.get("requestId")
    
    try:
        logger.info(f"File chunk request received for path: {path}")
        
        # Check if path is allowed
        if not is_path_allowed(path, client.config.workspacepaths):
            raise PermissionError(f"Access to path '{path}' is not allowed")
        
        # Check if file exists
        file_path = Path(path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        
        # Try to read file content as text
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
        except UnicodeDecodeError:
            # If we get a decode error, it's likely a binary file
            await client._send_response(
                file_chunk_result_msg(request_id, agent_id, path, error=f"Cannot read binary file.")
            )
            return
        
        # Send the response using the message formatter
        await client._send_response(
            file_chunk_result_msg(request_id, agent_id, path, content)
        )
        
    except Exception as error:
        logger.error(f"Error processing file chunk request: {str(error)}")
        # Send error response using the message formatter
        await client._send_response(
            file_chunk_result_msg(request_id, agent_id, path, error=str(error), success=False)
        )
