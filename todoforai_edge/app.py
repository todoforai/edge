#!/usr/bin/env python3
import sys
import asyncio
import os
from .colors import Colors
from .config import DEFAULT_API_URL
from pathlib import Path
import re

from todoforai_edge.edge import TODOforAIEdge
from todoforai_edge.arg_parser import create_argparse_apply_config


def set_terminal_title(title):
    """Set the terminal title cross-platform"""
    if os.name == 'nt':  # Windows
        os.system(f'title {title}')
    else:  # Unix/Linux/macOS
        sys.stdout.write(f'\033]0;{title}\007')
        sys.stdout.flush()

def get_cli_version():
    """Return installed CLI version; 'dev' if unavailable."""
    try:
        from importlib.metadata import version
        return version("todoforai-edge-cli")
    except Exception:
        try:
            text = (Path(__file__).resolve().parents[1] / "pyproject.toml").read_text(encoding="utf-8")
            m = re.search(r'(?m)^\s*version\s*=\s*"([^"]+)"\s*$', text)
            return m.group(1) if m else "dev"
        except Exception:
            return "dev"


async def run_app(api_key=None):
    # Set terminal title
    
    config = create_argparse_apply_config()
    
    config.api_key = api_key or config.api_key
        
    set_terminal_title(f"TODO for AI Edge{f' ({config.api_url})' if config.api_url != DEFAULT_API_URL else ''}")
    
    # Create a edge
    print(f"{Colors.CYAN}🚀 Starting TODOforAI Edge CLI v{get_cli_version()}...{Colors.END}")
    todo_edge = TODOforAIEdge(config)
    
    # Ensure we have a valid API key (validate existing or authenticate)
    await todo_edge.ensure_api_key(prompt_if_missing=True)
    
    print(f"{Colors.GREEN}🔗 Connecting to TODOforAI...{Colors.END}")
    await todo_edge.start()


def main():
    """Main entry point for the application"""
    try:
        asyncio.run(run_app())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}👋 Goodbye!{Colors.END}")
        sys.exit(0)
