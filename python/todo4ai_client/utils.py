import os
import json
import base64
import platform
import subprocess

def generate_machine_fingerprint():
    """
    Generate a unique fingerprint for the client machine based on hardware and system information.
    
    Returns:
        str: Base64 encoded JSON string containing machine identifiers
    """
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