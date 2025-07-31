#!/usr/bin/env python3
import sys
import asyncio
import os
from .colors import Colors
from .config import DEFAULT_API_URL

from todoforai_edge.client import TODOforAIEdge
from todoforai_edge.arg_parser import create_argparse_apply_config


def set_terminal_title(title):
    """Set the terminal title cross-platform"""
    if os.name == 'nt':  # Windows
        os.system(f'title {title}')
    else:  # Unix/Linux/macOS
        sys.stdout.write(f'\033]0;{title}\007')
        sys.stdout.flush()


async def run_app(api_key=None):
    # Set terminal title
    
    config = create_argparse_apply_config()
    
    config.api_key = api_key or config.api_key
        
    set_terminal_title(f"TODO for AI Edge{f' ({config.api_url})' if config.api_url != DEFAULT_API_URL else ''}")
    
    # Validate we have required credentials
    if not config.api_key and not (config.email and config.password):
        print(f"{Colors.RED}❌ Error: Authentication credentials required{Colors.END}")
        print("Please provide either:")
        print("  • API key: --api-key YOUR_API_KEY")
        print("  • Email and password: --email YOUR_EMAIL --password YOUR_PASSWORD")
        print("  • Set environment variables: TODO4AI_API_KEY or TODO4AI_EMAIL + TODO4AI_PASSWORD")
        sys.exit(1)
    
    # Create a client
    print(f"{Colors.CYAN}🚀 Starting TodoForAI Edge CLI...{Colors.END}")
    todo_client = TODOforAIEdge(client_config=config)
    
    # Authenticate if needed
    if not todo_client.api_key and (todo_client.email and todo_client.password):
        auth_result = await todo_client.authenticate()
        if not auth_result["valid"]:
            print(f"{Colors.RED}❌ Authentication failed: {auth_result.get('error', 'Unknown error')}{Colors.END}")
            sys.exit(1)
    
    if not todo_client.api_key:
        print(f"{Colors.RED}❌ Error: No API key available after authentication{Colors.END}")
        sys.exit(1)
    
    print(f"{Colors.GREEN}🔗 Connecting to TodoForAI...{Colors.END}")
    await todo_client.start()


def main():
    """Main entry point for the application"""
    try:
        asyncio.run(run_app())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}👋 Goodbye!{Colors.END}")
        sys.exit(0)
