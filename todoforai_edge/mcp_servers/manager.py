import os
import json
import logging
import asyncio
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger("todoforai-mcp-manager")

class ServerType(Enum):
    FASTMCP_LOCAL = "fastmcp_local"
    NPX_PACKAGE = "npx_package"
    PYTHON_SCRIPT = "python_script"
    NODE_SCRIPT = "node_script"
    EXECUTABLE = "executable"
    GIT_CLONE = "git_clone"

@dataclass
class MCPServerConfig:
    """Configuration for an MCP server"""
    name: str
    server_type: ServerType
    command: str
    args: List[str] = None
    env: Dict[str, str] = None
    working_dir: Optional[str] = None
    auto_install: bool = True
    git_url: Optional[str] = None
    install_commands: List[str] = None
    description: str = ""
    
    def __post_init__(self):
        if self.args is None:
            self.args = []
        if self.env is None:
            self.env = {}
        if self.install_commands is None:
            self.install_commands = []

class MCPServerManager:
    """Manages MCP servers installation, configuration, and lifecycle"""
    
    def __init__(self, servers_dir: str = None):
        self.servers_dir = Path(servers_dir or os.path.join(os.path.dirname(__file__), "servers"))
        self.servers_dir.mkdir(exist_ok=True)
        self.config_file = self.servers_dir / "servers_config.json"
        self.mcp_config_file = self.servers_dir / "mcp.json"
        self.servers: Dict[str, MCPServerConfig] = {}
        self.load_servers_config()
    
    def load_servers_config(self):
        """Load servers configuration from file"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    data = json.load(f)
                    for name, config_dict in data.items():
                        config_dict['server_type'] = ServerType(config_dict['server_type'])
                        self.servers[name] = MCPServerConfig(**config_dict)
                logger.info(f"Loaded {len(self.servers)} server configurations")
            except Exception as e:
                logger.error(f"Error loading servers config: {e}")
    
    def save_servers_config(self):
        """Save servers configuration to file"""
        try:
            data = {}
            for name, config in self.servers.items():
                config_dict = asdict(config)
                config_dict['server_type'] = config.server_type.value
                data[name] = config_dict
            
            with open(self.config_file, 'w') as f:
                json.dump(data, f, indent=2)
            logger.info(f"Saved {len(self.servers)} server configurations")
        except Exception as e:
            logger.error(f"Error saving servers config: {e}")
    
    def add_server(self, config: MCPServerConfig) -> bool:
        """Add a new server configuration"""
        try:
            self.servers[config.name] = config
            self.save_servers_config()
            logger.info(f"Added server configuration: {config.name}")
            return True
        except Exception as e:
            logger.error(f"Error adding server {config.name}: {e}")
            return False
    
    def remove_server(self, name: str) -> bool:
        """Remove a server configuration"""
        if name in self.servers:
            del self.servers[name]
            self.save_servers_config()
            logger.info(f"Removed server configuration: {name}")
            return True
        return False
    
    async def install_server(self, name: str) -> bool:
        """Install a server based on its configuration"""
        if name not in self.servers:
            logger.error(f"Server {name} not found in configuration")
            return False
        
        config = self.servers[name]
        server_dir = self.servers_dir / name
        
        try:
            if config.server_type == ServerType.GIT_CLONE:
                return await self._install_git_server(config, server_dir)
            elif config.server_type == ServerType.NPX_PACKAGE:
                return await self._install_npx_server(config)
            elif config.server_type == ServerType.FASTMCP_LOCAL:
                return await self._install_fastmcp_server(config, server_dir)
            else:
                logger.info(f"Server {name} doesn't require installation")
                return True
        except Exception as e:
            logger.error(f"Error installing server {name}: {e}")
            return False
    
    async def _install_git_server(self, config: MCPServerConfig, server_dir: Path) -> bool:
        """Install a server from git repository"""
        if not config.git_url:
            logger.error(f"No git URL provided for server {config.name}")
            return False
        
        if server_dir.exists():
            logger.info(f"Server {config.name} already cloned, pulling updates")
            process = await asyncio.create_subprocess_exec(
                "git", "pull",
                cwd=server_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
        else:
            logger.info(f"Cloning server {config.name} from {config.git_url}")
            process = await asyncio.create_subprocess_exec(
                "git", "clone", config.git_url, str(server_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"Git operation failed for {config.name}: {stderr.decode()}")
            return False
        
        # Run install commands if provided
        for cmd in config.install_commands:
            success = await self._run_install_command(cmd, server_dir)
            if not success:
                return False
        
        return True
    
    async def _install_npx_server(self, config: MCPServerConfig) -> bool:
        """Install NPX-based server (no actual installation needed)"""
        logger.info(f"NPX server {config.name} will be run on-demand")
        return True
    
    async def create_fastmcp_server(self, name: str, template_content: str = None) -> bool:
        """Create a FastMCP server"""
        server_dir = self.servers_dir / name
        server_dir.mkdir(exist_ok=True)
        
        server_file = server_dir / "server.py"
        
        if not server_file.exists():
            template = template_content or self._get_fastmcp_template(name)
            with open(server_file, 'w') as f:
                f.write(template)
        
        # Add to configuration
        config = MCPServerConfig(
            command="python",
            args=[str(server_file)],
            cwd=str(server_dir)
        )
        
        return self.add_server(name, config)
    
    async def _run_install_command(self, command: str, cwd: Path) -> bool:
        """Run an installation command"""
        logger.info(f"Running install command: {command}")
        
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"Install command failed: {stderr.decode()}")
            return False
        
        logger.info(f"Install command completed successfully")
        return True
    
    def _get_fastmcp_template(self, server_name: str) -> str:
        """Get a basic FastMCP server template"""
        return f'''#!/usr/bin/env python3
"""
FastMCP Server: {server_name}
Auto-generated template - customize as needed
"""

from fastmcp import FastMCP

# Create server instance
mcp = FastMCP("{server_name}")

@mcp.tool
def hello(name: str = "World") -> str:
    """Say hello to someone"""
    return f"Hello, {{name}}!"

@mcp.tool  
def get_server_info() -> dict:
    """Get information about this server"""
    return {{
        "name": "{server_name}",
        "type": "FastMCP",
        "version": "1.0.0"
    }}

@mcp.resource("info://server")
def server_resource() -> str:
    """Server information resource"""
    return f"This is the {server_name} FastMCP server"

if __name__ == "__main__":
    mcp.run(transport="stdio")
'''
    
    def generate_mcp_config(self) -> Dict:
        """Generate MCP configuration for all servers"""
        config = {"mcpServers": {}}
        
        for name, server_config in self.servers.items():
            mcp_server_config = self._get_mcp_server_config(server_config)
            if mcp_server_config:
                config["mcpServers"][name] = mcp_server_config
        
        return config
    
    def _get_mcp_server_config(self, config: MCPServerConfig) -> Optional[Dict]:
        """Convert server config to MCP format"""
        if config.server_type == ServerType.FASTMCP_LOCAL:
            server_dir = self.servers_dir / config.name
            server_file = server_dir / "server.py"
            return {
                "command": "python",
                "args": [str(server_file)],
                "env": config.env,
                "cwd": str(server_dir) if config.working_dir else None
            }
        elif config.server_type == ServerType.NPX_PACKAGE:
            return {
                "command": "npx",
                "args": ["-y"] + ([config.command] if config.command else []) + config.args,
                "env": config.env
            }
        elif config.server_type == ServerType.PYTHON_SCRIPT:
            return {
                "command": "python",
                "args": [config.command] + config.args,
                "env": config.env,
                "cwd": config.working_dir
            }
        elif config.server_type == ServerType.NODE_SCRIPT:
            return {
                "command": "node", 
                "args": [config.command] + config.args,
                "env": config.env,
                "cwd": config.working_dir
            }
        elif config.server_type == ServerType.GIT_CLONE:
            server_dir = self.servers_dir / config.name
            return {
                "command": config.command,
                "args": config.args,
                "env": config.env,
                "cwd": str(server_dir)
            }
        elif config.server_type == ServerType.EXECUTABLE:
            return {
                "command": config.command,
                "args": config.args,
                "env": config.env,
                "cwd": config.working_dir
            }
        
        return None
    
    def save_mcp_config(self) -> bool:
        """Save MCP configuration file"""
        try:
            config = self.generate_mcp_config()
            with open(self.mcp_config_file, 'w') as f:
                json.dump(config, f, indent=2)
            logger.info(f"Saved MCP configuration with {len(config['mcpServers'])} servers")
            return True
        except Exception as e:
            logger.error(f"Error saving MCP config: {e}")
            return False
    
    async def install_all_servers(self) -> Dict[str, bool]:
        """Install all configured servers"""
        results = {}
        for name in self.servers.keys():
            results[name] = await self.install_server(name)
        return results
    
    def list_servers(self) -> List[Dict]:
        """List all configured servers"""
        return [
            {
                "name": config.name,
                "type": config.server_type.value,
                "description": config.description,
                "auto_install": config.auto_install
            }
            for config in self.servers.values()
        ]