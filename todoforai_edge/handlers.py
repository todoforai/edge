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
    cd_response_msg, ctx_julia_result_msg,
    file_chunk_result_msg, get_folders_response_msg
)
from .constants import Edge2Front as EF, Edge2Agent as EA
from .workspace_handler import is_path_allowed
from .shell_handler import ShellProcess

logger = logging.getLogger("todoforai-edge")

# Handler functions for external use
async def handle_block_execute(payload, client):
    """Handle code execution request"""
    block_id = payload.get("blockId")
    message_id = payload.get("messageId", "")
    content = payload.get("content", "")
    todo_id = payload.get("todoId", "")
    print("handle_block_execute", payload)
    
    # Send start message
    await client._send_response(block_start_result_msg(todo_id, block_id, "execute", message_id))
    
    try:
        shell = ShellProcess()
        
        print(f"DEBUG: Executing shell block with content: {content[:100]}...")

        # Start the execution in a separate task so we don't block
        asyncio.create_task(
            shell.execute_block(block_id, content, client, todo_id, message_id, 12)
        )
        
        # Return immediately without waiting for the command to complete
        return
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error executing command: {str(error)}\nStacktrace:\n{stack_trace}")
        await client._send_response(block_error_result_msg(block_id, todo_id, f"{str(error)}\n\nStacktrace:\n{stack_trace}"))


async def handle_block_keyboard(payload, client):
    print("""Handle keyboard events""")
    block_id = payload.get("blockId")
    input_text = payload.get("content", "")
    
    try:
        
        logger.info(f"Keyboard event received: {input_text} for block {block_id}")
        
        shell = ShellProcess()
        await shell.send_input(block_id, input_text)
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error processing key: {str(error)}\nStacktrace:\n{stack_trace}")
        await client._send_response(block_error_result_msg(block_id, f"{str(error)}\n\nStacktrace:\n{stack_trace}"))


async def handle_block_signal(payload, client):
    """Handle signal events (like SIGINT, SIGTERM)"""
    print("""Handle signal events (like SIGINT, SIGTERM)""")
    block_id = payload.get("blockId")
    
    try:
        # Default to interrupt signal
        signal_type = "interrupt"
        
        logger.info(f"Signal received: {signal_type} for block {block_id}")
        
        # Send interrupt to the shell
        shell = ShellProcess()
        shell.interrupt_block(block_id)
    except Exception as error:
        logger.error(f"Error processing signal: {str(error)}")
        await client._send_response(block_error_result_msg(block_id, str(error)))

async def handle_get_folders(payload, client):
    """Handle request to get folders at depth 1 for a given path"""
    request_id = payload.get("requestId")
    edge_id = payload.get("edgeId")
    path = payload.get("path", ".")
    
    try:
        # Normalize path
        target_path = Path(path).expanduser().resolve()
        
        # Check if path exists
        if not target_path.exists():
            logger.warning(f"Path does not exist: {path}")
            return
        
        # If path is a file, use its parent directory
        if target_path.is_file():
            target_path = target_path.parent
        
        # Get all folders at depth 1
        folders = []
        files = []
        
        for item in target_path.iterdir():
            if item.is_dir():
                folders.append(str(item))
            else:
                files.append(str(item))
        
        # Sort the lists for consistent output
        folders.sort()
        files.sort()

        
        # Send the response
        await client._send_response(get_folders_response_msg(request_id, edge_id, folders, files))
        
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error getting folders: {str(error)}\nStacktrace:\n{stack_trace}")
        await client._send_response(get_folders_response_msg(
            request_id, edge_id, [], [], f"{str(error)}\n\nStacktrace:\n{stack_trace}"
        ))

# Handler functions
async def handle_todo_dir_list(payload, client):
    """Handle todo directory listing request"""
    request_id = payload.get("requestId")
    path = payload.get("path", ".")
    todo_id = payload.get("todoId", "")
    
    try:
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
    rootpath = payload.get("rootPath")
    content = payload.get("content")
    
    try:
        filepath = os.path.join(rootpath, filepath)
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

async def handle_file_chunk_request(payload, client):
    """Handle file chunk request - reads a file and returns its content"""
    agent_id = payload.get("agentId", "")
    path = payload.get("path", "")
    request_id = payload.get("requestId")
    
    try:
        logger.info(f"File chunk request received for path: {path}")
        
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
        logger.error(f"Error processing file chunk request: {str(error)}, path: {path}")
        # Send error response using the message formatter
        await client._send_response(
            file_chunk_result_msg(request_id, agent_id, path, error=str(error), success=False)
        )
