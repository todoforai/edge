#!/usr/bin/env python3
"""
Setup script for MCP servers using standard mcp.json format
"""

import asyncio
import os
from pathlib import Path
from todoforai_edge.mcp_servers.manager import MCPServerManager, MCPServerConfig

async def setup_basic_servers():
    """Setup basic MCP servers"""
    
    # Use the default mcp.json location
    config_path = Path(__file__).parent / "mcp_servers" / "mcp.json"
    manager = MCPServerManager(str(config_path))
    
    print("Setting up basic MCP servers...")
    
    # Add filesystem server (safe directory)
    filesystem_config = MCPServerConfig(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
        env={}
    )
    manager.add_server("filesystem", filesystem_config)
    
    # Add memory server
    memory_config = MCPServerConfig(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-memory"],
        env={}
    )
    manager.add_server("memory", memory_config)
    
    # Add puppeteer if requested
    puppeteer_config = MCPServerConfig(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-puppeteer"],
        env={}
    )
    manager.add_server("puppeteer", puppeteer_config)
    
    # Add Tavily if API key is available
    tavily_key = os.getenv("TAVILY_API_KEY")
    if tavily_key:
        tavily_config = MCPServerConfig(
            command="npx",
            args=["-y", "tavily-mcp@0.1.4"],
            env={"TAVILY_API_KEY": tavily_key}
        )
        manager.add_server("tavily", tavily_config)
        print("✓ Added Tavily server with API key")
    else:
        print("⚠ Skipping Tavily server (no TAVILY_API_KEY found)")
    
    # Create a simple FastMCP server
    await manager.create_fastmcp_server("simple-server")
    print("✓ Created simple FastMCP server")
    
    print(f"\nMCP configuration saved to: {config_path}")
    print("\nTo test the configuration:")
    print("python -m todoforai_edge.mcp_servers.cli show")

if __name__ == "__main__":
    asyncio.run(setup_basic_servers())