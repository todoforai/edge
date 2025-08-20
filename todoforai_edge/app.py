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
    
    # Create a client
    print(f"{Colors.CYAN}🚀 Starting TODOforAI Edge CLI...{Colors.END}")
    todo_client = TODOforAIEdge(client_config=config)
    
    # Ensure we have a valid API key (validate existing or authenticate)
    if not await todo_client.ensure_api_key():
        print(f"{Colors.RED}❌ Error: Unable to obtain a valid API key{Colors.END}")
        sys.exit(1)
    
    print(f"{Colors.GREEN}🔗 Connecting to TODOforAI...{Colors.END}")
    await todo_client.start()


def main():
    """Main entry point for the application"""
    try:
        asyncio.run(run_app())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}👋 Goodbye!{Colors.END}")
        sys.exit(0)
