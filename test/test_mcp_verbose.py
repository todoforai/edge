#!/usr/bin/env python3
"""
Ultra-verbose MCP debugging with maximum logging
"""

import asyncio
import json
import logging
import os
import sys
import time
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from todoforai_edge.mcp_collector import MCPCollector
from todoforai_edge.edge_config import EdgeConfig

# Ultra-verbose logging setup
class VerboseFormatter(logging.Formatter):
    def format(self, record):
        # Add extra context
        result = super().format(record)
        if hasattr(record, 'extra') and record.extra:
            result += f" | Extra: {record.extra}"
        return result

# Setup ultra-verbose logging
handler = logging.StreamHandler()
handler.setFormatter(VerboseFormatter(
    '%(asctime)s.%(msecs)03d - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
    datefmt='%H:%M:%S'
))

# Configure root logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.DEBUG)
root_logger.handlers.clear()
root_logger.addHandler(handler)

# Also log to file
file_handler = logging.FileHandler('/tmp/mcp_ultra_verbose.log', mode='w')
file_handler.setFormatter(VerboseFormatter(
    '%(asctime)s.%(msecs)03d - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
))
root_logger.addHandler(file_handler)

logger = logging.getLogger("ultra-verbose-test")

async def test_single_server_ultra_verbose(server_id: str = "puppeteer"):
    """Test a single server with maximum verbosity"""
    logger.info(f"🔍 Starting ultra-verbose test for server: {server_id}")
    
    # Step 0: Test the actual command manually first
    logger.info("🧪 Testing raw command execution...")
    try:
        cmd = ["npx", "@todoforai/puppeteer-mcp-server"]
        logger.info(f"Executing: {' '.join(cmd)}")
        
        # Start the process and capture its output
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Give it 3 seconds to start up and show logs
        try:
            stdout, stderr = process.communicate(timeout=3)
            logger.info(f"Raw stdout: {stdout}")
            logger.info(f"Raw stderr: {stderr}")
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            logger.info(f"Process killed after timeout")
            logger.info(f"Partial stdout: {stdout}")
            logger.info(f"Partial stderr: {stderr}")
            
    except Exception as e:
        logger.error(f"Raw command test failed: {e}")
    
    # Step 1: Load config
    logger.info("📋 Loading mcp.json config...")
    with open("mcp.json", 'r') as f:
        config_data = json.load(f)
    
    servers = config_data.get("mcpServers", {})
    if server_id not in servers:
        logger.error(f"Server {server_id} not found in config")
        return
    
    server_config = servers[server_id]
    logger.info(f"📊 Server config: {json.dumps(server_config, indent=2)}")
    
    # Step 2: Create edge config
    logger.info("🏗️  Creating EdgeConfig...")
    edge_config = EdgeConfig()
    logger.info("✅ EdgeConfig created")
    
    # Step 3: Create MCP collector
    logger.info("🏗️  Creating MCPCollector...")
    collector = MCPCollector(edge_config)
    logger.info("✅ MCPCollector created")
    
    # Step 4: Create test config with just this server
    test_config = {
        "mcpServers": {
            server_id: server_config
        }
    }
    logger.info(f"🧪 Test config: {json.dumps(test_config, indent=2)}")
    
    # Step 5: Setup client and tools with timing
    logger.info("🚀 Starting _setup_client_and_tools...")
    start_time = time.time()
    
    try:
        tools = await asyncio.wait_for(
            collector._setup_client_and_tools(test_config),
            timeout=60.0
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        logger.info(f"✅ Setup completed in {duration:.3f}s")
        logger.info(f"🛠️  Found {len(tools)} tools:")
        
        for i, tool in enumerate(tools):
            logger.info(f"  Tool {i+1}: {tool.get('name')} - {tool.get('description', 'No description')}")
        
        # Step 6: Test a tool call
        if tools:
            tool_name = tools[0].get('name')
            logger.info(f"🧪 Testing tool call: {tool_name}")
            
            # Determine arguments
            test_args = {}
            if 'navigate' in tool_name.lower():
                test_args = {"url": "https://example.com"}
            
            logger.info(f"📤 Calling tool with args: {test_args}")
            call_start = time.time()
            
            result = await collector.call_tool(tool_name, test_args)
            
            call_end = time.time()
            call_duration = call_end - call_start
            
            logger.info(f"📥 Tool call completed in {call_duration:.3f}s")
            logger.info(f"📄 Result: {result}")
        
    except Exception as e:
        logger.error(f"❌ Setup failed: {e}")
        import traceback
        logger.error(f"📋 Full traceback:\n{traceback.format_exc()}")
    
    finally:
        # Cleanup
        logger.info("🧹 Cleaning up...")
        try:
            collector.disconnect()
            logger.info("✅ Cleanup completed")
        except Exception as e:
            logger.warning(f"⚠️  Cleanup warning: {e}")

async def main():
    logger.info("🎬 Starting ultra-verbose MCP test")
    await test_single_server_ultra_verbose("puppeteer")
    logger.info("🏁 Test completed")
    print(f"\n📄 Full ultra-verbose log saved to: /tmp/mcp_ultra_verbose.log")

if __name__ == "__main__":
    asyncio.run(main())