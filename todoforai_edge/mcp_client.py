import logging
import json
import shutil
from typing import Dict, List, Any, Optional, Callable
from pathlib import Path
from fastmcp import Client

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
        
        # Subscribe to mcp_json changes if edge_config is provided
        if self.edge_config:
            self._unsubscribe_fn = self.edge_config.config.subscribe(self._on_config_change)
    
    def _on_config_change(self, changes: Dict[str, Any]) -> None:
        """Handle config changes, specifically mcp_json updates"""
        if "mcp_json" in changes:
            logger.info("MCP JSON config changed, reloading tools and saving to file")
            import asyncio
            asyncio.create_task(self._reload_tools_and_save())
    
    async def _reload_tools_and_save(self) -> None:
        """Reload tools from current mcp_json config and save to file"""
        try:
            mcp_json = self.edge_config.config.value.get("mcp_json", {})
            print('mcp_json', mcp_json)
            
            # Save the updated config to file if we have a config file path
            if self.config_file_path and mcp_json:
                await self._save_config_to_file(mcp_json)
            
            if not mcp_json:
                logger.info("No MCP config, clearing tools")
                self.edge_config.set_edge_mcps([])
                return
            
            # Process config and create client
            processed_servers = self._process_config(mcp_json)
            if not processed_servers:
                logger.info("No MCP servers, clearing tools")
                self.edge_config.set_edge_mcps([])
                return
            
            # Create FastMCP config with the correct structure
            fastmcp_config = {"mcpServers": processed_servers}
            client = Client(fastmcp_config)
            self.unified_client = client
            
            # Get tools and update config
            tools = await self.list_tools()
            self.edge_config.set_edge_mcps(tools)
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
    
    def _serialize_tools(self, tools: List[Any]) -> List[Dict[str, Any]]:
        """Convert Tool objects to JSON serializable format"""
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
            
            # Parse and set config - this will trigger tool reload via observer
            raw_config = self._parse_raw_config_file(config_path)
            if self.edge_config:
                self.edge_config.set_mcp_json(raw_config)
            
            # Process for return value
            processed_servers = self._process_config(raw_config)
            return {server: True for server in processed_servers}
                
        except Exception as e:
            logger.error(f"Error loading MCP servers: {e}")
            if self.edge_config:
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
        if not self.unified_client:
            raise RuntimeError("No MCP client available - call load_from_file first")
        
        server_id, actual_tool_name = _extract_server_id(tool_name)
        
        try:
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
            raise
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools"""
        if not self.unified_client:
            raise RuntimeError("No MCP client available")
        
        try:
            async with self.unified_client as client:
                tools = await client.list_tools()
                return self._serialize_tools(tools)
        except Exception as e:
            logger.error(f"Error listing tools: {e}")
            raise
    
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
