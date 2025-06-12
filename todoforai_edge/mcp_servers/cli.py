#!/usr/bin/env python3
"""
CLI tool for managing MCP servers
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path

from .manager import MCPServerManager, MCPServerConfig, ServerType
from .predefined_servers import get_predefined_server, list_predefined_servers, PREDEFINED_SERVERS

async def main():
    parser = argparse.ArgumentParser(description="MCP Server Manager CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # List command
    list_parser = subparsers.add_parser("list", help="List configured servers")
    list_parser.add_argument("--predefined", action="store_true", help="List predefined servers")
    
    # Add command
    add_parser = subparsers.add_parser("add", help="Add a server")
    add_parser.add_argument("name", help="Server name")
    add_parser.add_argument("--predefined", help="Use predefined server configuration")
    add_parser.add_argument("--type", choices=[t.value for t in ServerType], help="Server type")
    add_parser.add_argument("--command", help="Command to run")
    add_parser.add_argument("--args", nargs="*", default=[], help="Command arguments")
    add_parser.add_argument("--env", action="append", help="Environment variables (KEY=VALUE)")
    add_parser.add_argument("--git-url", help="Git repository URL")
    add_parser.add_argument("--description", default="", help="Server description")
    
    # Remove command
    remove_parser = subparsers.add_parser("remove", help="Remove a server")
    remove_parser.add_argument("name", help="Server name")
    
    # Install command
    install_parser = subparsers.add_parser("install", help="Install servers")
    install_parser.add_argument("names", nargs="*", help="Server names (empty for all)")
    
    # Generate command
    generate_parser = subparsers.add_parser("generate", help="Generate MCP config file")
    generate_parser.add_argument("--output", "-o", help="Output file path")
    
    # Info command
    info_parser = subparsers.add_parser("info", help="Show server information")
    info_parser.add_argument("name", help="Server name")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    manager = MCPServerManager()
    
    if args.command == "list":
        if args.predefined:
            print("Predefined servers:")
            for name, config in PREDEFINED_SERVERS.items():
                print(f"  {name}: {config.description}")
        else:
            servers = manager.list_servers()
            if servers:
                print("Configured servers:")
                for server in servers:
                    print(f"  {server['name']} ({server['type']}): {server['description']}")
            else:
                print("No servers configured")
    
    elif args.command == "add":
        if args.predefined:
            if args.predefined not in PREDEFINED_SERVERS:
                print(f"Unknown predefined server: {args.predefined}")
                print(f"Available: {', '.join(PREDEFINED_SERVERS.keys())}")
                return
            
            config = get_predefined_server(args.predefined)
            config.name = args.name  # Allow custom name
            
            # Override with any provided arguments
            if args.env:
                for env_var in args.env:
                    if "=" in env_var:
                        key, value = env_var.split("=", 1)
                        config.env[key] = value
            
        else:
            if not args.type or not args.command:
                print("--type and --command are required when not using --predefined")
                return
            
            env = {}
            if args.env:
                for env_var in args.env:
                    if "=" in env_var:
                        key, value = env_var.split("=", 1)
                        env[key] = value
            
            config = MCPServerConfig(
                name=args.name,
                server_type=ServerType(args.type),
                command=args.command,
                args=args.args,
                env=env,
                git_url=args.git_url,
                description=args.description
            )
        
        if manager.add_server(config):
            print(f"Added server: {args.name}")
        else:
            print(f"Failed to add server: {args.name}")
    
    elif args.command == "remove":
        if manager.remove_server(args.name):
            print(f"Removed server: {args.name}")
        else:
            print(f"Server not found: {args.name}")
    
    elif args.command == "install":
        if args.names:
            results = {}
            for name in args.names:
                results[name] = await manager.install_server(name)
        else:
            results = await manager.install_all_servers()
        
        print("Installation results:")
        for name, success in results.items():
            status = "✓" if success else "✗"
            print(f"  {status} {name}")
    
    elif args.command == "generate":
        if manager.save_mcp_config():
            output_path = args.output or manager.mcp_config_file
            if args.output:
                # Copy to specified output path
                import shutil
                shutil.copy2(manager.mcp_config_file, args.output)
            print(f"Generated MCP config: {output_path}")
        else:
            print("Failed to generate MCP config")
    
    elif args.command == "info":
        if args.name in manager.servers:
            config = manager.servers[args.name]
            print(f"Server: {config.name}")
            print(f"Type: {config.server_type.value}")
            print(f"Command: {config.command}")
            print(f"Args: {config.args}")
            print(f"Env: {config.env}")
            print(f"Description: {config.description}")
            if config.git_url:
                print(f"Git URL: {config.git_url}")
        else:
            print(f"Server not found: {args.name}")

if __name__ == "__main__":
    asyncio.run(main())