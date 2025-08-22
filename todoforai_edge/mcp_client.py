import logging
import json
import shutil
from typing import Dict, List, Any, Optional, Callable
from pathlib import Path
from fastmcp import Client
import asyncio
from .edge_config import MCPTool
import traceback

logger = logging.getLogger("todoforai-mcp")

# Global callback for tool calls - simple and direct
_tool_call_callback: Optional[Callable] = None

def set_mcp_tool_call_callback(callback: Callable):
    global _tool_call_callback
    _tool_call_callback = callback

def _extract_server_id(tool_name: str) -> tuple[str, str]:
    if '_' in tool_name:
        parts = tool_name.split('_', 1)
        return parts[0], parts[1]  # server_id, actual_tool_name
    return 'unknown', tool_name

class MCPCollector:
    """MCP client using FastMCP with server management integration"""
    
    def __init__(self, edge_config=None):
        self.unified_client = None
        self.edge_config = edge_config
        self._unsubscribe_fn = None
        self.config_file_path = None  # Store the original config file path
        
        # Don't subscribe immediately - wait until after initial load
    
    def _subscribe_to_config_changes(self):
        """Subscribe to config changes after initial load is complete"""
        if self.edge_config and not self._unsubscribe_fn:
            self._unsubscribe_fn = self.edge_config.config.subscribe(self._on_config_change)
            logger.info("Subscribed to MCP config changes")
    
    def _on_config_change(self, changes: Dict[str, Any]) -> None:
        """Handle config changes, specifically mcp_json updates"""
        if "mcp_json" in changes:
            logger.info("MCP JSON config changed, reloading tools and saving to file")
            asyncio.create_task(self._reload_tools_and_save())
    
    async def _setup_client_and_tools(self, mcp_json: Dict[str, Any]) -> List[MCPTool]:
        """Common logic to setup client and get tools from config"""
        if not mcp_json:
            logger.info("No MCP config, clearing tools")
            return []
        
        # Process config and create client
        processed_servers = self._process_config(mcp_json)
        fastmcp_config = {"mcpServers": processed_servers}
        client = Client(fastmcp_config)
        self.unified_client = client
        
        # Get tools and return them
        tools = await self.list_tools()
        return tools
    
    async def _reload_tools_and_save(self) -> None:
        """Reload tools from current mcp_json config and save to file"""
        try:
            mcp_json = self.edge_config.config.value.get("mcp_json", {})
            
            # Setup client and get tools
            tools = await self._setup_client_and_tools(mcp_json)
            self.edge_config.set_edge_mcps(tools)
            
            # Save the updated config to file if we have a config file path
            if self.config_file_path and mcp_json:
                await self._save_config_to_file(mcp_json)
                
            logger.info(f"Auto-reloaded {len(tools)} tools and saved config to file")
            
        except Exception as e:
            logger.error(f"Error reloading tools and saving config: {e}")
            self.edge_config.set_edge_mcps([])
    
    async def _save_config_to_file(self, mcp_json: Dict[str, Any]) -> None:
        """Save the MCP JSON config back to the original file with backup"""
        try:
            config_path = Path(self.config_file_path)
            
            # Create backup if original file exists
            if config_path.exists():
                backup_path = config_path.with_suffix(f"{config_path.suffix}.bak")
                shutil.copy2(config_path, backup_path)
                logger.info(f"Created backup: {backup_path}")
            
            # Save the updated config
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(mcp_json, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved updated MCP config to: {config_path}")
            
        except Exception as e:
            logger.error(f"Error saving config to file: {e}")
    
    def _serialize_tools(self, tools: List[Any]) -> List[MCPTool]:
        """Convert Tool objects to typed format"""
        serialized = []
        for tool in tools:
            if '_' in tool.name:
                server_id, clean_name = tool.name.split('_', 1)
            else:
                server_id = 'unknown'
                clean_name = tool.name
            
            tool_info = {
                "name": tool.name,
                "description": getattr(tool, 'description', ''),
                "inputSchema": getattr(tool, 'inputSchema', {}),
                "server_id": server_id
            }
            serialized.append(tool_info)
        return serialized

    async def load_from_file(self, config_path: str) -> Dict[str, bool]:
        """Load servers from MCP config file"""
        try:
            if not Path(config_path).exists():
                logger.warning(f"MCP config file not found: {config_path}")
                return {}
            
            # Store the config file path for later saving
            self.config_file_path = config_path
            
            # Parse and set config - this will NOT trigger observer yet
            raw_config = self._parse_raw_config_file(config_path)
            self.edge_config.set_mcp_json(raw_config)

            # Setup client and get tools
            tools = await self._setup_client_and_tools(raw_config)
            self.edge_config.set_edge_mcps(tools)
        
            # Start subscribing to changes only after initial load
            self._subscribe_to_config_changes()
            
            processed_servers = self._process_config(raw_config)
            logger.info(f"Initial MCP load complete: {len(tools)} tools from {len(processed_servers)} servers")
            
            return {server: True for server in processed_servers}
                
        except Exception as e:
            logger.error(f"Error loading MCP servers: {e}")
            self.edge_config.set_mcp_json({})
            return {}
    
    def _parse_raw_config_file(self, config_path: str) -> Dict:
        """Parse raw MCP config file without modifications"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _process_config(self, raw_config: Dict) -> Dict:
        """Process already parsed config to extract and convert servers to FastMCP format"""
        servers = {}
        if "mcp" in raw_config:
            servers = raw_config["mcp"].get("servers", {})
        elif "mcpServers" in raw_config:
            servers = raw_config["mcpServers"]
        elif "servers" in raw_config:
            servers = raw_config["servers"]
        else:
            logger.warning("No recognized server configuration found")
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
        if not self.unified_client: raise RuntimeError("No MCP client available - call load_from_file first")
        
        server_id, actual_tool_name = _extract_server_id(tool_name)
        
        try:
            # Tool exists, proceed with the call
            async with self.unified_client as client:
                result = await client.call_tool(tool_name, arguments)
                result_text = result.text if hasattr(result, 'text') else str(result)
                
                if _tool_call_callback:
                    _tool_call_callback({
                        "call_tool": actual_tool_name,
                        "server_id": server_id,
                        "arguments": arguments,
                        "result": result_text,
                        "success": True
                    })
                
                return {"result": result_text}
        except Exception as e:
            if _tool_call_callback:
                _tool_call_callback({
                    "call_tool": actual_tool_name,
                    "server_id": server_id,
                    "arguments": arguments,
                    "error": str(e),
                    "success": False
                })
            
            logger.error(f"Error calling tool {tool_name}: {e}")
            return {"error": str(e), "success": False}
    
    async def list_tools(self) -> List[MCPTool]:
        """List all available tools"""
        if not self.unified_client: raise RuntimeError("No MCP client available")
        async with self.unified_client as client:
            tools = await client.list_tools()
            return self._serialize_tools(tools)
    
    def disconnect(self):
        """Disconnect from all servers and unsubscribe from config changes"""
        if self._unsubscribe_fn:
            self._unsubscribe_fn()
            self._unsubscribe_fn = None
        self.unified_client = None
        self.config_file_path = None
        logger.info("Disconnected from MCP servers")

# Simple setup function
async def setup_mcp_from_config(config_path: str, edge_config) -> MCPCollector:
    """Setup MCP collector with auto-reload on config changes"""
    collector = MCPCollector(edge_config)
    results = await collector.load_from_file(config_path)
    logger.info(f"MCP setup completed. Loaded {len(results)} servers with auto-reload and file sync.")
    return collector
