#!/usr/bin/env python3
import argparse
import getpass
import sys
from .config import default_config

def create_argparse_apply_config():
    config = default_config()
    parser = argparse.ArgumentParser(description="TodoForAI Edge CLI")
    
    # Authentication arguments
    parser.add_argument("--email", default=config.email, help="Email for authentication")
    parser.add_argument("--password", default=config.password, help="Password for authentication")
    parser.add_argument("--api-key", default=config.api_key, help="API key (if already authenticated)")
    
    # Configuration arguments
    parser.add_argument("--api-url", default=config.api_url, help="API URL")
    parser.add_argument("--debug", action="store_true", default=config.debug, help="Enable debug logging")
    
    # Workspace management
    parser.add_argument("--add-path", dest="add_workspace_path", help="Add a workspace path to the edge configuration")
    
    args = parser.parse_args()
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
