import os
import json
import base64
import platform
import subprocess
import logging
import requests
import sys
from typing import List, Dict, Any, Optional, Callable
from pathlib import Path

logger = logging.getLogger("todoforai-edge")

def findBy(items: List[Dict[str, Any]], condition: Callable[[Dict[str, Any]], bool]) -> Optional[Dict[str, Any]]:
    """
    Find first item matching the condition function.
    
    Usage:
        findBy(agents, lambda x: 'edge' in x['name'].lower())
        findBy(projects, lambda x: 'email' in x['project']['name'].lower())
        findBy(items, lambda x: x.get('status') == 'active')
    """
    return next((item for item in items if condition(item)), None)

def safe_print(s):
    """Safely print strings that may contain emojis or unicode characters"""
    try:
        sys.stdout.write(s + "\n")
    except Exception:
        sys.stdout.write((s.encode('ascii', 'ignore').decode('ascii')) + "\n")

def generate_machine_fingerprint():
    """Generate a unique fingerprint for this edge based on machine characteristics"""
    identifiers = {}
    
    # Basic system info (OS, architecture, hostname)
    identifiers["platform"] = platform.system()
    identifiers["machine"] = platform.machine()
    identifiers["node"] = platform.node()
    
    # Add CPU info
    identifiers["processor"] = platform.processor()
    
    # Add more stable identifiers based on OS
    if platform.system() == "Linux":
        # Try to get machine-id (stable across reboots)
        try:
            if os.path.exists("/etc/machine-id"):
                with open("/etc/machine-id", "r") as f:
                    identifiers["machine_id"] = f.read().strip()
        except Exception:
            pass
    elif platform.system() == "Darwin":  # macOS
        try:
            result = subprocess.run(["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"], 
                                capture_output=True, text=True, check=False)
            for line in result.stdout.splitlines():
                if "IOPlatformUUID" in line:
                    identifiers["hardware_uuid"] = line.split('=')[1].strip().strip('"')
                    break
        except Exception:
            pass
    elif platform.system() == "Windows":
        try:
            result = subprocess.run(["wmic", "csproduct", "get", "UUID"], 
                                capture_output=True, text=True, check=False)
            if result.stdout:
                identifiers["hardware_uuid"] = result.stdout.splitlines()[1].strip()
        except Exception:
            pass
    
    # Encode as base64 for transmission
    return base64.b64encode(json.dumps(identifiers).encode()).decode()

async def async_request(edge, method, endpoint, data=None):
    """Make an async request to the API"""
    if not edge.api_key:
        raise ValueError("Cannot make API request: missing API key")
        
    url = f"{edge.api_url}{endpoint}"
    headers = {
        "content-type": "application/json",
        "x-api-key": f"{edge.api_key}"
        }
    
    if method.lower() == 'get':
        response = requests.get(url, headers=headers, timeout=30)
    elif method.lower() == 'post':
        response = requests.post(url, headers=headers, json=data, timeout=30)
    elif method.lower() == 'put':
        response = requests.put(url, headers=headers, json=data, timeout=30)
    elif method.lower() == 'patch':
        response = requests.patch(url, headers=headers, json=data, timeout=30)
    elif method.lower() == 'delete':
        response = requests.delete(url, headers=headers, timeout=30)
    else:
        raise ValueError(f"Unsupported HTTP method: {method}")
        
    if response.status_code >= 400:
        raise Exception(f"API request failed with status {response.status_code}: {response.text}")
        
    return response


def normalize_api_url(api_url: str) -> str:
    if api_url.startswith("localhost"):
        return f"http://{api_url}"
    elif not api_url.startswith(("http://", "https://")):
        return f"https://{api_url}"
    return api_url

def get_mcp_config_paths() -> List[str]:
    """Get list of potential MCP config paths in priority order"""
    paths = []
    
    # 0. Environment override (highest priority)
    env_path = os.environ.get("TODOFORAI_MCP_CONFIG") or os.environ.get("MCP_CONFIG_PATH")
    if env_path:
        paths.append(os.path.expanduser(env_path))

    # 1. Current directory
    paths.append("mcp.json")
    
    # 3. Global config (if running as system service, Unix-like only)
    if platform.system() != "Windows":
        paths.append("/etc/todoforai/mcp.json")

    # 2. User config directory (OS-specific)
    if platform.system() == "Darwin":  # macOS
        paths.append(os.path.expanduser("~/Library/Application Support/todoforai/mcp.json"))
    elif platform.system() == "Windows":
        paths.append(os.path.expanduser("~/AppData/Local/todoforai/mcp.json"))
    else:  # Linux and others
        # Follow XDG Base Directory specification
        xdg_config = os.environ.get("XDG_CONFIG_HOME", os.path.expanduser("~/.config"))
        paths.append(os.path.join(xdg_config, "todoforai/mcp.json"))
    
    
    return paths

def find_mcp_config() -> Optional[str]:
    """Find the first existing MCP config file from standard locations"""
    for config_path in get_mcp_config_paths():
        if os.path.exists(config_path):
            logger.info(f"Found mcp.json at: {config_path}")
            return config_path
    
    logger.debug("No mcp.json found in any standard location")
    return None

def ensure_mcp_config_exists() -> Optional[str]:
    """Ensure an MCP config file exists. If none found, create one in the user config path."""
    existing = find_mcp_config()
    if existing:
        return existing

    paths = get_mcp_config_paths()

    # Prefer the user-level path (index 2: after env override and cwd)
    target_path = paths[-1] if len(paths) > 0 else "mcp.json"

    try:
        target_dir = os.path.dirname(target_path)
        if target_dir and not os.path.exists(target_dir):
            os.makedirs(target_dir, exist_ok=True)

        with open(target_path, "w", encoding="utf-8") as f:
            json.dump({"mcpServers": {}}, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Created default MCP config at: {target_path}")
        return target_path
    except Exception as e:
        logger.error(f"Failed to create default MCP config at {target_path}: {e}")
        return None
