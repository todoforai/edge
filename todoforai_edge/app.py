#!/usr/bin/env python3
import sys
import asyncio

from todoforai_edge.client import TODOforAIEdge
from todoforai_edge.arg_parser import create_argparse_apply_config


async def run_app(api_key=None):
    config = create_argparse_apply_config()
    
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
