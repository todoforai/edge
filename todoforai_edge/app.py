#!/usr/bin/env python3
import os
import sys
import asyncio
import traceback
import tkinter as tk
from tkinter import messagebox

from todoforai_edge.client import TODOforAIEdge
from todoforai_edge.apikey import authenticate_and_get_api_key
from todoforai_edge.protocol_handler import register_protocol_handler, handle_protocol_url
from todoforai_edge.arg_parser import parse_args

async def run_app(protocol_url=None, api_key=None):
    """
    Main application entry point that handles both UI and CLI modes
    
    Args:
        protocol_url: Optional URL to handle (todoforai://...)
        api_key: Optional API key to use directly
        
    Returns:
        None
    """
    # Parse command line arguments
    config = parse_args()
    
    
    # Override config with function parameters if provided
    if protocol_url:
        config.protocol_url = protocol_url
        
    if api_key:
        config.api_key = api_key
    
    # Handle protocol registration if requested
    if config.register_protocol:
        register_protocol_handler()
        return
        
    # Handle protocol URL if provided
    if config.protocol_url and config.protocol_url.startswith("todoforai://"):
        success, data = handle_protocol_url(config.protocol_url)
        if success and isinstance(data, dict):
            if "api_key" in data:
                config.api_key = data["api_key"]
    
    # Create a client if we have an API key
    todo_client = TODOforAIEdge(client_config=config)
    if config.api_key:
        print(f"Created TODOforAIEdge client with API key: {config.api_key[:10]}...")
    elif config.email and config.password:
        try:
            print(f"Authenticating with email: {config.email}")
            config.api_key = authenticate_and_get_api_key(config.email, config.password, config.api_url)
            print(f"Successfully authenticated as {config.email}")
            print(f"API Key: {config.api_key}")
            if config.api_key:
                todo_client.api_key = config.api_key
            else:
                print("Warning: Authentication succeeded but no API key was returned")
        except Exception as e:
            print(f"Authentication failed: {str(e)}")
            if config.no_ui:
                sys.exit(1)
    elif config.no_ui:
        print("Error: API key, email and password are required if no UI is provided")
        print("Please provide credentials with --email and --password or --apikey or set TODO4AI_EMAIL, TODO4AI_PASSWORD and TODO4AI_API_KEY environment variables")
        print("Alternatively, run without the --no-ui flag to use the graphical interface login process")
        sys.exit(1)
    else:
        pass
            
    # Decide whether to use UI or CLI mode
    if not config.no_ui:
        # Import UI components here to avoid circular imports
        from todoforai_edge.ui.ui import start_ui
        return await start_ui(todo_client=todo_client)
    else:
        await todo_client.start()


def main():
    """Main entry point for the application"""
    asyncio.run(run_app())
