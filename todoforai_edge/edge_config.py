import logging
import uuid
from typing import List, Optional, Dict, Any, TypedDict
from .observable import registry

logger = logging.getLogger("todoforai-client")


class MCPToolSkeleton(TypedDict):
    name: str
    description: str
    inputSchema: Any


class EdgeMCP(TypedDict):
    serverId: str
    status: str  # MCPRunningStatus equivalent
    tools: List[MCPToolSkeleton]
    env: Dict[str, Any]  # MCPEnv equivalent
    config: Dict[str, Any]  # MCPEnv equivalent
    enabled: bool
    error: Optional[str]


class EdgeConfigData(TypedDict):
    id: str
    name: str
    workspacepaths: List[str]
    installedMCPs: Dict[str, Dict[str, Any]]
    mcp_json: Dict[str, Any]  # Add raw MCP JSON config
    ownerId: str
    status: str  # EdgeStatus equivalent
    isShellEnabled: bool
    isFileSystemEnabled: bool
    createdAt: Optional[str]


class EdgeConfig:
    """Edge configuration class with observable pattern"""
    def __init__(self, data: Optional[Dict[str, Any]] = None):
        data = data or {}
        # Create an observable for the entire config with typed structure
        config_data = {
            "id": data.get("id", ""),
            "name": data.get("name", "Name uninitialized"),
            "workspacepaths": data.get("workspacepaths", []),
            "installedMCPs": data.get("installedMCPs", {}),
            "mcp_json": data.get("mcp_json", {}),
            "ownerId": data.get("ownerId", ""),
            "status": data.get("status", "OFFLINE"),
            "isShellEnabled": data.get("isShellEnabled", False),
            "isFileSystemEnabled": data.get("isFileSystemEnabled", False),
            "createdAt": data.get("createdAt", None)
        }
        self.config = registry.create("edge_config", config_data)
    
    @property
    def workspacepaths(self) -> List[str]:
        return self.config["workspacepaths"]

    def add_workspace_path(self, path: str) -> bool:
        """Add a workspace path if it doesn't already exist"""
        current_paths = self.workspacepaths
        if path not in current_paths:
            # Create a new list with the added path
            new_paths = current_paths.copy()
            new_paths.append(path)
            
            # Update the config with the new paths
            current = self.config.value
            updated = current.copy()
            updated["workspacepaths"] = new_paths
            self.config.update_value(updated)
            return True
        return False

    def remove_workspace_path(self, path: str) -> bool:
        """Remove a workspace path if it exists"""
        current_paths = self.workspacepaths
        if path in current_paths:
            # Create a new list without the removed path
            new_paths = [p for p in current_paths if p != path]
            
            # Update the config with the new paths
            current = self.config.value
            updated = current.copy()
            updated["workspacepaths"] = new_paths
            self.config.update_value(updated)
            return True
        return False

    def _group_tools_by_server(self, tools: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group tools by server_id"""
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for tool in tools:
            # Extract server_id from tool name (FastMCP format: {server_id}_{tool_name})
            server_id: str = tool.get('server_id') or tool['name'].split('_')[0]
            if server_id not in grouped:
                grouped[server_id] = []
            grouped[server_id].append(tool)
        return grouped

    def set_mcp_json(self, mcp_config: Dict[str, Any]) -> None:
        """Set raw MCP JSON configuration - tools will be auto-updated via observer"""
        update_data = {"mcp_json": mcp_config}
        self.config.update_value(update_data)
        logger.info("Updated MCP JSON config - tools will be auto-updated")

    def set_edge_mcps(self, tools: List[Dict[str, Any]]) -> None:
        """Backend: Convert directly to final format"""
        servers: Dict[str, Dict[str, Any]] = {}  # Changed from List to Dict
        grouped: Dict[str, List[Dict[str, Any]]] = self._group_tools_by_server(tools)
        
        for server_id, server_tools in grouped.items():
            # Clean tool names by removing server prefix
            clean_tools: List[Dict[str, Any]] = []
            for tool in server_tools:
                # Remove server_id prefix from tool name (e.g., "puppeteer_puppeteer_click" -> "click")
                tool_name = tool["name"]
                if tool_name.startswith(f"{server_id}_"):
                    clean_name = tool_name[len(f"{server_id}_"):]
                    # Remove duplicate server_id if it appears again
                    if clean_name.startswith(f"{server_id}_"):
                        clean_name = clean_name[len(f"{server_id}_"):]
                else:
                    clean_name = tool_name
                
                clean_tool = {
                    "name": clean_name,
                    "description": tool["description"], 
                    "inputSchema": tool["inputSchema"]
                }
                clean_tools.append(clean_tool)
            
            # Create server matching frontend InstalledMCP structure
            server = {
                'serverId': server_id,
                'tools': clean_tools,
                'registryId': "provider@tool", # smithery@gmail
                'env': {},
            }
            servers[server_id] = server  # Use serverId as key
        
        logger.info(f"Setting MCPs: {len(servers)} servers with cleaned tool names")
        
        update_data = {"installedMCPs": servers}
        self.config.update_value(update_data)
