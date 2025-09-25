#!/usr/bin/env python3
"""
Simple test to verify MCP Google Calendar tool calling works.
Just loads config, lists tools, and calls calendar tools.
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

async def test_calendar_mcp():
    """Test for Google Calendar MCP functionality"""
    
    # Check if mcp.json exists
    if not Path("mcp.json").exists():
        print("❌ mcp.json not found. Please create it with Google Calendar server config.")
        return False
    
    try:
        # Initialize
        edge_config = EdgeConfig()
        collector = MCPCollector(edge_config)
        
        # Load config
        print("Loading MCP config...")
        await collector.load_from_file("mcp.json")
        
        # Quick debug: show expanded env for google-calendar if present
        cfg = edge_config.config.safe_get("mcp_json", {})
        calendar_cfg = (cfg.get("mcpServers") or {}).get("google-calendar", {})
        print("google-calendar env:", calendar_cfg.get("env", {}))
        
        # List tools
        tools = await collector.list_tools()
        tool_names = [t['name'] for t in tools]
        print(f"Available tools: {tool_names}")
        
        # Find Calendar tools
        calendar_tools = []
        for name in tool_names:
            if 'calendar' in name.lower() or ('google' in name.lower() and ('event' in name.lower() or 'schedule' in name.lower())):
                calendar_tools.append(name)
        
        if not calendar_tools:
            print(f"❌ No Calendar tools found in: {tool_names}")
            return False
        
        print(f"Found Calendar tools: {calendar_tools}")
        
        # Try to call a list/get events tool first (safer than creating)
        list_tool = None
        for tool in calendar_tools:
            if 'list' in tool.lower() or 'get' in tool.lower() or 'events' in tool.lower():
                list_tool = tool
                break
        
        if list_tool:
            print(f"Calling Calendar tool: {list_tool}")
            result = await collector.call_tool(list_tool, {
                "maxResults": 5
            })
            
            if result.get("error"):
                print(f"❌ Tool call failed: {result['error']}")
                return False
            
            print(f"✅ Tool call successful!")
            print(f"Result: {result.get('result', 'No content')[:200]}...")
        else:
            print("⚠️  No list/get events tool found, just listing available tools")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        collector.disconnect()

if __name__ == "__main__":
    success = asyncio.run(test_calendar_mcp())
    print("✅ SUCCESS" if success else "❌ FAILED")