import os
import asyncio
import logging
import traceback
from pathlib import Path
from typing import Dict, Any, Optional, List

import platform

from .shell_handler import ShellProcess
from ..constants.messages import (
    block_start_result_msg, block_error_result_msg, get_folders_response_msg,
    dir_list_response_msg, cd_response_msg, block_save_result_msg, 
    block_message_result_msg, block_diff_result_msg, task_action_update_msg,
    ctx_julia_result_msg, file_chunk_result_msg, 
    function_call_result_msg, call_edge_method_result_msg 
)
from ..constants.constants import Edge2Agent as EA
from ..constants.workspace_handler import is_path_allowed
from .file_sync import ensure_workspace_synced

logger = logging.getLogger("todoforai-edge")

def get_parent_directory_if_needed(path: str, root_path: Optional[str], fallback_root_paths: List[str]) -> Optional[str]:
    """
    Get the parent directory of any workspace path if it should be added to search paths.
    
    This handles cases where a relative path starts with any workspace folder name,
    indicating the user wants to reference files relative to the parent of that workspace.
    
    Example:
        root_path = "/home/user/projects/myproject"
        fallback_root_paths = ["/home/user/other/myproject"]
        path = "myproject/src/main.py"
        
        Since path starts with "myproject" (the last folder of any workspace path),
        returns the parent directory of the first matching workspace.
        
    Returns:
        str: Parent directory path if it should be added, None otherwise
    """
    if os.path.isabs(path):
        return None
    
    # Collect all workspace paths to check
    all_workspace_paths = []
    if root_path:
        all_workspace_paths.append(root_path)
    if fallback_root_paths:
        all_workspace_paths.extend(fallback_root_paths)
    
    # Check each workspace path
    for workspace_path in all_workspace_paths:
        if not workspace_path:
            continue
            
        # Extract the last folder name from workspace_path
        workspace_folder_name = os.path.basename(workspace_path.rstrip(os.sep))
        
        # Check if path starts with the workspace folder name
        if path.startswith(workspace_folder_name + os.sep) or path == workspace_folder_name:
            workspace_parent = os.path.dirname(workspace_path)
            if workspace_parent:
                return workspace_parent
    
    return None

def resolve_file_path(path: str, root_path: Optional[str] = None, fallback_root_paths: List[str] = None) -> str:
    """Resolve file path using root path and fallback paths"""
    path = os.path.expanduser(path)

    if fallback_root_paths:
        all_paths = [root_path] + fallback_root_paths if root_path else fallback_root_paths
        
        # Add parent directory of any workspace as last resort for relative paths
        parent_dir = get_parent_directory_if_needed(path, root_path, fallback_root_paths)
        if parent_dir and parent_dir not in all_paths:
            all_paths.append(parent_dir)
        
        found_path = find_file_in_workspaces(path, all_paths, root_path)
        if found_path:
            return found_path

    # Fallback to root_path if available and path is relative
    if root_path and not os.path.isabs(path):
        return os.path.join(root_path, path)

    return path

def find_file_in_workspaces(path: str, workspace_paths: List[str], primary_path: Optional[str] = None) -> Optional[str]:
    """Find a file in workspace paths, with optional primary path priority"""
    # Check primary path first if provided
    if primary_path:
        candidate_path = os.path.join(primary_path, path) if not os.path.isabs(path) else path
        candidate_path = os.path.expanduser(candidate_path)
        candidate_path = os.path.abspath(candidate_path)
        if Path(candidate_path).exists():
            return candidate_path

    # Search in other workspace paths
    for workspace_path in workspace_paths:
        candidate_path = os.path.join(workspace_path, path)
        candidate_path = os.path.expanduser(candidate_path)
        candidate_path = os.path.abspath(candidate_path)

        if Path(candidate_path).exists():
            return candidate_path

    return None

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
    await client.send_response(block_start_result_msg(todo_id, block_id, "execute", message_id))

    try:
        shell = ShellProcess()

        logger.debug(f"Executing shell block with content: {content[:20]}...")

        # Start the execution in a separate task so we don't block
        asyncio.create_task(
            shell.execute_block(block_id, content, client, todo_id, message_id, 120, root_path)
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
    path = payload.get("path", ".")

    try:
        # Normalize path
        target_path = Path(path).expanduser().resolve()

        # Check if path exists
        if not target_path.exists():
            raise FileNotFoundError(f"Path does not exist: {path}")

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
        await client.send_response(get_folders_response_msg(request_id, edge_id, folders, files))

    except Exception as error:
        logger.error(f"Error getting folders: {str(error)}")
        await client.send_response(get_folders_response_msg(
            request_id, edge_id, [], [], f"{str(error)}"
        ))

# Handler functions
async def handle_todo_dir_list(payload, client):
    """Handle todo directory listing request"""
    request_id = payload.get("requestId")
    path = payload.get("path", ".")
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
    path = payload.get("path", ".")

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

        await client.send_response(cd_response_msg(edge_id, path, request_id, True))
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

    try:
        filepath = resolve_file_path(filepath, rootpath, fallback_root_paths)
        logger.info(f'Saving file: {filepath}')

        # Check if path is allowed before proceeding
        if not is_path_allowed(filepath, client.edge_config.workspacepaths):
            raise PermissionError("No permission to save file to the given path")

        # Only create directory if filepath has a directory component
        dirname = os.path.dirname(filepath)
        if dirname:  # Check if dirname is not empty
            os.makedirs(dirname, exist_ok=True)

        # Write content to file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        await client.send_response(block_save_result_msg(block_id, todo_id, "SUCCESS"))

    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error saving file: {str(error)}\nStacktrace:\n{stack_trace}")
        await client.send_response(block_save_result_msg(block_id, todo_id, f"ERROR: {str(error)}\n\nStacktrace:\n{stack_trace}"))


async def handle_block_refresh(payload, client):
    """Handle block refresh request"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId", "")
    data = payload.get("data", "")

    await client.send_response(block_message_result_msg(todo_id, block_id, "REFRESHING"))


async def handle_block_diff(payload, client):
    """Handle diff requests"""
    block_id = payload.get("blockId")
    todo_id = payload.get("todoId", "")
    filepath = payload.get("filepath", "")
    content = payload.get("content", "")

    try:
        # Check if path is allowed before proceeding
        if not is_path_allowed(filepath, client.edge_config.workspacepaths):
            raise PermissionError("No permission to access the given file")

        # Check if the file exists
        file_path = Path(filepath)
        if not file_path.exists():
            # If file doesn't exist, just return the new content as the diff
            await client.send_response(block_diff_result_msg(todo_id, block_id, "", content))
        else:
            # Read the original file content
            with open(filepath, 'r') as f:
                original_content = f.read()

            # Send the diff result using the new protocol structure
            await client.send_response(block_diff_result_msg(todo_id, block_id, original_content, content))
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error generating diff: {str(error)}\nStacktrace:\n{stack_trace}")
        await client.send_response(block_error_result_msg(block_id, todo_id, f"{str(error)}\n\nStacktrace:\n{stack_trace}"))


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
        logger.info(f"File chunk request received for path: {path}, rootPath: {root_path}, fallbackRootPaths: {fallback_root_paths}, requestId: {requestId}")

        full_path = resolve_file_path(path, root_path, fallback_root_paths)

        # Normalize the path
        full_path = os.path.abspath(full_path)

        # Check if path is allowed before proceeding
        if not is_path_allowed(full_path, client.edge_config.workspacepaths):
            raise PermissionError(f"No permission to access the given file {full_path}")

        # Ensure the workspace containing this file is being synced
        await ensure_workspace_synced(client, full_path)

        file_path = Path(full_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {full_path}")

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

        # Try to read file content as text
        try:
            with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
                
            # Log file and content size for debugging
            content_size = len(content.encode('utf-8'))
            logger.info(f"File content size: {len(content):,} chars")
                
        except UnicodeDecodeError:
            raise ValueError(f"Cannot read binary file {full_path}")

        # Send the response using the message formatter
        await client.send_response(
            file_chunk_result_msg(response_type, **payload, full_path=full_path, content=content)
        )

    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error processing file chunk request: {str(error)}, path: {path}, rootPath: {root_path}\nStacktrace:\n{stack_trace}")
        # Send error response using the message formatter
        await client.send_response(
            file_chunk_result_msg(response_type, **payload, error=f"{str(error)}\n\nStacktrace:\n{stack_trace}")
        )

# Function registry for dynamic function calls
FUNCTION_REGISTRY = {}

def register_function(name: str):
    """Decorator to register functions for dynamic calling"""
    def decorator(func):
        FUNCTION_REGISTRY[name] = func
        return func
    return decorator

@register_function("list_available_functions")
async def list_available_functions():
    """List all available functions in the registry"""
    return {
        "functions": list(FUNCTION_REGISTRY.keys()),
        "count": len(FUNCTION_REGISTRY)
    }

@register_function("get_current_directory")
async def get_current_directory():
    """Get the current working directory"""
    return {
        "current_directory": os.getcwd()
    }

@register_function("get_environment_variable")
async def get_environment_variable(var_name: str):
    """Get an environment variable value"""
    return {
        "variable": var_name,
        "value": os.environ.get(var_name, None)
    }

@register_function("get_system_info")
async def get_system_info():
    """Get system information including OS and shell"""
    try:
        # Get OS information
        system_info = platform.system()
        if system_info == "Darwin":
            system_name = "macOS"
        elif system_info == "Linux":
            # Try to get more specific Linux distribution info
            try:
                with open('/etc/os-release', 'r') as f:
                    lines = f.readlines()
                    for line in lines:
                        if line.startswith('PRETTY_NAME='):
                            system_name = line.split('=')[1].strip().strip('"')
                            break
                    else:
                        system_name = "Linux"
            except:
                system_name = "Linux"
        elif system_info == "Windows":
            system_name = f"Windows {platform.release()}"
        else:
            system_name = system_info

        # Get shell information
        shell_info = "Unknown shell"
        try:
            # Try to get shell from environment
            shell_env = os.environ.get('SHELL', '')
            if shell_env:
                shell_info = os.path.basename(shell_env)
            else:
                # Fallback: try to detect shell on Windows
                if system_info == "Windows":
                    shell_info = "cmd.exe"
        except:
            pass

        return {
            "system": system_name,
            "shell": shell_info
        }

    except Exception as error:
        logger.error(f"Error getting system info: {str(error)}")
        return {
            "system": f"Unknown system (error: {str(error)})",
            "shell": "Unknown shell"
        }

# MCP-specific function registry
@register_function("mcp_list_tools")
async def mcp_list_tools(client_instance=None):
    """List all available MCP tools with raw MCP structure"""
    if not hasattr(client_instance, 'mcp_collector') or not client_instance.mcp_collector:
        raise ValueError("No MCP collector available")
    
    # Return raw tools from MCP collector
    tools = await client_instance.mcp_collector.list_tools()
    
    return {
        "tools": tools,  # Raw MCP tool objects
        "count": len(tools),
        "description": "Available MCP tools (raw MCP format)"
    }

@register_function("mcp_call_tool")
async def mcp_call_tool(tool_name: str, arguments: Dict[str, Any] = None, client_instance=None):
    """Call an MCP tool with given arguments"""
    if not hasattr(client_instance, 'mcp_collector') or not client_instance.mcp_collector:
        raise ValueError("No MCP collector available")
    
    if arguments is None:
        arguments = {}
    
    result = await client_instance.mcp_collector.call_tool(tool_name, arguments)
    return result

@register_function("mcp_list_servers")
async def mcp_list_servers(client_instance=None):
    """List all connected MCP servers with raw MCP structure"""
    if not hasattr(client_instance, 'mcp_collector') or not client_instance.mcp_collector:
        raise ValueError("No MCP collector available")
    
    # Get server information from the collector
    servers = []
    if hasattr(client_instance.mcp_collector, 'clients'):
        servers = list(client_instance.mcp_collector.clients.keys())
    
    return {
        "servers": servers,
        "count": len(servers),
        "description": "List of connected MCP servers"
    }

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
            return call_edge_method_result_msg(self.request_id, self.edge_id, True, result=result)
    
    def error_response(self, error_message: str):
        """Create error response based on request type"""
        if self.is_agent_request:
            return function_call_result_msg(self.request_id, self.edge_id, False, error=error_message, agent_id=self.agent_id)
        else:
            return call_edge_method_result_msg(self.request_id, self.edge_id, False, error=error_message)

async def _execute_function(function_name: str, args: dict, client) -> any:
    """Execute a registered function with proper argument handling"""
    if function_name not in FUNCTION_REGISTRY:
        available_functions = list(FUNCTION_REGISTRY.keys())
        raise ValueError(f"Unknown function: {function_name}. Available functions: {available_functions}")
    
    func = FUNCTION_REGISTRY[function_name]
    
    # For MCP functions, always pass the client instance
    if function_name.startswith('mcp_'):
        args['client_instance'] = client
    
    # Execute function based on its signature
    import inspect
    sig = inspect.signature(func)
    
    if len(sig.parameters) > 0:
        result = await func(**args) if asyncio.iscoroutinefunction(func) else func(**args)
    else:
        result = await func() if asyncio.iscoroutinefunction(func) else func()
    
    return result

async def handle_call_edge_method(payload, client):
    await handle_function_call_request(payload, client)

async def handle_function_call_request(payload, client):
    """Unified handler for function calls from both agent and frontend"""
    request_id = payload.get("requestId")
    function_name = payload.get("functionName")
    args = payload.get("args", {})
    agent_id = payload.get("agentId")  # Only present for agent requests
    edge_id = payload.get("edgeId")

    response_handler = FunctionCallResponse(request_id, edge_id, agent_id)
    
    try:
        logger.info(f"Function call request received: {function_name} with args: {args}")
        
        result = await _execute_function(function_name, args, client)
        response = response_handler.success_response(result)
        
    except Exception as error:
        stack_trace = traceback.format_exc()
        logger.error(f"Error processing function call: {str(error)}\nStacktrace:\n{stack_trace}")
        response = response_handler.error_response(f"{str(error)}\n\nStacktrace:\n{stack_trace}")
    
    await client.send_response(response)
