#!/usr/bin/env python3
"""
Minimal test to verify MCP Gmail tool calling works.
Just loads config, lists tools, and calls gmail2_search_emails.
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from todoforai_edge.edge_config import EdgeConfig
from todoforai_edge.mcp_collector import MCPCollector

# Reduce noise from FastMCP
logging.getLogger("fastmcp").setLevel(logging.WARNING)
logging.getLogger("mcp").setLevel(logging.WARNING)

async def test_gmail_mcp():
    """Minimal test for Gmail MCP functionality"""
    
    # Check if mcp.json exists
    if not Path("mcp.json").exists():
        print("❌ mcp.json not found. Please create it with Gmail server config.")
        return False
    
    try:
        # Initialize
        edge_config = EdgeConfig()
        collector = MCPCollector(edge_config)
        
        # Load config
        print("Loading MCP config...")
        await collector.load_from_file("mcp.json")
        server_id = "gmail"
        
        # Quick debug: show expanded env for the specified server if present
        cfg = edge_config.config.safe_get("mcp_json", {})
        server_cfg = (cfg.get("mcpServers") or {}).get(server_id, {})
        print(f"{server_id} env:", server_cfg.get("env", {}))
        
        # List tools
        tools = await collector.list_tools()
        tool_names = [t['name'] for t in tools]
        print(f"Available tools: {tool_names}")
        
        # Find Gmail tool
        gmail_tool = None
        for name in tool_names:
            if 'search' in name.lower() and ('gmail' in name.lower() or 'email' in name.lower()):
                gmail_tool = name
                break
        
        if not gmail_tool:
            print(f"❌ No Gmail search tool found in: {tool_names}")
            return False
        
        print(f"Found Gmail tool: {gmail_tool}")
        
        # Call the tool
        print("Calling Gmail search tool...")
        result = await collector.call_tool(gmail_tool, {
            "query": "in:inbox",
            "maxResults": 3
        })
        
        if result.get("error"):
            print(f"❌ Tool call failed: {result['error']}")
            return False
        
        print(f"✅ Tool call successful!")
        print(f"Result: {result.get('result', 'No content')[:200]}...")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        collector.disconnect()

if __name__ == "__main__":
    success = asyncio.run(test_gmail_mcp())
    print("✅ SUCCESS" if success else "❌ FAILED")