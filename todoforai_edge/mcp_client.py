import logging
import asyncio
from typing import Dict, List, Optional, Any
from contextlib import AsyncExitStack
import os.path

from mcp import ClientSession, StdioServerParameters, Tool
from mcp.client.stdio import stdio_client

logger = logging.getLogger("todoforai-mcp")

class MCPClient:
    """Client for connecting to MCP servers"""
    def __init__(self, server_id: str):
        self.id = server_id
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
        self.tools: List[Tool] = []
        self.is_connected = False

    async def connect(self, server_path: str, env: Optional[Dict[str, str]] = None) -> bool:
        """Connect to an MCP server
        
        Args:
            server_path: Path to the server script (.py or .js)
            env: Optional environment variables to pass to the server
        """
        try:
            # Determine the command based on file extension
            is_python = server_path.endswith('.py')
            is_js = server_path.endswith('.js')
            
            if not (is_python or is_js):
                logger.error(f"Server script must be a .py or .js file: {server_path}")
                return False
                
            if not os.path.exists(server_path):
                logger.error(f"Server script not found: {server_path}")
                return False

            command = "python" if is_python else "node"
            server_params = StdioServerParameters(
                command=command,
                args=[server_path],
                env=env
            )

            logger.info(f"Starting MCP server: {command} {server_path}")
            
            # Connect to the server
            stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
            stdio, write = stdio_transport
            self.session = await self.exit_stack.enter_async_context(ClientSession(stdio, write))

            # Initialize the session
            await self.session.initialize()

            # List available tools
            response = await self.session.list_tools()
            self.tools = response.tools
            
            tool_names = [tool.name for tool in self.tools]
            logger.info(f"Connected to MCP server {self.id} with tools: {tool_names}")
            
            self.is_connected = True
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to MCP server {self.id}: {str(e)}")
            await self.disconnect()
            return False

    async def disconnect(self):
        """Disconnect from the MCP server"""
        if self.is_connected:
            try:
                await self.exit_stack.aclose()
            except Exception as e:
                logger.error(f"Error disconnecting from server {self.id}: {str(e)}")
            finally:
                self.session = None
                self.tools = []
                self.is_connected = False
                logger.info(f"Disconnected from MCP server {self.id}")

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Invoke a tool on the MCP server"""
        if not self.is_connected or not self.session:
            raise RuntimeError(f"Not connected to MCP server {self.id}")
        
        # Check if the tool exists
        tool_exists = any(tool.name == tool_name for tool in self.tools)
        if not tool_exists:
            raise ValueError(f"Tool '{tool_name}' not found on server {self.id}")
        
        try:
            # Call the tool using the MCP client library
            # Using call_tool instead of run_tool
            response = await self.session.call_tool(tool_name, arguments)
            
            # Return the result
            return response.content
                
        except Exception as e:
            logger.error(f"Error invoking tool {tool_name}: {str(e)}")
            return {"error": str(e)}


class MCPCollector:
    """Manages multiple MCP clients"""
    def __init__(self):
        self.clients: Dict[str, MCPClient] = {}
        self.tools_by_name: Dict[str, List[Tool]] = {}

    async def add_server(self, server_id: str, server_path: str) -> bool:
        """Add and connect to a new MCP server"""
        if server_id in self.clients:
            logger.warning(f"Server with ID {server_id} already exists, replacing")
            await self.remove_server(server_id)
        
        client = MCPClient(server_id)
        success = await client.connect(server_path)
        
        if success:
            self.clients[server_id] = client
            self._update_tools_mapping(client)
            return True
        return False

    async def remove_server(self, server_id: str):
        """Remove a server from the collector"""
        if server_id in self.clients:
            client = self.clients[server_id]
            await client.disconnect()
            del self.clients[server_id]
            self._rebuild_tools_mapping()

    async def disconnect_all(self):
        """Disconnect from all servers"""
        for client in list(self.clients.values()):
            await client.disconnect()
        self.clients.clear()
        self.tools_by_name.clear()

    def _update_tools_mapping(self, client: MCPClient):
        """Update the tools mapping with a client's tools"""
        for tool in client.tools:
            if tool.name not in self.tools_by_name:
                self.tools_by_name[tool.name] = []
            self.tools_by_name[tool.name].append((client.id, tool))

    def _rebuild_tools_mapping(self):
        """Rebuild the mapping of tool names to tools"""
        self.tools_by_name = {}
        for client in self.clients.values():
            self._update_tools_mapping(client)

    def get_all_tools(self) -> List[tuple]:
        """Get a list of all available tools from all servers"""
        all_tools = []
        for tools_list in self.tools_by_name.values():
            all_tools.extend(tools_list)
        return all_tools

    def get_tools_by_name(self, tool_name: str) -> List[tuple]:
        """Get all tools with the given name across all servers"""
        return self.tools_by_name.get(tool_name, [])

    async def call_tool(self, tool_name: str, server_id: Optional[str], arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Invoke a tool on a specific server or the first available server that has the tool"""
        if server_id:
            # Invoke on a specific server
            if server_id not in self.clients:
                raise ValueError(f"Server {server_id} not found")
            
        else:
            # Find the first server that has this tool
            tools = self.get_tools_by_name(tool_name)
            if not tools:
                raise ValueError(f"Tool {tool_name} not found on any server")
            
            # Use the first available tool
            server_id, _ = tools[0]

        client = self.clients[server_id]
        return await client.call_tool(tool_name, arguments)
