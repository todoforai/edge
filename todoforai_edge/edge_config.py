import logging
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
    MCPs: List[EdgeMCP]
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
        config_data: EdgeConfigData = {
            "id": data.get("id", ""),
            "name": data.get("name", "Name uninitialized"),
            "workspacepaths": data.get("workspacepaths", []),
            "MCPs": data.get("MCPs", []),
            "ownerId": data.get("ownerId", ""),
            "status": data.get("status", "OFFLINE"),
            "isShellEnabled": data.get("isShellEnabled", False),
            "isFileSystemEnabled": data.get("isFileSystemEnabled", False),
            "createdAt": data.get("createdAt", None)
        }
        self.config = registry.create("edge_config", config_data)
    
    @property
    def id(self) -> str:
        """Get edge ID"""
        return self.config.value.get("id", "")
    
    @property
    def name(self) -> str:
        """Get edge name"""
        return self.config.value.get("name", "Unknown Edge")
    
    @property
    def workspacepaths(self) -> List[str]:
        """Get workspace paths"""
        return self.config.value.get("workspacepaths", [])
    
    @property
    def owner_id(self) -> str:
        """Get owner ID"""
        return self.config.value.get("ownerId", "")
    
    @property
    def status(self) -> str:
        """Get status"""
        return self.config.value.get("status", "OFFLINE")
    
    @property
    def is_shell_enabled(self) -> bool:
        """Get shell enabled flag"""
        return self.config.value.get("isShellEnabled", False)
    
    @property
    def is_filesystem_enabled(self) -> bool:
        """Get filesystem enabled flag"""
        return self.config.value.get("isFileSystemEnabled", False)
    
    @property
    def created_at(self) -> Optional[str]:
        """Get created at timestamp"""
        return self.config.value.get("createdAt", None)
    
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
            self.config.value = updated
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
            self.config.value = updated
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

    def set_edge_mcps(self, tools: List[Dict[str, Any]]) -> None:
        """Backend: Convert directly to final format"""
        servers: List[Dict[str, Any]] = []
        grouped: Dict[str, List[Dict[str, Any]]] = self._group_tools_by_server(tools)
        
        for server_id, server_tools in grouped.items():
            # Remove server_id from individual tools before adding to server
            clean_tools: List[Dict[str, Any]] = []
            for tool in server_tools:
                clean_tool = {
                    "name": tool["name"],
                    "description": tool["description"], 
                    "inputSchema": tool["inputSchema"]
                }
                clean_tools.append(clean_tool)
            
            # Create server as a regular dict to ensure proper JSON serialization
            server = {
                'serverId': server_id,
                'tools': clean_tools,
                'status': 'UNINSTALLED', 
                'enabled': True,
                'env': {'isActive': True},
                'config': {'isActive': True}
            }
            servers.append(server)
        
        # Add debugging to see what we're actually setting
        logger.info(f"Setting MCPs: {servers}")
        
        # Ensure we're passing a properly serializable dictionary
        update_data = {"MCPs": servers}
        logger.info(f"Update data: {update_data}")
        
        self.config.update_value(update_data)
