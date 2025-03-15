#!/usr/bin/env python3
import os
import sys
import subprocess
import platform
import json

def register_protocol_handler():
    """Register the application as a protocol handler for 'todoforai://' URLs"""
    app_path = os.path.abspath(sys.argv[0])
    protocol_name = "todoforai"
    
    if platform.system() == "Windows":
        import winreg
        
        # Create registry entries for the protocol
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"Software\\Classes\\{protocol_name}") as key:
            winreg.SetValueEx(key, None, 0, winreg.REG_SZ, f"URL:{protocol_name} Protocol")
            winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
            
        # Set the command to execute
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, f"Software\\Classes\\{protocol_name}\\shell\\open\\command") as key:
            winreg.SetValueEx(key, None, 0, winreg.REG_SZ, f'"{app_path}" "%1"')
            
        print(f"Registered {protocol_name}:// protocol handler for Windows")
        return True
        
    elif platform.system() == "Linux":
        # Create desktop entry file
        desktop_file = os.path.expanduser(f"~/.local/share/applications/{protocol_name}-handler.desktop")
        
        with open(desktop_file, "w") as f:
            f.write(f"""[Desktop Entry]
Name=TodoForAI Edge
Exec="{app_path}" %u
Type=Application
Terminal=false
MimeType=x-scheme-handler/{protocol_name};
""")
        
        # Register the MIME type
        subprocess.run(["xdg-mime", "default", f"{protocol_name}-handler.desktop", f"x-scheme-handler/{protocol_name}"])
        
        print(f"Registered {protocol_name}:// protocol handler for Linux")
        return True
        
    elif platform.system() == "Darwin":  # macOS
        plist_file = os.path.expanduser(f"~/Library/Preferences/com.{protocol_name}.plist")
        
        # Use defaults command to register the protocol
        subprocess.run([
            "defaults", "write", f"com.{protocol_name}", "CFBundleURLTypes", 
            f"-array '{{CFBundleURLName=\"{protocol_name}\"; CFBundleURLSchemes=(\"{protocol_name}\");}}'"])
            
        # Associate the app with the protocol
        subprocess.run([
            "defaults", "write", f"com.{protocol_name}", "CFBundleURLTypes", 
            f"-array '{{CFBundleURLName=\"{protocol_name}\"; CFBundleTypeRole=\"Viewer\"; CFBundleURLSchemes=(\"{protocol_name}\");}}'"])
            
        print(f"Registered {protocol_name}:// protocol handler for macOS")
        return True
        
    else:
        print(f"Protocol handler registration not supported on {platform.system()}")
        return False

def handle_protocol_url(url):
    """Handle a protocol URL like todoforai://command/param1/param2"""
    if not url.startswith("todoforai://"):
        return False
        
    # Strip the protocol prefix
    path = url[len("todoforai://"):]
    
    # Parse the command and parameters
    parts = path.split('/')
    command = parts[0] if parts else ""
    params = parts[1:] if len(parts) > 1 else []
    
    print(f"Handling command: {command} with params: {params}")
    
    # Handle different commands
    if command == "connect":
        # Example: todoforai://connect/workspace_id
        if params:
            workspace_id = params[0]
            print(f"Connecting to workspace: {workspace_id}")
            return True
    
    elif command == "auth":
        # Example: todoforai://auth/apikey/YOUR_API_KEY_HERE
        if len(params) >= 2 and params[0] == "apikey":
            api_key = params[1]
            print(f"Authenticating with API key: {api_key[:5]}...")
            
            # Set environment variable for this session
            os.environ["TODO4AI_API_KEY"] = api_key
            print("API key set for this session")
            
            return True
    
    elif command == "open":
        # Example: todoforai://open/file_path
        if params:
            file_path = '/'.join(params)
            print(f"Opening file: {file_path}")
            return True
    
    return False
