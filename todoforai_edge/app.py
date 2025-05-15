#!/usr/bin/env python3
import os
import sys
import asyncio
import traceback

from todoforai_edge.client import TODOforAIEdge
from todoforai_edge.apikey import authenticate_and_get_api_key
from todoforai_edge.arg_parser import apply_config_from_args

async def run_app(api_key=None):
    """
    Main application entry point that handles CLI mode
    
    Args:
        api_key: Optional API key to use directly
        
    Returns:
        None
    """
    # Parse command line arguments
    config = apply_config_from_args()
    
    # Override config with function parameters if provided
    if api_key:
        config.api_key = api_key
    
    # Create a client
    todo_client = TODOforAIEdge(client_config=config)
    
    # Authenticate if needed
    if not todo_client.api_key and (todo_client.email and todo_client.password):
        auth_success = await todo_client.authenticate()
        if not auth_success:
            print("Authentication failed. Exiting.")
            sys.exit(1)
    
    if not todo_client.api_key:
        print("Error: API key is required")
        print("Please provide credentials with --email and --password or --apikey")
        print("Or set TODO4AI_EMAIL, TODO4AI_PASSWORD and TODO4AI_API_KEY environment variables")
        sys.exit(1)
    
    await todo_client.start()


def main():
    """Main entry point for the application"""
    asyncio.run(run_app())
