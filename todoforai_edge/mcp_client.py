import logging
import asyncio
import json
from typing import Dict, List, Optional, Any
from fastmcp import Client

logger = logging.getLogger("todoforai-mcp")

class MCPCollector:
    """Simplified MCP client using FastMCP - focused on tools only"""
    
    def __init__(self):
        self.clients: Dict[str, Client] = {}
        self.unified_client = None
        
    async def load_from_config_file(self, config_path: str) -> Dict[str, bool]:
        """Load servers from MCP config file"""
        try:
            config = self._parse_config_file(config_path)
            
            if not config:
                logger.error("No MCP servers defined in the config")
                return {}
            
            # FastMCP expects the config in a specific format
            mcp_config = {"mcpServers": config}
            
            logger.info(f"Loading MCP config: {mcp_config}")
            
            # Create unified client
            self.unified_client = Client(mcp_config)
            
            # Test connection by initializing
            async with self.unified_client as client:
                # Get all available tools to verify connection
                tools = await client.list_tools()
                logger.info(f"Loaded {len(tools)} tools from MCP servers")
                
                # Return success status for each server
                return {server: True for server in config.keys()}
                
        except Exception as e:
            logger.error(f"Error loading MCP config: {e}")
            return {}
    
    def _parse_config_file(self, config_path: str) -> Dict:
        """Parse MCP config file"""
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            
            # Handle both {"mcp": {"servers": ...}} and {"servers": ...} formats
            if "mcp" in config:
                return config["mcp"].get("servers", {})
            elif "mcpServers" in config:
                return config["mcpServers"]
            elif "servers" in config:
                return config["servers"]
            else:
                logger.warning(f"No recognized server configuration found in {config_path}")
                return {}
        except Exception as e:
            logger.error(f"Error parsing config file {config_path}: {e}")
            return {}
    
    async def call_tool(self, tool_name: str, server_id: Optional[str], arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call tool using unified client"""
        if not self.unified_client:
            raise RuntimeError("No MCP client available - call load_from_config_file first")
        
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
            raise RuntimeError("No MCP client available - call load_from_config_file first")
        
        try:
            async with self.unified_client as client:
                tools = await client.list_tools()
                return tools
        except Exception as e:
            logger.error(f"Error listing tools: {e}")
            raise
    
    async def disconnect_all(self):
        """Disconnect from all servers"""
        # FastMCP handles connection management automatically
        self.unified_client = None
        logger.info("Disconnected from all MCP servers")
