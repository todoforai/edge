import os
import asyncio
import logging
import platform
import base64
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional
import requests
from .handlers.shell_handler import _get_windows_shell
from .handlers.path_utils import resolve_file_path
from .errors import ExpectedFunctionError

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
        "count": len(FUNCTION_REGISTRY),
    }


@register_function("get_current_directory")
async def get_current_directory():
    """Get the current working directory"""
    return {"current_directory": os.getcwd()}


@register_function("get_environment_variable")
async def get_environment_variable(var_name: str):
    """Get an environment variable value"""
    return {"variable": var_name, "value": os.environ.get(var_name, None)}


@register_function("get_system_info")
async def get_system_info():
    """Get system information including OS and shell"""
    try:
        system_info = platform.system()
        if system_info == "Darwin":
            system_name = "macOS"
        elif system_info == "Linux":
            try:
                with open("/etc/os-release", "r") as f:
                    lines = f.readlines()
                    for line in lines:
                        if line.startswith("PRETTY_NAME="):
                            system_name = line.split("=")[1].strip().strip('"')
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
            if system_info == "Windows":
                _, shell_type = _get_windows_shell()
                shell_info = shell_type  # git_bash, bash, powershell, or cmd
            else:
                shell_env = os.environ.get("SHELL", "")
                if shell_env:
                    shell_info = os.path.basename(shell_env)
        except:
            pass

        return {"system": system_name, "shell": shell_info}
    except Exception as error:
        logger.error(f"Error getting system info: {str(error)}")
        return {
            "system": f"Unknown system (error: {str(error)})",
            "shell": "Unknown shell",
        }


@register_function("get_workspace_tree")
async def get_workspace_tree(path: str, max_depth: int = 2):
    """Shallow directory tree, tries `tree` command first, falls back to pure Python."""
    import subprocess

    root = Path(path).expanduser().resolve()
    if not root.is_dir():
        return {"tree": "", "is_git": False}

    is_git = (root / ".git").is_dir()

    # Try external tree on Unix if available
    if platform.system() != "Windows" and shutil.which("tree"):
        try:
            cmd = ["tree", "-L", str(max_depth), "--dirsfirst"]
            if is_git:
                cmd += ["--gitignore", "-I", ".git"]
            result = subprocess.run(
                cmd, cwd=str(root), capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                return {"tree": result.stdout.strip(), "is_git": is_git}
        except Exception:
            pass

    # Pure Python fallback
    return {"tree": _python_tree(root, max_depth), "is_git": is_git}


def _collect_gitignore_spec(root: Path):
    """Collect all .gitignore files under root into a single pathspec matcher."""
    import pathspec
    patterns = []
    for dirpath, dirnames, filenames in os.walk(root):
        # Don't descend into .git
        dirnames[:] = [d for d in dirnames if d != ".git"]
        if ".gitignore" in filenames:
            gi_path = Path(dirpath) / ".gitignore"
            try:
                rel_dir = Path(dirpath).relative_to(root)
                prefix = "" if rel_dir == Path(".") else str(rel_dir).replace(os.sep, "/") + "/"
                for line in gi_path.read_text(errors="replace").splitlines():
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    # Prefix nested gitignore patterns with their directory
                    if prefix:
                        if line.startswith("!"):
                            patterns.append("!" + prefix + line[1:])
                        else:
                            patterns.append(prefix + line)
                    else:
                        patterns.append(line)
            except Exception:
                pass
    return pathspec.GitIgnoreSpec.from_lines(patterns) if patterns else None


def _python_tree(root: Path, max_depth: int) -> str:
    """Render a tree string with dirs first, respecting .gitignore and max_depth."""
    spec = _collect_gitignore_spec(root)
    lines = [root.name + "/"]

    def _is_ignored(entry: Path) -> bool:
        if entry.name == ".git":
            return True
        if spec is None:
            return False
        rel = str(entry.relative_to(root)).replace(os.sep, "/")
        if entry.is_dir():
            rel += "/"
        return spec.match_file(rel)

    def _walk(dir_path: Path, prefix: str, depth: int):
        if depth > max_depth:
            return
        try:
            entries = sorted(dir_path.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        except PermissionError:
            return
        visible = [e for e in entries if not _is_ignored(e)]
        for i, entry in enumerate(visible):
            is_last = i == len(visible) - 1
            connector = "└── " if is_last else "├── "
            suffix = "/" if entry.is_dir() else ""
            lines.append(f"{prefix}{connector}{entry.name}{suffix}")
            if entry.is_dir():
                extension = "    " if is_last else "│   "
                _walk(entry, prefix + extension, depth + 1)

    _walk(root, "", 1)
    return "\n".join(lines)


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
            target_path = base_dir / folder_name

        existed_before = target_path.exists()
        target_path.mkdir(parents=True, exist_ok=True)

        full_path = str(target_path)
        if not full_path.endswith(os.sep):
            full_path += os.sep

        return {"path": full_path, "created": not existed_before, "exists": True}
    except Exception as error:
        logger.error(f"Error creating directory: {str(error)}")
        raise


# Backward-compatibility aliases (can be removed once callers switch to snake_case)
FUNCTION_REGISTRY["getOSAwareDefaultPath"] = get_os_aware_default_path
FUNCTION_REGISTRY["createDirectory"] = create_directory


@register_function("execute_shell_command")
async def execute_shell_command(
    cmd: str, timeout: int = 120, root_path: str = "",
    todoId: str = "", messageId: str = "", blockId: str = "",
    client_instance=None,
):
    """Execute a shell command via ShellProcess (PTY + stdin support).

    Routes through the same ShellProcess used by frontend-initiated blocks so
    that users can send keyboard input to agent-initiated shell blocks.
    Sends sh_done with runMode="internal" so the backend skips finalization.
    """
    from .constants.messages import shell_block_start_result_msg
    from .handlers.shell_handler import ShellProcess, _output_buffers, _completion_events, _pending_tool_approvals

    can_stream = bool(todoId and blockId and client_instance)

    if not can_stream:
        # Fallback: no streaming context — use simple subprocess
        return await _execute_shell_simple(cmd, timeout, root_path)

    try:
        logger.info(f"Executing shell command via ShellProcess: {cmd[:50]}...")

        # Send shell start message so frontend shows the block
        await client_instance.send_response(
            shell_block_start_result_msg(todoId, blockId, "execute", messageId)
        )

        # Create completion event before starting the process
        completion_event = asyncio.Event()
        _completion_events[blockId] = completion_event

        # Execute via ShellProcess (PTY, stdin, streaming all handled)
        shell = ShellProcess()
        await shell.execute_block(
            blockId, cmd, client_instance, todoId, messageId, timeout,
            root_path=root_path, run_mode="internal",
        )

        # If execute_block sent AWAITING_APPROVAL for missing tools, don't
        # return a result — let handle_function_call_request suppress the
        # response so the block stays in AWAITING_APPROVAL until the user
        # approves via the frontend.
        if blockId in _pending_tool_approvals:
            return {"__awaiting_approval__": True}

        # Wait for process to finish (signalled by _wait_for_process)
        try:
            await asyncio.wait_for(completion_event.wait(), timeout=timeout + 5)
        except asyncio.TimeoutError:
            logger.warning(f"Completion event timed out for block {blockId}")

        # Collect output from the shared global buffer
        buf = _output_buffers.get(blockId)
        output = buf.get_output() if buf else ""

        return {"cmd": cmd, "result": output}
    except ExpectedFunctionError:
        raise
    except Exception as error:
        logger.error(f"Error executing shell command: {str(error)}")
        raise ExpectedFunctionError(f"Shell command failed: {error}")
    finally:
        # Clean up completion event and output buffer
        _completion_events.pop(blockId, None)
        _output_buffers.pop(blockId, None)


async def _execute_shell_simple(cmd: str, timeout: int = 120, root_path: str = ""):
    """Simple subprocess fallback when no streaming context is available."""
    import tempfile

    try:
        default_cwd = os.path.join(tempfile.gettempdir(), "todoforai")
        os.makedirs(default_cwd, exist_ok=True)
        cwd = default_cwd
        if root_path:
            expanded = os.path.expanduser(root_path)
            if os.path.isdir(expanded):
                cwd = expanded

        if os.name == 'nt':
            shell_cmd, _ = _get_windows_shell()
            shell_cmd = shell_cmd + [cmd]
        else:
            shell_cmd = ['/bin/bash', '-c', cmd]

        process = await asyncio.create_subprocess_exec(
            *shell_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=cwd,
        )

        stdout, _ = await asyncio.wait_for(process.communicate(), timeout=timeout)
        output = stdout.decode("utf-8", errors="replace") if stdout else ""
        return {"cmd": cmd, "result": output}
    except asyncio.TimeoutError:
        raise ExpectedFunctionError(f"Shell command timed out after {timeout}s")
    except Exception as error:
        logger.error(f"Error executing shell command (simple): {str(error)}")
        raise ExpectedFunctionError(f"Shell command failed: {error}")


@register_function("download_attachment")
async def download_attachment(
    attachmentId: str, path: str = "", rootPath: str = "", client_instance=None,
):
    """Download an attachment from the backend API to the local filesystem."""
    if not client_instance:
        raise ValueError("Client instance required for download_attachment")
    if not path:
        raise ValueError("No file path provided")

    api_url = getattr(client_instance, "api_url", "").rstrip("/")
    api_key = getattr(client_instance, "api_key", "")
    if not api_url or not api_key:
        raise ValueError("Missing API credentials for attachment download")

    base_path = Path(get_path_or_platform_default(rootPath or ""))
    target_path = Path(path).expanduser()
    if not target_path.is_absolute():
        target_path = base_path / target_path
    target_path = target_path.resolve()
    target_path.parent.mkdir(parents=True, exist_ok=True)

    url = f"{api_url}/api/v1/files/{attachmentId}"
    headers = {"x-api-key": api_key}

    try:
        response = requests.get(url, headers=headers, timeout=60)
        if response.status_code >= 400:
            raise ExpectedFunctionError(f"Backend responded with {response.status_code}: {response.text}")

        with open(target_path, "wb") as file:
            file.write(response.content)

        return {
            "path": str(target_path),
            "bytes": len(response.content),
        }
    except ExpectedFunctionError:
        raise
    except Exception as error:
        logger.error(f"Error downloading attachment {attachmentId}: {error}")
        raise ExpectedFunctionError(f"Download failed: {error}")


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
            raise ExpectedFunctionError(f"Backend responded with {response.status_code}: {response.text}")
        return {"todo": response.json()}
    except ExpectedFunctionError:
        raise
    except Exception as error:
        logger.error(f"Error downloading chat {todoId}: {error}")
        raise ExpectedFunctionError(f"Download chat failed: {error}")


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
        raise ExpectedFunctionError(f"File not found: {target_path}")

    upload_endpoint = f"{api_url}/api/v1/resources/register"
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
        response = requests.post(
            upload_endpoint, headers=headers, data=data, files=files, timeout=60
        )
    except Exception as error:
        logger.error(f"Error uploading attachment {target_path}: {error}")
        raise ExpectedFunctionError(f"Upload failed: {error}")

    if response.status_code >= 400:
        raise ExpectedFunctionError(f"Backend responded with {response.status_code}: {response.text}")

    try:
        payload = response.json()
    except Exception:
        payload = {}

    attachment_id = payload.get("attachmentId")

    return {"attachmentId": attachment_id, "response": payload}


@register_function("read_file")
async def read_file(
    path: str,
    rootPath: str = "",
    fallbackRootPaths: Optional[List[str]] = None,
    client_instance=None,
    **_: Any,
):
    """Read a file and return plain text content."""
    from .handlers.handlers import (
        read_file_content,
    )  # lazy import to avoid circular dependency

    fallbackRootPaths = fallbackRootPaths or []
    result = await read_file_content(path, rootPath, fallbackRootPaths, client_instance)
    if not result.get("success"):
        raise ExpectedFunctionError(result.get("error", "Unknown read error"))
    return {k: v for k, v in result.items() if k != "success"}


@register_function("create_file")
async def create_file(
    path: str,
    content: str,
    rootPath: str = "",
    fallbackRootPaths: Optional[List[str]] = None,
    client_instance=None,
    **_: Any,
):
    """Create a new file with the specified content."""
    fallbackRootPaths = fallbackRootPaths or []
    full_path = resolve_file_path(path, rootPath, fallbackRootPaths)

    # Create parent directories if needed
    dirname = os.path.dirname(full_path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)

    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    return {"path": full_path, "bytes": len(content.encode("utf-8"))}


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

    if not os.path.exists(full_path):
        raise ExpectedFunctionError(f"File not found: {full_path}")

    max_bytes = 50_000_000  # 50MB
    size = os.path.getsize(full_path)
    if size > max_bytes:
        raise ExpectedFunctionError(
            f"File too large: {size:,} bytes (max {max_bytes:,})"
        )

    with open(full_path, "rb") as f:
        data = f.read()
    encoded = base64.b64encode(data).decode("ascii")
    return {"path": full_path, "base64": encoded, "bytes": len(data)}


@register_function("search_files")
async def search_files(
    pattern: str,
    path: str = ".",
    root_path: str = "",
    max_results: int = 100,
    glob: str = "",
    ignore_case: bool = True,
    client_instance=None,
    **_: Any,
):
    """Search file contents using ripgrep."""
    import shutil

    rg_path = shutil.which("rg")
    if not rg_path:
        raise ExpectedFunctionError("ripgrep (rg) not found. Install with: pip install ripgrep")

    # Resolve search directory
    search_path = os.path.expanduser(path)
    if not os.path.isabs(search_path) and root_path:
        search_path = os.path.join(root_path, search_path)
    search_path = os.path.abspath(search_path)

    if not os.path.exists(search_path):
        raise ExpectedFunctionError(f"Search path does not exist: {search_path}")

    cmd = [rg_path, "--no-heading", "--line-number", "--color=never"]
    if ignore_case:
        cmd.append("--ignore-case")
    if glob:
        cmd.extend(["--glob", glob])
    cmd.append(pattern)
    cmd.append(search_path)

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        output = stdout.decode("utf-8", errors="replace")

        if proc.returncode == 0:
            # Limit total number of result lines
            all_lines = [l for l in output.splitlines() if l.strip()]
            if len(all_lines) > max_results:
                truncated_count = len(all_lines) - max_results
                all_lines = all_lines[:max_results]
                truncation_msg = f"... ({truncated_count} more matches truncated)"
            else:
                truncation_msg = None
            
            # Make paths relative if close, truncate long lines for cleaner display
            if root_path:
                lines = []
                for line in all_lines:
                    if ":" in line:
                        # Format: /full/path/to/file.ext:line_num:content
                        file_part, _, rest = line.partition(":")
                        # Try to make relative if within 2 levels, otherwise keep absolute
                        try:
                            rel_path = os.path.relpath(file_part, root_path)
                            up_levels = rel_path.count("../")
                            if up_levels <= 2:
                                file_part = rel_path
                        except (ValueError, TypeError):
                            pass  # Keep absolute on error
                        # Truncate very long lines (keep file:line but limit content)
                        full_line = f"{file_part}:{rest}"
                        if len(full_line) > 300:
                            full_line = full_line[:300] + "..."
                        lines.append(full_line)
                    else:
                        lines.append(line)
                output = "\n".join(lines)
                if truncation_msg:
                    output += f"\n{truncation_msg}"
            else:
                output = "\n".join(all_lines)
                if truncation_msg:
                    output += f"\n{truncation_msg}"
            
            if len(output) > 100_000:
                output = output[:100_000] + "\n... (output truncated)"
            return {"result": output}
        elif proc.returncode == 1:
            return {"result": "No matches found."}
        else:
            err = stderr.decode("utf-8", errors="replace")
            raise ExpectedFunctionError(f"ripgrep error (exit {proc.returncode}): {err}")
    except asyncio.TimeoutError:
        raise ExpectedFunctionError("Search timed out after 30 seconds")
    except ExpectedFunctionError:
        raise
    except Exception as error:
        logger.error(f"Error running search_files: {error}")
        raise ExpectedFunctionError(f"Search failed: {error}")


@register_function("mcp_call_tool")
async def mcp_call_tool(
    tool_name: str, arguments: Dict[str, Any] = None, client_instance=None
):
    """Call an MCP tool with given arguments"""
    if (
        not hasattr(client_instance, "mcp_collector")
        or not client_instance.mcp_collector
    ):
        raise ValueError("No MCP collector available")
    if arguments is None:
        arguments = {}
    result = await client_instance.mcp_collector.call_tool(tool_name, arguments)
    return result


@register_function("mcp_list_servers")
async def mcp_list_servers(client_instance=None):
    """List all connected MCP servers with raw MCP structure"""
    if (
        not hasattr(client_instance, "mcp_collector")
        or not client_instance.mcp_collector
    ):
        raise ValueError("No MCP collector available")
    servers = []
    if hasattr(client_instance.mcp_collector, "clients"):
        servers = list(client_instance.mcp_collector.clients.keys())
    return {
        "servers": servers,
        "count": len(servers),
        "description": "List of connected MCP servers",
    }


@register_function("mcp_install_server")
async def mcp_install_server(
    serverId: str,
    command: str,
    args: List[str] = None,
    env: Dict[str, str] = None,
    client_instance=None,
):
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

    logger.info(
        f"Updating MCP server '{server_id}' with command='{cmd}', args={args}, env_keys={list(env.keys())}"
    )

    if not getattr(client_instance, "mcp_collector", None):
        from .mcp_collector import MCPCollector

        client_instance.mcp_collector = MCPCollector(client_instance.edge_config)

    mcp_json = dict(client_instance.edge_config.config.safe_get("mcp_json", {}))
    logger.info(f"mcp_json: {mcp_json}")

    if "mcpServers" not in mcp_json:
        mcp_json["mcpServers"] = {}

    mcp_json["mcpServers"][server_id] = {"command": cmd, "args": args, "env": env}
    logger.info(f"mcp_json after update: {mcp_json}")

    current_installed = dict(
        client_instance.edge_config.config.safe_get("installedMCPs", {})
    )
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

    client_instance.edge_config.config.update_value(
        {"mcp_json": mcp_json, "installedMCPs": current_installed}
    )

    return {
        "installed": True,
        "serverId": server_id,
        "command": cmd,
        "args": args,
        "env_keys": list(env.keys()),
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

    current_installed = dict(
        client_instance.edge_config.config.safe_get("installedMCPs", {})
    )
    if server_id in current_installed:
        del current_installed[server_id]
        logger.info(f"Removed '{server_id}' from installedMCPs")

    client_instance.edge_config.config.update_value(
        {"mcp_json": mcp_json, "installedMCPs": current_installed}
    )

    return {
        "uninstalled": True,
        "serverId": server_id,
        "message": f"MCP server '{server_id}' has been completely removed",
    }
