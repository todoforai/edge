#!/usr/bin/env python3
"""
Test to verify MCP Google Calendar tool calling works.
Tests list-calendars and list-events tools.
"""

import asyncio
import json
import logging
import sys
from pathlib import Path
from datetime import datetime, timedelta

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
        print(f"google-calendar config: {calendar_cfg}")
        
        # List tools
        tools = await collector.list_tools()
        tool_names = [t['name'] for t in tools]
        print(f"\nAvailable tools: {tool_names}")
        
        # Find Calendar tools
        calendar_tools = []
        for name in tool_names:
            if 'calendar' in name.lower() or 'google' in name.lower():
                calendar_tools.append(name)
        
        if not calendar_tools:
            print(f"❌ No Calendar tools found in: {tool_names}")
            return False
        
        print(f"Found Calendar tools: {calendar_tools}")
        
        # TEST 1: List calendars
        list_calendars_tool = None
        for tool in calendar_tools:
            if 'list' in tool.lower() and 'calendar' in tool.lower() and 'event' not in tool.lower():
                list_calendars_tool = tool
                break
        
        if list_calendars_tool:
            print(f"\n{'='*80}")
            print(f"TEST 1: List calendars with {list_calendars_tool}")
            print(f"{'='*80}")
            
            result = await collector.call_tool(list_calendars_tool, {})
            
            if result.get("error"):
                print(f"❌ List calendars failed: {result['error']}")
                return False
            
            print(f"✅ List calendars successful!")
            print(f"Result: {result.get('result', 'No content')[:500]}...")
        else:
            print("⚠️  No list-calendars tool found")
        
        # TEST 2: List events
        list_events_tool = None
        for tool in calendar_tools:
            if 'list' in tool.lower() and 'event' in tool.lower():
                list_events_tool = tool
                break
        
        if list_events_tool:
            print(f"\n{'='*80}")
            print(f"TEST 2: List events with {list_events_tool}")
            print(f"{'='*80}")
            
            # Get events for the next 7 days
            now = datetime.utcnow()
            time_min = now.isoformat() + 'Z'
            time_max = (now + timedelta(days=7)).isoformat() + 'Z'
            
            result = await collector.call_tool(list_events_tool, {
                "timeMin": time_min,
                "timeMax": time_max,
                "maxResults": 10
            })
            
            if result.get("error"):
                print(f"❌ List events failed: {result['error']}")
                return False
            
            print(f"✅ List events successful!")
            print(f"Result: {result.get('result', 'No content')[:500]}...")
        else:
            print("⚠️  No list-events tool found")
        
        # TEST 3: Search events (if available)
        search_events_tool = None
        for tool in calendar_tools:
            if 'search' in tool.lower() and 'event' in tool.lower():
                search_events_tool = tool
                break
        
        if search_events_tool:
            print(f"\n{'='*80}")
            print(f"TEST 3: Search events with {search_events_tool}")
            print(f"{'='*80}")
            
            result = await collector.call_tool(search_events_tool, {
                "query": "meeting"
            })
            
            if result.get("error"):
                print(f"❌ Search events failed: {result['error']}")
                # Don't fail the whole test if search fails
                print("⚠️  Continuing despite search failure...")
            else:
                print(f"✅ Search events successful!")
                print(f"Result: {result.get('result', 'No content')[:500]}...")
        else:
            print("⚠️  No search-events tool found")
        
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
    print(f"\n{'='*80}")
    print("✅ SUCCESS" if success else "❌ FAILED")
    print(f"{'='*80}")