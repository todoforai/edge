import os
import json
import base64
import platform
import subprocess
import logging
import requests

logger = logging.getLogger("todoforai-edge")

def generate_machine_fingerprint(email: str):
    """Generate a unique fingerprint for this client including user account info"""
    identifiers = {}
    
    # Basic system info (OS, architecture, hostname)
    identifiers["platform"] = platform.system()
    identifiers["machine"] = platform.machine()
    identifiers["node"] = platform.node()
    
    # Add CPU info
    identifiers["processor"] = platform.processor()
    
    # Add user account information to make fingerprint unique per user
    if email:
        identifiers["user_email"] = email
    logger.info(f'Fingerprint generated with email: {email}')
    
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

async def async_request(client, method, endpoint, data=None):
    """Make an async request to the API"""
    if not client.api_key:
        raise ValueError("Cannot make API request: missing API key")
        
    url = f"{client.api_url}{endpoint}"
    headers = {
        "content-type": "application/json",
        "x-api-key": f"{client.api_key}"
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
