import logging
import asyncio
import json
from typing import Dict, List, Optional, Any
from fastmcp import Client
from pathlib import Path

logger = logging.getLogger("todoforai-mcp")

class MCPCollector:
    """MCP client using FastMCP with server management integration"""
    
    def __init__(self, config_path: str = None):
        self.unified_client = None
        self.config_path = config_path or "mcp.json"
        
    async def load_servers(self, config_path: str = None) -> Dict[str, bool]:
        """Load servers from a simple MCP configuration file"""
        try:
            config_file = config_path or self.config_path
            
            if not Path(config_file).exists():
                logger.warning(f"MCP config file not found: {config_file}")
                return {}
            
            with open(config_file, 'r') as f:
                config = json.load(f)
            
            if not config.get("mcpServers"):
                logger.error("No MCP servers configured")
                return {}
            
            logger.info(f"Loading MCP config with {len(config['mcpServers'])} servers")
            
            # Create unified client with simple config
            self.unified_client = Client(config)
            
            # Test connection by initializing
            async with self.unified_client as client:
                tools = await client.list_tools()
                logger.info(f"Loaded {len(tools)} tools from MCP servers")
                
                return {server: True for server in config["mcpServers"].keys()}
                
        except Exception as e:
            logger.error(f"Error loading MCP servers: {e}")
            return {}
    
    
    async def call_tool(self, tool_name: str, server_id: Optional[str], arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call tool using unified client"""
        if not self.unified_client:
            raise RuntimeError("No MCP client available - call load_servers first")
        
        try:
            async with self.unified_client as client:
                result = await client.call_tool(tool_name, arguments)
                return {"result": result.text if hasattr(result, 'text') else str(result)}
        except Exception as e:
            logger.error(f"Error calling tool {tool_name}: {e}")
            raise
    
    async def list_tools(self) -> List[Any]:
        """List all available tools"""
        if not self.unified_client:
            raise RuntimeError("No MCP client available - call load_servers first")
        
        try:
            async with self.unified_client as client:
                tools = await client.list_tools()
                return tools
        except Exception as e:
            logger.error(f"Error listing tools: {e}")
            raise
    
    async def disconnect_all(self):
        """Disconnect from all servers"""
        self.unified_client = None
        logger.info("Disconnected from all MCP servers")

# Simple setup function
async def setup_mcp_from_config(config_path: str = None) -> MCPCollector:
    """Setup MCP collector from config file"""
    collector = MCPCollector(config_path)
    results = await collector.load_servers()
    
    logger.info(f"MCP setup completed. Loaded {len(results)} servers.")
    return collector
