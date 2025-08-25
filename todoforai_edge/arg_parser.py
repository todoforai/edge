#!/usr/bin/env python3
import argparse
import getpass
import sys
import subprocess
from .config import default_config

def _get_package_version():
    try:
        result = subprocess.run(
            ["python", "-m", "pip", "show", "todoforai-edge-cli"],
            capture_output=True, text=True, check=True
        )
        for line in result.stdout.split('\n'):
            if line.startswith('Version:'):
                return line.split(':', 1)[1].strip()
    except Exception:
        pass
    return "unknown"

def create_argparse_apply_config():
    config = default_config()
    parser = argparse.ArgumentParser(description="TODOforAI Edge CLI")
    
    # Version flag (lazy resolution only when requested)
    parser.add_argument("--version", "-V", action="store_true", help="Show version and exit")
    
    # Authentication arguments
    parser.add_argument("--email", help="Email for authentication")
    parser.add_argument("--password", help="Password for authentication")
    parser.add_argument("--api-key", help="API key (if already authenticated)")
    
    # Configuration arguments
    parser.add_argument("--api-url", help="API URL")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    
    # Workspace management
    parser.add_argument("--add-path", dest="add_workspace_path", help="Add a workspace path to the edge configuration")
    
    args = parser.parse_args()

    if args.version:
        print(_get_package_version())
        sys.exit(0)
    
    # Priority logic: if email/password args provided, clear env API key
    if args.email is not None or args.password is not None:
        config.api_key = ""
    
    config.update_from_args(args)
    
    # Print server info early, before requesting credentials
    print(f'Connecting to: {config.api_url}')
    
    # Interactive credential prompts if not provided
    if not config.api_key:
        if not config.email:
            try:
                config.email = input("Email: ").strip()
            except KeyboardInterrupt:
                print("\nOperation cancelled.")
                sys.exit(1)
        
        if not config.password and config.email:
            try:
                config.password = getpass.getpass("Password: ")
            except KeyboardInterrupt:
                print("\nOperation cancelled.")
                sys.exit(1)
    
    if config.email:
        print(f'Email: {config.email}')
    if config.api_key:
        print(f'Using API key: {config.api_key[:8]}...')
    
    return config
