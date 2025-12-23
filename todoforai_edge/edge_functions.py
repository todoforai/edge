import os
import asyncio
import logging
import platform
import base64
from pathlib import Path
from typing import Dict, Any, List, Optional
import requests
from .constants.workspace_handler import is_path_allowed
from .handlers.shell_handler import ShellProcess
from .handlers.path_utils import resolve_file_path

logger = logging.getLogger("todoforai-edge")

# Function registry for dynamic function calls
FUNCTION_REGISTRY = {}

def register_function(name: str):
    """Decorator to register functions for dynamic calling"""
    def decorator(func):
        FUNCTION_REGISTRY[name] = func
        return func
    return decorator

# Helpers moved here so both handlers and functions can use/import
def get_platform_default_directory():
    """Get a simple default starting directory: home if exists else current working directory"""
    try:
        home = os.path.expanduser("~")
        if home and os.path.isdir(home):
            return os.path.abspath(home)
    except Exception:
        pass
    return os.getcwd()

def get_path_or_platform_default(path):
    if path in [".", "", None]:
        path = get_platform_default_directory()
        logger.info(f"Using platform default directory: {path}")
    return path

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
        system_info = platform.system()
        if system_info == "Darwin":
            system_name = "macOS"
        elif system_info == "Linux":
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

        shell_info = "Unknown shell"
        try:
            shell_env = os.environ.get('SHELL', '')
            if shell_env:
                shell_info = os.path.basename(shell_env)
            else:
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

@register_function("get_os_aware_default_path")
async def get_os_aware_default_path():
    """Return default path for the current OS: home directory if exists, else cwd"""
    path = get_platform_default_directory()
    if not path.endswith(os.sep):
        path += os.sep
    return {"path": path}

@register_function("create_directory")
async def create_directory(path: str, name: str):
    """Create a directory at the given path with the provided name."""
    try:
        if not name or not str(name).strip():
            raise ValueError("Folder name cannot be empty")

        base_dir = Path(get_path_or_platform_default(path)).expanduser().resolve()
        folder_name = str(name).strip()

        target_path = Path(folder_name).expanduser()
        if not target_path.is_absolute():
            target_path = (base_dir / folder_name)

        existed_before = target_path.exists()
        target_path.mkdir(parents=True, exist_ok=True)

        full_path = str(target_path)
        if not full_path.endswith(os.sep):
            full_path += os.sep

        return {
            "path": full_path,
            "created": not existed_before,
            "exists": True
        }
    except Exception as error:
        logger.error(f"Error creating directory: {str(error)}")
        raise

# Backward-compatibility aliases (can be removed once callers switch to snake_case)
FUNCTION_REGISTRY["getOSAwareDefaultPath"] = get_os_aware_default_path
FUNCTION_REGISTRY["createDirectory"] = create_directory

@register_function("execute_shell_command")
async def execute_shell_command(command: str, timeout: int = 120, root_path: str = "", client_instance=None):
    """Execute a shell command and return the full result when complete"""
    if not client_instance:
        raise ValueError("No client instance available")
    try:
        shell = ShellProcess()
        import uuid
        block_id = str(uuid.uuid4())
        todo_id = ""
        message_id = ""
        logger.info(f"Executing shell command via function call: {command[:50]}...")
        await shell.execute_block(block_id, command, client_instance, todo_id, message_id, timeout, root_path)
        full_output = ""
        while block_id in shell.processes:
            await asyncio.sleep(0.1)
        if hasattr(shell, '_output_buffer') and block_id in shell._output_buffer:
            full_output = shell._output_buffer[block_id].get_output()
            del shell._output_buffer[block_id]
        return {
            "command": command,
            "result": full_output,
            "success": True
        }
    except Exception as error:
        logger.error(f"Error executing shell command: {str(error)}")
        return {
            "command": command,
            "result": str(error),
            "success": False,
            "error": str(error)
        }

@register_function("download_attachment")
async def download_attachment(attachmentId: str, filePath: str, rootPath: str = "", client_instance=None):
    """Download an attachment from the backend API to the local filesystem."""
    if not client_instance:
        raise ValueError("Client instance required for download_attachment")

    api_url = getattr(client_instance, "api_url", "").rstrip("/")
    api_key = getattr(client_instance, "api_key", "")
    if not api_url or not api_key:
        raise ValueError("Missing API credentials for attachment download")

    base_path = Path(get_path_or_platform_default(rootPath or ""))
    target_path = Path(filePath).expanduser()
    if not target_path.is_absolute():
        target_path = base_path / target_path
    target_path = target_path.resolve()
    target_path.parent.mkdir(parents=True, exist_ok=True)

    url = f"{api_url}/api/v1/files/{attachmentId}"
    headers = {"x-api-key": api_key}

    try:
        response = requests.get(url, headers=headers, timeout=60)
        if response.status_code >= 400:
            return {
                "success": False,
                "error": f"Backend responded with {response.status_code}: {response.text}"
            }

        with open(target_path, "wb") as file:
            file.write(response.content)

        return {
            "success": True,
            "path": str(target_path),
            "bytes": len(response.content)
        }
    except Exception as error:
        logger.error(f"Error downloading attachment {attachmentId}: {error}")
        return {
            "success": False,
            "error": str(error)
        }

@register_function("download_chat")
async def download_chat(todoId: str, client_instance=None):
    """Download a todo with all its messages from the backend."""
    if not client_instance:
        raise ValueError("Client instance required")

    api_url = getattr(client_instance, "api_url", "").rstrip("/")
    api_key = getattr(client_instance, "api_key", "")
    if not api_url or not api_key:
        raise ValueError("Missing API credentials")

    url = f"{api_url}/api/v1/todos/{todoId}"
    headers = {"x-api-key": api_key}

    try:
        response = requests.get(url, headers=headers, timeout=60)
        if response.status_code >= 400:
            return {"success": False, "error": f"Backend responded with {response.status_code}: {response.text}"}
        return {"success": True, "todo": response.json()}
    except Exception as error:
        logger.error(f"Error downloading chat {todoId}: {error}")
        return {"success": False, "error": str(error)}

@register_function("register_attachment")
async def register_attachment(
    filePath: str,
    userId: str = "test-user",
    isPublic: bool = False,
    agentSettingsId: str = "",
    todoId: str = "",
    rootPath: str = "",
    client_instance=None,
):
    """Upload a local file to the backend attachment endpoint."""
    if not client_instance:
        raise ValueError("Client instance required for register_attachment")

    api_url = getattr(client_instance, "api_url", "").rstrip("/")
    api_key = getattr(client_instance, "api_key", "")
    if not api_url or not api_key:
        raise ValueError("Missing API credentials for attachment upload")

    base_path = Path(get_path_or_platform_default(rootPath or ""))
    target_path = Path(filePath).expanduser()
    if not target_path.is_absolute():
        target_path = base_path / target_path
    target_path = target_path.resolve()

    if not target_path.exists() or not target_path.is_file():
        return {"success": False, "error": f"File not found: {target_path}"}

    upload_endpoint = f"{api_url}/api/v1/files/register"
    headers = {"x-api-key": api_key}

    data = {}
    if userId:
        data["userId"] = userId
    if agentSettingsId:
        data["agentSettingsId"] = agentSettingsId
    if todoId:
        data["todoId"] = todoId
    data["isPublic"] = "true" if isPublic else "false"

    files = {"file": (target_path.name, target_path.read_bytes())}

    try:
        response = requests.post(upload_endpoint, headers=headers, data=data, files=files, timeout=60)
    except Exception as error:
        logger.error(f"Error uploading attachment {target_path}: {error}")
        return {"success": False, "error": str(error)}

    if response.status_code >= 400:
        return {
            "success": False,
            "error": f"Backend responded with {response.status_code}: {response.text}"
        }

    try:
        payload = response.json()
    except Exception:
        payload = {}

    attachment_id = payload.get("attachmentId")

    return {
        "success": True,
        "attachmentId": attachment_id,
        "response": payload
    }

@register_function("read_file_base64")
async def read_file_base64(
    path: str,
    rootPath: str = "",
    fallbackRootPaths: Optional[List[str]] = None,
    client_instance=None,
    **_: Any,
):
    """Read a file as binary and return base64 content."""
    fallbackRootPaths = fallbackRootPaths or []
    full_path = resolve_file_path(path, rootPath, fallbackRootPaths)

    try:
        if client_instance and hasattr(client_instance, "edge_config"):
            if not is_path_allowed(full_path, client_instance.edge_config.config):
                return {"success": False, "error": f"No permission to access the given file {full_path}"}
    except Exception as error:
        logger.warning(f"Path permission check failed for {full_path}: {error}")

    if not os.path.exists(full_path):
        return {"success": False, "error": f"File not found: {full_path}"}

    max_bytes = 50_000_000  # 50MB
    size = os.path.getsize(full_path)
    if size > max_bytes:
        return {"success": False, "error": f"File too large: {size:,} bytes (max {max_bytes:,})"}

    try:
        with open(full_path, "rb") as f:
            data = f.read()
        encoded = base64.b64encode(data).decode("ascii")
        return {"success": True, "path": full_path, "base64": encoded, "bytes": len(data)}
    except Exception as error:
        logger.error(f"Error reading binary file {full_path}: {error}")
        return {"success": False, "error": str(error)}

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
    servers = []
    if hasattr(client_instance.mcp_collector, 'clients'):
        servers = list(client_instance.mcp_collector.clients.keys())
    return {
        "servers": servers,
        "count": len(servers),
        "description": "List of connected MCP servers"
    }

@register_function("mcp_install_server")
async def mcp_install_server(serverId: str, command: str, args: List[str] = None, env: Dict[str, str] = None, client_instance=None):
    """Install or register an MCP server on the edge using the MCPCollector."""
    if not client_instance:
        raise ValueError("Client instance required")
    if args is None:
        args = []
    if env is None:
        env = {}
    server_id = str(serverId).strip()
    if not server_id:
        raise ValueError("serverId is required")
    cmd = str(command).strip()
    if not cmd:
        raise ValueError("command is required")

    logger.info(f"Updating MCP server '{server_id}' with command='{cmd}', args={args}, env_keys={list(env.keys())}")

    if not getattr(client_instance, 'mcp_collector', None):
        from .mcp_collector import MCPCollector
        client_instance.mcp_collector = MCPCollector(client_instance.edge_config)

    mcp_json = dict(client_instance.edge_config.config.safe_get("mcp_json", {}))
    logger.info(f'mcp_json: {mcp_json}')

    if "mcpServers" not in mcp_json:
        mcp_json["mcpServers"] = {}

    mcp_json["mcpServers"][server_id] = {
        "command": cmd,
        "args": args,
        "env": env
    }
    logger.info(f'mcp_json after update: {mcp_json}')

    current_installed = dict(client_instance.edge_config.config.safe_get("installedMCPs", {}))
    prev_entry = current_installed.get(server_id, {})
    is_new_installation = not prev_entry or not prev_entry.get("tools")
    current_installed[server_id] = {
        **prev_entry,
        "serverId": server_id,
        "id": prev_entry.get("id", server_id),
        "command": cmd,
        "args": args,
        "env": {**(prev_entry.get("env", {})), **env},
        "tools": prev_entry.get("tools", []),
        "registryId": prev_entry.get("registryId", server_id),
        "status": "INSTALLING" if is_new_installation else "STARTING",
    }

    client_instance.edge_config.config.update_value({
        "mcp_json": mcp_json,
        "installedMCPs": current_installed
    })

    return {
        "installed": True,
        "serverId": server_id,
        "command": cmd,
        "args": args,
        "env_keys": list(env.keys())
    }

@register_function("mcp_uninstall_server")
async def mcp_uninstall_server(serverId: str, client_instance=None):
    """Uninstall/remove an MCP server from the edge completely."""
    if not client_instance:
        raise ValueError("Client instance required")
    server_id = str(serverId).strip()
    if not server_id:
        raise ValueError("serverId is required")

    logger.info(f"Uninstalling MCP server '{server_id}'")

    mcp_json = dict(client_instance.edge_config.config.safe_get("mcp_json", {}))
    if "mcpServers" in mcp_json and server_id in mcp_json["mcpServers"]:
        del mcp_json["mcpServers"][server_id]
        logger.info(f"Removed '{server_id}' from mcp_json mcpServers")

    current_installed = dict(client_instance.edge_config.config.safe_get("installedMCPs", {}))
    if server_id in current_installed:
        del current_installed[server_id]
        logger.info(f"Removed '{server_id}' from installedMCPs")

    client_instance.edge_config.config.update_value({
        "mcp_json": mcp_json,
        "installedMCPs": current_installed
    })

    return {
        "uninstalled": True,
        "serverId": server_id,
        "message": f"MCP server '{server_id}' has been completely removed"
    }