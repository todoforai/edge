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
    
    def __init__(self, edge_config):
        self.unified_client = None
        self.edge_config = edge_config
        self._unsubscribe_fn = None
        self.config_file_path = None  # Store the original config file path
        self.server_id_to_registry_id = {}  # serverId -> registryId mapping

        # Start subscribing to config changes only after initial load
        self._subscribe_to_config_changes()
    
    def _subscribe_to_config_changes(self):
        """Subscribe to config changes after initial load is complete"""
        self._unsubscribe_fn = self.edge_config.config.subscribe_async(self._on_config_change)
        logger.info("Subscribed to MCP config changes")
    
    async def _on_config_change(self, changes: Dict[str, Any]) -> None:
        """Handle config changes, specifically mcp_json updates"""
        if "mcp_json" in changes and changes["mcp_json"]:
            logger.info("MCP JSON config changed, reloading tools and saving to file")
            await self._reload_tools_and_save()  # Use await instead of asyncio.create_task
    
    async def _setup_client_and_tools(self, mcp_json: Dict[str, Any]) -> List[MCPTool]:
        """Common logic to setup client and get tools from config"""
        if not mcp_json:
            logger.info("No MCP config, clearing tools")
            return []
        
        # Process config and create client
        processed_servers = self._process_config(mcp_json)
        fastmcp_config = {"mcpServers": processed_servers}
        
        self.unified_client = Client(fastmcp_config)
        
        # Get tools and return them
        tools = await self.list_tools()
        return tools
    
    async def _reload_tools_and_save(self) -> None:
        """Reload tools from current mcp_json config and save to file"""
        try:
            mcp_json = self.edge_config.config.safe_get("mcp_json", {})
            
            # Rebuild mapping on reload
            self._build_registry_mapping(mcp_json)

            # Optimistically set status to STARTING for all servers before loading
            self._set_servers_status_optimistically(mcp_json, "STARTING")

            # Setup client and get tools
            tools = await self._setup_client_and_tools(mcp_json)
            self.setInstalledMCPs(tools)
            
            # Save the updated config to file if we have a config file path
            if self.config_file_path and mcp_json:
                await self._save_config_to_file(mcp_json)
                
            logger.info(f"Auto-reloaded {len(tools)} tools and saved config to file")
            
        except Exception as e:
            logger.error(f"Error reloading tools and saving config: {e}")
            self.setInstalledMCPs([])
    
    def _set_servers_status_optimistically(self, mcp_json: Dict[str, Any], status: str) -> None:
        """Optimistically set status for all servers in mcp_json"""
        mcp_servers = mcp_json.get("mcpServers", {})
        if not mcp_servers:
            return
            
        current_installed = dict(self.edge_config.config.safe_get("installedMCPs", {}))
        
        for server_id in mcp_servers.keys():
            prev_entry = current_installed.get(server_id, {})
            # Determine if this is a new installation or restart
            is_new_installation = not prev_entry or not prev_entry.get("tools")
            actual_status = "INSTALLING" if is_new_installation else "STARTING"
            
            current_installed[server_id] = {
                **prev_entry,
                "serverId": server_id,
                "id": prev_entry.get("id", server_id),
                "registryId": self.server_id_to_registry_id.get(server_id, server_id),
                "status": actual_status,
                "tools": prev_entry.get("tools", []),
                "env": prev_entry.get("env", {}),
            }
        
        # Update config with optimistic status
        self.edge_config.config.update_value({"installedMCPs": current_installed})
        logger.info(f"Optimistically set {len(mcp_servers)} servers with appropriate status")

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
        """Convert Tool objects to typed format without server_id extraction"""
        serialized = []
        for tool in tools:
            tool_info = {
                "name": tool.name,
                "description": getattr(tool, 'description', ''),
                "inputSchema": getattr(tool, 'inputSchema', {}),
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
            
            # Build serverId -> registryId mapping
            self._build_registry_mapping(raw_config)
            
            self.edge_config.set_mcp_json(raw_config)

            # Optimistically set status based on whether servers are new or existing
            self._set_servers_status_optimistically(raw_config, "STARTING")  # This will determine INSTALLING vs STARTING internally

            # Setup client and get tools
            tools = await self._setup_client_and_tools(raw_config)
            self.setInstalledMCPs(tools)
        
            processed_servers = self._process_config(raw_config)
            logger.info(f"Initial MCP load complete: {len(tools)} tools from {len(processed_servers)} servers")
            
            return {server: True for server in processed_servers}
                
        except Exception as e:
            logger.error(f"Error loading MCP servers: {e}")
            self.edge_config.set_mcp_json({})
            return {}
    
    def _build_registry_mapping(self, mcp_json: Dict[str, Any]) -> None:
        """Build serverId -> registryId mapping from mcp_json config"""
        self.server_id_to_registry_id = {}
        
        # Get servers section
        servers = {}
        if "mcpServers" in mcp_json:
            servers = mcp_json["mcpServers"]
        elif "mcp" in mcp_json and "servers" in mcp_json["mcp"]:
            servers = mcp_json["mcp"]["servers"]
        
        # Registry mapping based on command/args patterns
        registry_mappings = {
            ("npx", "@gongrzhe/server-gmail-autoauth-mcp"): "gmail",
            ("npx", "@todoforai/server-gmail-autoauth-mcp"): "gmail",
            ("npx", "github:Sixzero/puppeteer-mcp-server"): "puppeteer", 
            ("npx", "@playwright/mcp@latest"): "playwright",
            ("npx", "@spotify-applescript/mcp-server"): "spotify-applescript",
            ("npx", "@stripe/mcp-server"): "stripe",
            ("npx", "@brave-applescript/mcp-server"): "brave-applescript",
            ("npx", "@modelcontextprotocol/server-cloudflare"): "cloudflare",
            ("npx", "@modelcontextprotocol/server-atlassian"): "atlassian",
            ("npx", "@props-labs/mcp/fireflies"): "fireflies",
            ("npx", "@modelcontextprotocol/server-google-drive"): "google-drive",
            ("npx", "@modelcontextprotocol/server-google-calendar"): "google-calendar",
            ("npx", "@modelcontextprotocol/server-google-mail"): "google-mail",
            ("npx", "@canva/cli"): "canva",
            ("npx", "@paypal/mcp"): "paypal",
            ("npx", "@netlify/mcp"): "netlify",
            ("npx", "@modelcontextprotocol/server-asana"): "asana",
            ("npx", "@modelcontextprotocol/server-google-maps"): "google-maps",
            ("npx", "@workato/mcp"): "workato",
            ("npx", "@modelcontextprotocol/server-bluesky"): "bluesky",
            ("npx", "slack-mcp-server"): "slack",
            ("python", "whatsapp_mcp"): "whatsapp",
            ("npx", "mcp-remote"): "weather-mcp",  # For weather and other remote services
        }
        
        # Map each server
        for server_id, server_config in servers.items():
            command = server_config.get("command", "")
            args = server_config.get("args", [])
            # Determine the primary argument (skip flags like -y; handle python -m)
            primary_arg = ""
            if isinstance(args, list) and args:
                if command == "python" and "-m" in args:
                    i = args.index("-m")
                    if i + 1 < len(args):
                        primary_arg = args[i + 1]
                if not primary_arg:
                    for a in args:
                        if isinstance(a, str) and not a.startswith("-"):
                            primary_arg = a
                            break
                if not primary_arg:
                    primary_arg = args[0] if args else ""
             
            # Try exact match first
            key = (command, primary_arg)
            if key in registry_mappings:
                registry_id = registry_mappings[key]
            else:
                # Try partial matches for complex args
                registry_id = None
                for (cmd, arg_pattern), reg_id in registry_mappings.items():
                    if command == cmd and primary_arg and arg_pattern in primary_arg:
                        registry_id = reg_id
                        break
                
                # Fallback: derive from primary_arg or use server_id
                if not registry_id:
                    if command == "npx" and primary_arg:
                        if "/" in primary_arg:
                            registry_id = primary_arg.split("/")[-1].replace("-server", "").replace("server-", "")
                        else:
                            registry_id = primary_arg.replace("-server", "").replace("server-", "")
                    else:
                        registry_id = server_id
            
            self.server_id_to_registry_id[server_id] = registry_id
            logger.info(f"Mapped serverId '{server_id}' -> registryId '{registry_id}'")

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
                
                # Handle different result types
                if hasattr(result, 'text'):
                    result_text = result.text
                elif hasattr(result, 'content'):
                    result_text = str(result.content)
                else:
                    result_text = str(result)
                
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
    
    def setInstalledMCPs(self, tools: List[MCPTool]) -> None:
        """Build installedMCPs using internal registry mapping and update config"""
        servers: Dict[str, Dict[str, Any]] = {}
        mcp_json = self.edge_config.config.safe_get("mcp_json", {})
        mcp_servers = mcp_json.get("mcpServers") or mcp_json.get("mcp", {}).get("servers", {}) or {}
        grouped: Dict[str, List[MCPTool]] = group_tools_by_server(tools, mcp_servers)

        for server_id, server_tools in grouped.items():
            clean_tools: List[Dict[str, Any]] = [
                {"name": t["name"], "description": t["description"], "inputSchema": t["inputSchema"]}
                for t in server_tools
            ]
            servers[server_id] = {
                'tools': clean_tools,
                'registryId': self.server_id_to_registry_id.get(server_id, server_id),
                'env': {},
                'status': 'READY',
            }

        # Ensure servers defined in config but missing from listed tools still appear
        for server_id, cfg in mcp_servers.items():
            if server_id not in servers:
                servers[server_id] = {
                    'tools': [],
                    'registryId': self.server_id_to_registry_id.get(server_id, server_id),
                    'env': cfg.get('env', {}),
                    'status': 'CRASHED',
                }

        logger.info(f"Setting MCPs (via collector): {len(servers)} servers")
        self.edge_config.config.update_value({"installedMCPs": servers})
    
    def disconnect(self):
        """Disconnect from all servers and unsubscribe from config changes"""
        if self._unsubscribe_fn:
            self._unsubscribe_fn()
            self._unsubscribe_fn = None
        self.unified_client = None
        self.config_file_path = None
        logger.info("Disconnected from MCP servers")

def group_tools_by_server(tools: List[MCPTool], mcp_servers: Dict[str, Any]) -> Dict[str, List[MCPTool]]:
    """Group tools by server_id extracted from tool names"""
    grouped: Dict[str, List[MCPTool]] = {}

    # Known server IDs from current config
    orig_ids = list(mcp_servers.keys())

    # Single-server: all tools belong to that server
    if len(orig_ids) == 1:
        grouped[orig_ids[0]] = tools[:]
        return grouped

    # Create alias map so prefixes from fastmcp (which may use hyphens) map back to original ids
    alias_to_orig = {}
    for sid in orig_ids:
        alias_to_orig[sid] = sid
        alias_to_orig[sid.replace('_', '-')] = sid

    # Multi-server: group only when prefix matches a known serverId (or its hyphen variant)
    default_bucket = "global"
    grouped[default_bucket] = []
    for tool in tools:
        name = tool.get("name", "")
        if "_" in name:
            prefix = name.split("_", 1)[0]
            if prefix in alias_to_orig:
                server_key = alias_to_orig[prefix]
                if server_key not in grouped:
                    grouped[server_key] = []
                grouped[server_key].append(tool)
                continue
        grouped[default_bucket].append(tool)

    if not grouped[default_bucket]:
        del grouped[default_bucket]
    return grouped
