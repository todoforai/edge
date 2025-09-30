#!/usr/bin/env python3
"""
Minimal test to verify MCP Gmail tool calling works.
Tests both search_emails and read_email.
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
        
        # List tools
        tools = await collector.list_tools()
        tool_names = [t['name'] for t in tools]
        print(f"\nAvailable tools: {tool_names}")
        
        # Find Gmail search tool
        search_tool = None
        for name in tool_names:
            if 'search' in name.lower() and ('gmail' in name.lower() or 'email' in name.lower()):
                search_tool = name
                break
        
        if not search_tool:
            print(f"❌ No Gmail search tool found")
            return False
        
        print(f"\n{'='*80}")
        print(f"TEST 1: Search emails with {search_tool}")
        print(f"{'='*80}")
        
        # Test 1: Search emails
        result = await collector.call_tool(search_tool, {
            "query": "in:inbox",
            "maxResults": 3
        })
        
        if result.get("error"):
            print(f"❌ Search failed: {result['error']}")
            return False
        
        print(f"✅ Search successful!")
        print(f"Result: {result.get('result', 'No content')[:500]}...")
        
        # Find Gmail read tool
        read_tool = None
        for name in tool_names:
            if 'read' in name.lower() and ('gmail' in name.lower() or 'email' in name.lower()):
                read_tool = name
                break
        
        if not read_tool:
            print(f"\n❌ No Gmail read tool found")
            return False
        
        print(f"\n{'='*80}")
        print(f"TEST 2: Read email with {read_tool}")
        print(f"{'='*80}")
        
        # Test 2: Read specific email
        result = await collector.call_tool(read_tool, {
            "messageId": "199984630dc9878a"
        })
        
        if result.get("error"):
            print(f"❌ Read failed: {result['error']}")
            return False
        
        print(f"✅ Read successful!")
        print(f"Result: {result.get('result', 'No content')[:500]}...")
        
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
    print(f"\n{'='*80}")
    print("✅ SUCCESS" if success else "❌ FAILED")
    print(f"{'='*80}")