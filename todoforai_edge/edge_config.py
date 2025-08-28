import logging
import uuid
from typing import List, Optional, Dict, Any, TypedDict
from .observable import observable_registry

logger = logging.getLogger("todoforai-edge")


class MCPTool(TypedDict):
    name: str
    description: str
    inputSchema: Dict[str, Any]


class EdgeMCP(TypedDict):
    serverId: str
    status: str  # MCPRunningStatus equivalent
    tools: List[MCPTool]
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
        self.config = observable_registry.create("edge_config", config_data)
    
    def add_workspace_path(self, path: str) -> bool:
        """Add a workspace path if it doesn't already exist"""
        current_paths = self.config["workspacepaths"]
        if path not in current_paths:
            # Create a new list with the added path
            new_paths = current_paths.copy()
            new_paths.append(path)
            
            # Update only the changed field
            self.config.update_value({"workspacepaths": new_paths})
            return True
        return False

    def set_mcp_json(self, mcp_config: Dict[str, Any]) -> None:
        """Set raw MCP JSON configuration - tools will be auto-updated via observer"""
        update_data = {"mcp_json": mcp_config}
        self.config.update_value(update_data)
        logger.info("Updated MCP JSON config - tools will be auto-updated")
