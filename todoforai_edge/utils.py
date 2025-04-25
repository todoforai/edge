import os
import json
import base64
import platform
import subprocess
import asyncio
import requests
import logging

logger = logging.getLogger("todoforai-edge")

def generate_machine_fingerprint():
    """Generate a unique fingerprint for this client"""
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
                                capture_output=True, text=True)
            for line in result.stdout.splitlines():
                if "IOPlatformUUID" in line:
                    identifiers["hardware_uuid"] = line.split('=')[1].strip().strip('"')
                    break
        except Exception:
            pass
    elif platform.system() == "Windows":
        try:
            result = subprocess.run(["wmic", "csproduct", "get", "UUID"], 
                                capture_output=True, text=True)
            if result.stdout:
                identifiers["hardware_uuid"] = result.stdout.splitlines()[1].strip()
        except Exception:
            pass
    
    # Encode as base64 for transmission
    return base64.b64encode(json.dumps(identifiers).encode()).decode()

async def async_request(client, method, endpoint, data=None):
    """Make an async request to the API"""
    if not client.api_key:
        logger.warning("Cannot make API request: missing API key")
        return None
        
    url = f"{client.api_url}{endpoint}"
    headers = {
        "content-type": "application/json",
        "x-api-key": f"{client.api_key}"
        }
    
    try:
        if method.lower() == 'get':
            response = requests.get(url, headers=headers)
        elif method.lower() == 'post':
            response = requests.post(url, headers=headers, json=data)
        elif method.lower() == 'put':
            response = requests.put(url, headers=headers, json=data)
        elif method.lower() == 'patch':
            response = requests.patch(url, headers=headers, json=data)
        elif method.lower() == 'delete':
            response = requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
            
        if response.status_code >= 400:
            raise Exception(f"API request failed with status {response.status_code}: {response.text}")
            
        return response
    except Exception as e:
        logging.error(f"API request error: {str(e)}")
        return None
