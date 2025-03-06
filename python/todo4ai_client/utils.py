import os
import json
import base64
import platform
import subprocess
import asyncio
import requests
import logging

logger = logging.getLogger("todo4ai-client")

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
    """
    Make an asynchronous HTTP request to the API
    
    Args:
        client: The Todo4AIClient instance
        method: HTTP method (get, post, patch, etc.)
        endpoint: API endpoint (starting with /)
        data: Optional data to send (for POST, PATCH, etc.)
        
    Returns:
        Response object or None if failed
    """
    if not client.api_key:
        logger.warning("Cannot make API request: missing API key")
        return None
        
    headers = {"X-API-Key": client.api_key, "Content-Type": "application/json"}
    url = f"{client.api_url}{endpoint}"
    
    try:
        # Use asyncio to run the request without blocking
        loop = asyncio.get_event_loop()
        
        if method.lower() == 'get':
            response = await loop.run_in_executor(
                None, 
                lambda: requests.get(url, headers=headers)
            )
        elif method.lower() == 'post':
            response = await loop.run_in_executor(
                None, 
                lambda: requests.post(url, headers=headers, json=data)
            )
        elif method.lower() == 'patch':
            response = await loop.run_in_executor(
                None, 
                lambda: requests.patch(url, headers=headers, json=data)
            )
        elif method.lower() == 'put':
            response = await loop.run_in_executor(
                None, 
                lambda: requests.put(url, headers=headers, json=data)
            )
        elif method.lower() == 'delete':
            response = await loop.run_in_executor(
                None, 
                lambda: requests.delete(url, headers=headers)
            )
        else:
            logger.error(f"Unsupported HTTP method: {method}")
            return None
            
        if response.status_code >= 400:
            logger.error(f"API request failed: {response.status_code} - {response.text}")
            return None
            
        return response
        
    except Exception as error:
        logger.error(f"Error making API request: {str(error)}")
        return None