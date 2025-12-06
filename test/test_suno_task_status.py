#!/usr/bin/env python3
"""
Simple Suno MCP task status test
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

# SUNO_CONFIG block removed

async def test_suno_task_status():
    """Test Suno MCP task status functionality"""
    
    try:
        # Initialize
        edge_config = EdgeConfig()
        collector = MCPCollector(edge_config)
        
        # Use existing working config from mcp.json
        print("Loading existing MCP config from mcp.json...")
        await collector.load_from_file("mcp.suno.json")

        # List tools
        tools = await collector.list_tools()
        tool_names = [t['name'] for t in tools]
        print(f"Available tools: {tool_names}")

        # Find any Suno tool
        suno_tools = [name for name in tool_names if 'get_task_status' in name.lower()]
        if suno_tools:
            print(f"Found Suno tools: {suno_tools}")
            
            # Try to find get_task_status or similar
            task_tool = None
            for tool in suno_tools:
                if 'task' in tool.lower() or 'status' in tool.lower():
                    task_tool = tool
                    break
            
            if not task_tool:
                task_tool = suno_tools[0]  # Use first Suno tool
            
            print(f"Testing tool: {task_tool}")
            
            # Call the tool
            result = await collector.call_tool(task_tool, {
                "taskId": "0151ecd9f5e6187a1e87abf439561d71"
            })
            
            print(f"Result: {json.dumps(result, indent=2)}")
            
            if result.get("error"):
                print(f"❌ Tool call failed: {result['error']}")
                return False
            
            print(f"✅ Tool call successful!")
            return True
            
        else:
            print("❌ No Suno tools found")
            print("Available tools:", tool_names)
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        collector.disconnect()

if __name__ == "__main__":
    success = asyncio.run(test_suno_task_status())
    print(f"\n{'='*80}")
    print("✅ SUCCESS" if success else "❌ FAILED")
    print(f"{'='*80}")