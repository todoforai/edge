import os
import asyncio
import logging
import traceback
import json
from pathlib import Path
from typing import Dict, Any, Optional, List

import platform
# Removed plain-XML related imports; we don't support .xml files directly anymore

from .shell_handler import ShellProcess
from .docx_handler import is_valid_xml, extract_docx_content, save_docx_content, extract_xlsx_content, save_xlsx_content
from ..constants.messages import (
    shell_block_start_result_msg, block_error_result_msg, get_folders_response_msg,
    dir_list_response_msg, cd_response_msg, block_save_result_msg, 
    shell_block_message_result_msg, task_action_update_msg,
    ctx_julia_result_msg, file_chunk_result_msg, 
    function_call_result_msg, function_call_result_front_msg 
)
from ..constants.constants import Edge2Agent as EA
from ..constants.workspace_handler import is_path_allowed
from .file_sync import ensure_workspace_synced

# NEW: import registry and helpers from separated module
from ..edge_functions import (
    FUNCTION_REGISTRY,
    get_platform_default_directory,
    get_path_or_platform_default,
)
from .path_utils import (
    get_parent_directory_if_needed,
    resolve_file_path,
    find_file_in_workspaces,
)

logger = logging.getLogger("todoforai-edge")

# Handler functions for external use
async def handle_block_execute(payload, client):
    """Handle code execution request"""
    block_id = payload.get("blockId")
    message_id = payload.get("messageId", "")
    content = payload.get("content", "")
    todo_id = payload.get("todoId", "")
    root_path = payload.get("rootPath", "")
    logger.info(f"handle_block_execute: {payload}")

    # Send start message
    await client.send_response(shell_block_start_result_msg(todo_id, block_id, "execute", message_id))

    try:
        shell = ShellProcess()

        logger.debug(f"Executing shell block with content: {content[:20]}...")
        timeout = payload.get("timeout", 120)

        # Start the execution in a separate task so we don't block
        asyncio.create_task(
            shell.execute_block(block_id, content, client, todo_id, message_id, timeout, root_path)
        )

        # Return immediately without waiting for the command to complete
        return
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error executing command: {str(error)}\nStacktrace:\n{stack_trace}")
        await client.send_response(block_error_result_msg(block_id, todo_id, f"{str(error)}\n\nStacktrace:\n{stack_trace}"))


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
        await client.send_response(block_error_result_msg(block_id, error=f"{str(error)}\n\nStacktrace:\n{stack_trace}"))


async def handle_get_folders(payload, client):
    """Handle request to get folders at depth 1 for a given path"""
    request_id = payload.get("requestId")
    edge_id = payload.get("edgeId")
    path = get_path_or_platform_default(payload.get("path", "."))

    try:
        # If path ends with separator, list contents of that directory
        # If path doesn't end with separator, list contents of parent directory
        if path.endswith(os.sep):
            # Remove trailing separator and use as target directory
            target_path = Path(path).expanduser()
        else:
            # Use parent directory
            target_path = Path(path).expanduser().parent

        if not (target_path.exists() and target_path.is_dir()):
            raise FileNotFoundError(f"No existing ancestor for path: {path}")

        actual_path = str(target_path.resolve())

        folders = []
        files = []

        for item in target_path.iterdir():
            if item.is_dir():
                folders.append(str(item))
            else:
                files.append(str(item))

        folders.sort()
        files.sort()

        await client.send_response(get_folders_response_msg(
            request_id, edge_id, folders, files, actual_path=actual_path
        ))

    except Exception as error:
        logger.error(f"Error getting folders: {str(error)}")
        await client.send_response(get_folders_response_msg(
            request_id, edge_id, [], [], f"{str(error)}"
        ))


async def handle_todo_dir_list(payload, client):
    """Handle todo directory listing request"""
    request_id = payload.get("requestId")
    path = get_path_or_platform_default(payload.get("path", "."))
    todo_id = payload.get("todoId", "")

    try:
        items = []
        paths = []
        for item in Path(path).iterdir():
            item_type = "directory" if item.is_dir() else "file"
            items.append({"name": item.name, "type": item_type})
            paths.append(str(item))

        # Use the new protocol structure
        await client.send_response(dir_list_response_msg(todo_id, paths))
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error listing directory: {str(error)}\nStacktrace:\n{stack_trace}")
        await client.send_response(block_error_result_msg(request_id, todo_id, f"{str(error)}\n\nStacktrace:\n{stack_trace}"))



async def handle_todo_cd(payload: Dict[str, Any], client: Any) -> None:
    """Handle todo change directory request and update workspace list"""
    request_id = payload.get("requestId")
    edge_id = payload.get("edgeId")
    path = get_path_or_platform_default(payload.get("path", "."))

    try:
        # Validate that the path exists and is a directory
        dir_path = Path(path).expanduser().resolve()
        if not dir_path.exists() or not dir_path.is_dir():
            raise ValueError(f"Path does not exist or is not a directory: {path}")

        # Update workspace paths if this is a new path
        abs_path = str(dir_path)
        if hasattr(client, 'edge_config'):
            # Use the new add_workspace_path method which handles the callback
            path_added = client.edge_config.add_workspace_path(abs_path)

            if path_added:
                logger.info(f"Added new workspace path: {abs_path}")

        await client.send_response(cd_response_msg(edge_id, abs_path, request_id, True))
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error changing directory: {str(error)}\nStacktrace:\n{stack_trace}")
        await client.send_response(cd_response_msg(edge_id, path, request_id, False, f"{str(error)}\n\nStacktrace:\n{stack_trace}"))



async def handle_block_save(payload, client):
    """Handle file save request - simple implementation"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId")
    filepath = payload.get("filepath")
    rootpath = payload.get("rootPath")
    fallback_root_paths = payload.get("fallbackRootPaths", [])
    content = payload.get("content")
    requestId = payload.get("requestId", None)

    try:
        filepath = resolve_file_path(filepath, rootpath, fallback_root_paths)
        logger.info(f'Saving file: {filepath}')
        
        # Check if path is allowed before proceeding
        if not is_path_allowed(filepath, client.edge_config.config):
            raise PermissionError("No permission to save file to the given path")

        # Special handling for DOCX files
        if filepath.lower().endswith('.docx'):
            # Validate XML content by checking the actual XML part
            if not is_valid_xml(content):
                raise ValueError("Cannot save non-XML content to DOCX file. DOCX files require valid XML content.")
            
            # Check if the DOCX file exists
            if not os.path.exists(filepath):
                raise FileNotFoundError(f"DOCX file does not exist: {filepath}. Cannot create new DOCX files, only modify existing ones.")
            
            logger.info("Saving XML content to existing DOCX file")
            save_docx_content(filepath, content)
        
        # Special handling for Excel files
        elif filepath.lower().endswith('.xlsx'):
            # For Excel files, content should be JSON
            if not os.path.exists(filepath):
                raise FileNotFoundError(f"Excel file does not exist: {filepath}. Cannot create new Excel files, only modify existing ones.")
            
            logger.info("Saving JSON content to existing Excel file")
            save_xlsx_content(filepath, content)
        
        else:
            # Regular file saving
            # Only create directory if filepath has a directory component
            dirname = os.path.dirname(filepath)
            if dirname:  # Check if dirname is not empty
                os.makedirs(dirname, exist_ok=True)

            # Write content to file
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

        await client.send_response(block_save_result_msg(block_id, todo_id, "SUCCESS", requestId))

    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error saving file: {str(error)}\nStacktrace:\n{stack_trace}")
        await client.send_response(block_save_result_msg(block_id, todo_id, f"ERROR: {str(error)}\n\nStacktrace:\n{stack_trace}", requestId))


async def handle_block_refresh(payload, client):
    """Handle block refresh request"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId", "")
    data = payload.get("data", "")

    await client.send_response(block_message_result_msg(todo_id, block_id, "REFRESHING"))

async def handle_task_action_new(payload, client):
    """Handle new task action request"""
    task_id = payload.get("taskId")
    edge_id = payload.get("edgeId")
    agent_id = payload.get("agentId")

    try:
        # This is a placeholder - implementation depends on specific requirements
        # Typically this would involve starting a new task or process
        logger.info(f"New task action received: {task_id} for agent {agent_id}")

        await client.send_response(task_action_update_msg(task_id, edge_id, "started"))
    except Exception as error:
        logger.error(f"Error starting task: {str(error)}")
        await client.send_response(task_action_update_msg(task_id, edge_id, "error", str(error)))


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
        await client.send_response(
            ctx_julia_result_msg(todo_id, request_id, ["example/file.jl"], ["# This is a placeholder Julia result"])
        )
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error processing Julia request: {str(error)}\nStacktrace:\n{stack_trace}")
        await client.send_response(ctx_julia_result_msg(todo_id, request_id, error=f"{str(error)}\n\nStacktrace:\n{stack_trace}"))

async def handle_file_chunk_request(payload, client, response_type=EA.FILE_CHUNK_RESULT):
    """Handle file chunk request - reads a file and returns its content"""
    path = payload.get("path", "")
    root_path = payload.get("rootPath", "")
    fallback_root_paths = payload.get("fallbackRootPaths", [])
    requestId = payload.get("requestId", "")

    try:
        full_path = resolve_file_path(path, root_path, fallback_root_paths)
        full_path = os.path.abspath(full_path)

        # Check if path is allowed
        if not is_path_allowed(full_path, client.edge_config.config):
            raise PermissionError(f"No permission to access the given file {full_path}")

        # Ensure the workspace containing this file is being synced
        await ensure_workspace_synced(client, full_path)

        file_path = Path(full_path)
        if not file_path.exists():
            # Return file not found in error field instead of throwing exception
            roots = [root_path] if root_path else []
            if fallback_root_paths:
                roots.extend(fallback_root_paths)
            error_msg = f"File not found: {path} (roots: {roots})"
            await client.send_response(
                file_chunk_result_msg(response_type, **payload, error=error_msg)
            )
            return

        # If it's a directory, return a simple listing (one per line, '/' suffix for dirs)
        if file_path.is_dir():
            names = sorted(os.listdir(full_path))
            content = "\n".join([n + "/" if os.path.isdir(os.path.join(full_path, n)) else n for n in names])
            await client.send_response(
                file_chunk_result_msg(response_type, **payload, full_path=full_path, content=content)
            )
            return

        # Check file size before reading
        file_size = file_path.stat().st_size
        max_size = 100000  # 100KB limit for WebSocket messages
        
        if file_size > max_size:
            error_msg = f"File too large to read: {full_path} File size: {file_size:,} bytes ({file_size/1024:.1f} KB) Maximum allowed: {max_size:,} bytes ({max_size/1024:.1f} KB)"
            logger.warning(error_msg)
            await client.send_response(
                file_chunk_result_msg(response_type, **payload, error=error_msg)
            )
            return

        # Decide content source and set content type
        if file_path.suffix.lower() == '.docx':
            content = extract_docx_content(full_path)
            content_type = "docx-xml"
            logger.info(f"DOCX content extracted as XML, size: {len(content):,} chars")
        elif file_path.suffix.lower() == '.xlsx':
            content = extract_xlsx_content(full_path)
            content_type = "xlsx-xml"
            logger.info(f"Excel content extracted as XML, size: {len(content):,} chars")
        else:
            try:
                with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
                content_type = "text"
            except UnicodeDecodeError:
                raise ValueError(f"Cannot read binary file {full_path}")

        # Determine display path for logging
        if root_path:
            try:
                rel_path = os.path.relpath(full_path, root_path)
                display_path = f"@workspace/{rel_path}"
            except ValueError:
                # Different drives on Windows
                display_path = full_path
        else:
            display_path = full_path
        
        logger.info(f"File chunk request received for path: {display_path} size: {len(content):,} chars")

        # Send the response with content type indicator
        await client.send_response(
            file_chunk_result_msg(response_type, **payload, full_path=full_path, content=content, content_type=content_type)
        )

    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error processing file chunk request: {str(error)}, path: {path}, rootPath: {root_path}\nStacktrace:\n{stack_trace}")
        # Send error response using the message formatter
        await client.send_response(
            file_chunk_result_msg(response_type, **payload, error=f"{str(error)}\n\nStacktrace:\n{stack_trace}")
        )

class FunctionCallResponse:
    """Encapsulates function call response logic"""
    
    def __init__(self, request_id: str, edge_id: str, agent_id: str = None):
        self.request_id = request_id
        self.edge_id = edge_id
        self.agent_id = agent_id
        self.is_agent_request = agent_id is not None
    
    def success_response(self, result):
        """Create success response based on request type"""
        if self.is_agent_request:
            return function_call_result_msg(self.request_id, self.edge_id, True, result=result, agent_id=self.agent_id)
        else:
            return function_call_result_front_msg(self.request_id, self.edge_id, True, result=result)
    
    def error_response(self, error_message: str):
        """Create error response based on request type"""
        if self.is_agent_request:
            return function_call_result_msg(self.request_id, self.edge_id, False, error=error_message, agent_id=self.agent_id)
        else:
            return function_call_result_front_msg(self.request_id, self.edge_id, False, error=error_message)

async def _execute_function(function_name: str, args: dict, client) -> any:
    """Execute a registered function with proper argument handling"""
    if function_name not in FUNCTION_REGISTRY:
        available_functions = list(FUNCTION_REGISTRY.keys())
        logger.warning(f"Unknown function: {function_name}")
        raise ValueError(f"Unknown function: {function_name}. Available functions: {available_functions}")
    
    func = FUNCTION_REGISTRY[function_name]
    
    # Execute function based on its signature
    import inspect
    sig = inspect.signature(func)
    if "client_instance" in sig.parameters and "client_instance" not in args:
        args["client_instance"] = client
    
    if len(sig.parameters) > 0:
        result = await func(**args) if asyncio.iscoroutinefunction(func) else func(**args)
    else:
        result = await func() if asyncio.iscoroutinefunction(func) else func()
    
    return result

async def handle_function_call_request(payload, client):
    """Unified handler for function calls from both agent and frontend"""
    request_id = payload.get("requestId")
    function_name = payload.get("functionName")
    args = payload.get("args", {})
    agent_id = payload.get("agentId")
    edge_id = payload.get("edgeId")

    response_handler = FunctionCallResponse(request_id, edge_id, agent_id)
    req_type = "agent" if agent_id else "frontend"
    
    try:
        logger.info(f"{req_type.capitalize()} function call request: {function_name} with args: {args}")
        result = await _execute_function(function_name, args, client)
        response = response_handler.success_response(result)
    except Exception as error:
        # Avoid returning stacktraces to callers for common/expected errors like missing files.
        if isinstance(error, FileNotFoundError):
            logger.warning(f"File not found during {req_type} function call '{function_name}': {error}")
            response = response_handler.error_response(str(error))
        else:
            stack_trace = traceback.format_exc()
            logger.error(f"Error processing {req_type} function call: {str(error)}\nStacktrace:\n{stack_trace}")
            response = response_handler.error_response(f"{str(error)}\n\nStacktrace:\n{stack_trace}")
    
    await client.send_response(response)

async def handle_function_call_request_front(payload, client):
    """Handle function call request from frontend (wrapper)"""
    return await handle_function_call_request(payload, client)

async def handle_function_call_request_agent(payload, client):
    """Handle function call request from agent (wrapper)"""
    return await handle_function_call_request(payload, client)
