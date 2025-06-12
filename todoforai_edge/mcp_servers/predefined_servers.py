"""
Predefined MCP server configurations in standard mcp.json format
"""

from .manager import MCPServerConfig
from typing import List

# Predefined servers using standard MCP configuration format
PREDEFINED_SERVERS = {
    "filesystem": MCPServerConfig(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]
    ),
    
    "puppeteer": MCPServerConfig(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-puppeteer"]
    ),
    
    "tavily": MCPServerConfig(
        command="npx",
        args=["-y", "tavily-mcp@0.1.4"],
        env={"TAVILY_API_KEY": "your-api-key-here"}
    ),
    
    "context7": MCPServerConfig(
        command="npx",
        args=["-y", "@upstash/context7-mcp@latest"]
    ),
    
    "brave-search": MCPServerConfig(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-brave-search"],
        env={"BRAVE_API_KEY": "your-api-key-here"}
    ),
    
    "github": MCPServerConfig(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-github"],
        env={"GITHUB_PERSONAL_ACCESS_TOKEN": "your-token-here"}
    ),
    
    "postgres": MCPServerConfig(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-postgres"],
        env={"POSTGRES_CONNECTION_STRING": "postgresql://user:password@localhost/db"}
    ),
    
    "sqlite": MCPServerConfig(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-sqlite", "/path/to/database.db"]
    ),
    
    "memory": MCPServerConfig(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-memory"]
    ),
}

# Git-based servers that need to be cloned and built
GIT_SERVERS = {
    "slack": {
        "git_url": "https://github.com/AVIMBU/slack-mcp-server.git",
        "install_commands": ["npm install", "npm run build"],
        "config": MCPServerConfig(
            command="node",
            args=["dist/index.js"],
            env={"SLACK_BOT_TOKEN": "your-bot-token", "SLACK_APP_TOKEN": "your-app-token"}
        )
    },
    
    "gdrive": {
        "git_url": "https://github.com/felores/gdrive-mcp-server.git",
        "install_commands": ["pip install -r requirements.txt"],
        "config": MCPServerConfig(
            command="python",
            args=["server.py"],
            env={"GOOGLE_APPLICATION_CREDENTIALS": "/path/to/credentials.json"}
        )
    },
    
    "coinmarket": {
        "git_url": "https://github.com/anjor/coinmarket-mcp-server.git",
        "install_commands": ["pip install -r requirements.txt"],
        "config": MCPServerConfig(
            command="python",
            args=["server.py"],
            env={"COINMARKETCAP_API_KEY": "your-api-key"}
        )
    },
}

def get_predefined_server(name: str) -> MCPServerConfig:
    """Get a predefined server configuration"""
    if name not in PREDEFINED_SERVERS:
        raise ValueError(f"Unknown predefined server: {name}")
    return PREDEFINED_SERVERS[name]

def get_git_server_info(name: str) -> dict:
    """Get git server information"""
    if name not in GIT_SERVERS:
        raise ValueError(f"Unknown git server: {name}. Available: {list(GIT_SERVERS.keys())}")
    return GIT_SERVERS[name]

def list_predefined_servers() -> List[str]:
    """List all predefined servers"""
    return list(PREDEFINED_SERVERS.keys())

def list_git_servers() -> List[str]:
    """List all git-based servers"""
    return list(GIT_SERVERS.keys())