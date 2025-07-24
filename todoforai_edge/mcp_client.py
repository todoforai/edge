import logging
import json
from typing import Dict, List, Any
from pathlib import Path
from fastmcp import Client

logger = logging.getLogger("todoforai-mcp")

class MCPCollector:
    """MCP client using FastMCP with server management integration"""
    
    def __init__(self, config_path: str = None, edge_client=None):
        self.unified_client = None
        self.config_path = config_path or "mcp.json"
        self.edge_client = edge_client  # Reference to the edge client for config updates
    
    def _serialize_tools(self, tools: List[Any]) -> List[Dict[str, Any]]:
        """Convert Tool objects to JSON serializable format"""
        serialized = []
        for tool in tools:
            tool_info = {
                "name": tool.name,
                "description": getattr(tool, 'description', ''),
                "inputSchema": getattr(tool, 'inputSchema', {}),
                "server_id": getattr(tool, 'server_id', None)  # This should be set by fastmcp
            }
            serialized.append(tool_info)
        return serialized
        
    async def load_servers(self, config_path: str = None) -> Dict[str, bool]:
        """Load servers from a simple MCP configuration file"""
        try:
            config_file = config_path or self.config_path
            
            if not Path(config_file).exists():
                logger.warning(f"MCP config file not found: {config_file}")
                return {}
            
            config = {"mcpServers": self._parse_config_file(config_file)}

            logger.info(f"Loading MCP config with {len(config['mcpServers'])} servers")
            
            # Create unified client with simple config
            client = Client(config)
            self.unified_client = client
            
            # Test connection by initializing
            tools = await self.list_tools()
            logger.info(f"Loaded {len(tools)} tools from MCP servers")
            
            # Update edge config with serialized tools
            if self.edge_client:
                self.edge_client.edge_config.set_edge_mcps(tools)
                logger.info(f"Updated edge config with {len(tools)} MCP tools")
            
            return {server: True for server in config["mcpServers"]}
                
        except Exception as e:
            logger.error(f"Error loading MCP servers: {e}")
            # Clear MCPs on error
            if self.edge_client:
                self.edge_client.edge_config.set_edge_mcps([])
            return {}
    
    def _parse_config_file(self, config_path: str) -> Dict:
        """Parse MCP config file"""
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Handle both {"mcp": {"servers": ...}} and {"servers": ...} formats
        servers = {}
        if "mcp" in config:
            servers = config["mcp"].get("servers", {})
        elif "mcpServers" in config:
            servers = config["mcpServers"]
        elif "servers" in config:
            servers = config["servers"]
        else:
            logger.warning(f"No recognized server configuration found in {config_path}")
            return {}
        
        # Convert underscores to hyphens in server IDs
        converted_servers = {}
        for server_id, server_config in servers.items():
            new_server_id = server_id.replace('_', '-')
            converted_servers[new_server_id] = server_config
            if new_server_id != server_id:
                logger.info(f"Converted server ID '{server_id}' to '{new_server_id}'")
        
        return converted_servers
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
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
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools"""
        if not self.unified_client:
            raise RuntimeError("No MCP client available - call load_servers first")
        
        try:
            async with self.unified_client as client:
                tools = await client.list_tools()
                return self._serialize_tools(tools)
        except Exception as e:
            logger.error(f"Error listing tools: {e}")
            raise
    
    async def disconnect_all(self):
        """Disconnect from all servers"""
        self.unified_client = None
        logger.info("Disconnected from all MCP servers")

# Simple setup function
async def setup_mcp_from_config(config_path: str = None, edge_client=None) -> MCPCollector:
    """Setup MCP collector from config file"""
    collector = MCPCollector(config_path, edge_client)
    results = await collector.load_servers()
    
    logger.info(f"MCP setup completed. Loaded {len(results)} servers.")
    return collector
