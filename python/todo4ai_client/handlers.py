import os
import json
import asyncio
import logging
from pathlib import Path

logger = logging.getLogger("todo4ai-client")

# Response message formatters
def project_dir_result_msg(request_id, path, items):
    return {
        "requestId": request_id,
        "path": path,
        "items": items,
        "success": True
    }

def block_error_msg(request_id, error_message):
    return {
        "requestId": request_id,
        "error": error_message,
        "success": False
    }

def block_start_msg(block_id, action):
    return {
        "blockId": block_id,
        "status": "started",
        "action": action
    }

def block_message_msg(block_id, content):
    return {
        "blockId": block_id,
        "content": content
    }

def block_save_result_msg(block_id, todo_id, status):
    return {
        "blockId": block_id,
        "todoId": todo_id,
        "status": status
    }

def block_diff_result_msg(block_id, diff_data):
    return {
        "blockId": block_id,
        "diffData": diff_data
    }

# Handler functions
async def handle_project_dir_list(payload, client):
    """Handle project directory listing request"""
    request_id = payload.get("requestId")
    path = payload.get("path", ".")
    
    try:
        items = []
        for item in Path(path).iterdir():
            item_type = "directory" if item.is_dir() else "file"
            items.append({"name": item.name, "type": item_type})
        
        await client._send_response("PROJECT_DIR_LIST_RESPONSE", 
            project_dir_result_msg(request_id, path, items))
            
    except Exception as e:
        logger.error(f"Error listing directory: {str(e)}")
        await client._send_response("PROJECT_DIR_LIST_RESPONSE", 
            block_error_msg(request_id, str(e)))

async def handle_todo_dir_list(payload, client):
    """Handle todo directory listing request"""
    request_id = payload.get("requestId")
    path = payload.get("path", ".")
    
    try:
        items = []
        for item in Path(path).iterdir():
            item_type = "directory" if item.is_dir() else "file"
            items.append({"name": item.name, "type": item_type})
        
        await client._send_response("TODO_DIR_LIST_RESPONSE", {
            "requestId": request_id,
            "path": path,
            "items": items,
            "success": True
        })
    except Exception as e:
        logger.error(f"Error listing directory: {str(e)}")
        await client._send_response("TODO_DIR_LIST_RESPONSE", 
            block_error_msg(request_id, str(e)))

async def handle_block_execute(payload, client):
    """Handle shell script execution request"""
    block_id = payload.get("blockId")
    request_id = payload.get("requestId")
    command = payload.get("command", "")
    
    await client._send_response("BLOCK_EXECUTE_RESPONSE", 
        block_start_msg(block_id, "execute"))
    
    try:
        # Execute the shell command
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        # Send the response back
        await client._send_response("BLOCK_EXECUTE_RESPONSE", {
            "requestId": request_id,
            "blockId": block_id,
            "stdout": stdout.decode(),
            "stderr": stderr.decode(),
            "exitCode": process.returncode,
            "success": process.returncode == 0
        })
    except Exception as e:
        logger.error(f"Error executing command: {str(e)}")
        await client._send_response("BLOCK_EXECUTE_RESPONSE", 
            block_error_msg(request_id, str(e)))

async def handle_block_save(payload, client):
    """Handle file save request"""
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
            
        await client._send_response("BLOCK_SAVE_RESPONSE", 
            block_save_result_msg(block_id, todo_id, "completed"))
            
    except Exception as e:
        logger.error(f"Error saving file: {str(e)}")
        await client._send_response("BLOCK_SAVE_RESPONSE", 
            block_save_result_msg(block_id, todo_id, "error"))

async def handle_block_refresh(payload, client):
    """Handle block refresh request"""
    block_id = payload.get("blockId")
    await client._send_response("BLOCK_REFRESH_RESPONSE", 
        block_message_msg(block_id, "REFRESHING"))

async def handle_block_keyboard(payload, client):
    """Handle keyboard events"""
    block_id = payload.get("blockId")
    key_code = payload.get("keyCode")
    key = payload.get("key")
    
    # This is a placeholder - implementation depends on specific requirements
    logger.info(f"Keyboard event received: {key} ({key_code})")
    
    await client._send_response("BLOCK_KEYBOARD_RESPONSE", {
        "blockId": block_id,
        "processed": True
    })

async def handle_block_signal(payload, client):
    """Handle signal events (like SIGINT, SIGTERM)"""
    block_id = payload.get("blockId")
    signal_type = payload.get("signal")
    
    logger.info(f"Signal received: {signal_type} for block {block_id}")
    
    # This is a placeholder - implementation depends on specific requirements
    await client._send_response("BLOCK_SIGNAL_RESPONSE", 
        block_message_msg(block_id, "PROCESSING"))

async def handle_block_diff(payload, client):
    """Handle diff requests"""
    block_id = payload.get("blockId")
    diff_data = payload.get("data", {})
    
    # This is a placeholder - implementation depends on specific requirements
    logger.info(f"Diff request received for block {block_id}")
    
    await client._send_response("BLOCK_DIFF_RESPONSE", 
        block_diff_result_msg(block_id, diff_data))
