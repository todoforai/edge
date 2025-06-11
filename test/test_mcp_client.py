import asyncio
import json
import logging
import os
from todoforai_edge.mcp_client import MCPCollector

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

logger = logging.getLogger("mcp-test")

async def test_filesystem_server():
    """Test with a simple filesystem MCP server"""
    mcp_collector = MCPCollector()
    
    # Test with filesystem server (more commonly available)
    server_id = "filesystem"
    
    print(f"Adding MCP server: {server_id}")
    
    # First, let's try with a simple echo server script
    echo_server_script = """
import asyncio
import json
import sys
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.server.lowlevel import NotificationOptions
from mcp import types

app = Server("echo-server")

@app.list_tools()
async def list_tools():
    return [
        types.Tool(
            name="echo",
            description="Echo back the input text",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text to echo"}
                },
                "required": ["text"]
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "echo":
        text = arguments.get("text", "")
        return [types.TextContent(type="text", text=f"Echo: {text}")]
    else:
        raise ValueError(f"Unknown tool: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="echo-server",
                server_version="0.1.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={}
                )
            )
        )

if __name__ == "__main__":
    asyncio.run(main())
"""
    
    # Write the echo server to a temporary file
    echo_server_path = "/tmp/echo_server.py"
    with open(echo_server_path, "w") as f:
        f.write(echo_server_script)
    
    # Connect to the server
    success = await mcp_collector.add_server(server_id, echo_server_path)
    
    if success:
        print(f"Successfully connected to server {server_id}")
        
        # Get all tools
        tools = mcp_collector.get_all_tools()
        print(f"Found {len(tools)} tools:")
        for server_id, tool in tools:
            print(f"  - {tool.name} from server {server_id}")
            print(f"    Description: {tool.description}")
        
        # Try to invoke the echo tool
        if tools:
            server_id, tool = tools[0]
            print(f"\nTrying to invoke tool: {tool.name}")
            
            try:
                result = await mcp_collector.call_tool(
                    tool.name, 
                    server_id, 
                    {"text": "Hello from MCP test!"}
                )
                print(f"Tool invocation result: {json.dumps(result, indent=2)}")
            except Exception as e:
                print(f"Error invoking tool: {str(e)}")
    else:
        print(f"Failed to connect to server {server_id}")
    
    # Clean up
    await mcp_collector.disconnect_all()
    
    # Clean up temp file
    if os.path.exists(echo_server_path):
        os.remove(echo_server_path)

async def test_slack_mcp_client():
    mcp_collector = MCPCollector()
    
    # Add a test MCP server
    server_id = "slack-mcp"

    # Path to the server script - adjust this to your actual path
    server_path = os.path.abspath("../mcp/slack-mcp-server/dist/index.js")
    
    print(f"Adding MCP server: {server_id}")
    print(f"Server path: {server_path}")
    
    # Connect to the server
    success = await mcp_collector.add_server(server_id, server_path)
    
    if success:
        print(f"Successfully connected to server {server_id}")
        
        # Get all tools
        tools = mcp_collector.get_all_tools()
        print(f"Found {len(tools)} tools:")
        for server_id, tool in tools:
            # print('tool:', tool)
            print(f"  - {tool.name} from server {server_id}")
            print(f"    Description: {tool.description}")
            print(f"    Parameters: {tool.inputSchema}")
        
        # Try to invoke a tool if any are available
        if tools:
            server_id, tool = tools[0]
            print(f"\nTrying to invoke tool: {tool.name}")
            
            # Prepare appropriate arguments based on the tool
            args = {}
            if tool.name == "slack_post_message":
                args = {
                    "channel_id": "C12345678",  # Replace with a real channel ID
                    "text": "Hello from MCP test!"
                }
            elif tool.name == "slack_get_users":
                args = {
                    "limit": 10
                }
            
            try:
                result = await mcp_collector.call_tool(tool.name, server_id, args)
                print(f"Tool invocation result: {json.dumps(result, indent=2)}")
            except Exception as e:
                print(f"Error invoking tool: {str(e)}")
    else:
        print(f"Failed to connect to server {server_id}")
    
    # Clean up
    await mcp_collector.disconnect_all()

async def test_simple_filesystem():
    """Test with the official filesystem MCP server using npx"""
    mcp_collector = MCPCollector()
    
    # Create a test directory
    test_dir = "/tmp/mcp_test_files"
    os.makedirs(test_dir, exist_ok=True)
    
    # Create a test file
    test_file = os.path.join(test_dir, "test.txt")
    with open(test_file, "w") as f:
        f.write("Hello from MCP filesystem test!")
    
    print(f"Created test directory: {test_dir}")
    print(f"Created test file: {test_file}")
    
    # Test the filesystem server - this requires npx and node
    server_id = "filesystem"
    
    # Create a simple filesystem server script instead
    fs_server_script = f"""
import asyncio
import os
import json
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.server.lowlevel import NotificationOptions
from mcp import types

app = Server("filesystem-server")

@app.list_tools()
async def list_tools():
    return [
        types.Tool(
            name="read_file",
            description="Read contents of a file",
            inputSchema={{
                "type": "object",
                "properties": {{
                    "path": {{"type": "string", "description": "Path to the file"}}
                }},
                "required": ["path"]
            }}
        ),
        types.Tool(
            name="list_directory",
            description="List contents of a directory",
            inputSchema={{
                "type": "object",
                "properties": {{
                    "path": {{"type": "string", "description": "Path to the directory"}}
                }},
                "required": ["path"]
            }}
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "read_file":
        path = arguments.get("path", "")
        try:
            # Only allow reading from test directory for security
            if not path.startswith("{test_dir}"):
                return [types.TextContent(type="text", text="Error: Access denied - path outside test directory")]
            
            with open(path, "r") as f:
                content = f.read()
            return [types.TextContent(type="text", text=content)]
        except Exception as e:
            return [types.TextContent(type="text", text=f"Error reading file: {{str(e)}}")]
    
    elif name == "list_directory":
        path = arguments.get("path", "")
        try:
            # Only allow listing test directory for security
            if not path.startswith("{test_dir}"):
                return [types.TextContent(type="text", text="Error: Access denied - path outside test directory")]
            
            files = os.listdir(path)
            return [types.TextContent(type="text", text="\\n".join(files))]
        except Exception as e:
            return [types.TextContent(type="text", text=f"Error listing directory: {{str(e)}}")]
    
    else:
        raise ValueError(f"Unknown tool: {{name}}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="filesystem-server",
                server_version="0.1.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={{}}
                )
            )
        )

if __name__ == "__main__":
    asyncio.run(main())
"""
    
    # Write the filesystem server to a temporary file
    fs_server_path = "/tmp/fs_server.py"
    with open(fs_server_path, "w") as f:
        f.write(fs_server_script)
    
    # Connect to the server
    success = await mcp_collector.add_server(server_id, fs_server_path)
    
    if success:
        print(f"Successfully connected to server {server_id}")
        
        # Get all tools
        tools = mcp_collector.get_all_tools()
        print(f"Found {len(tools)} tools:")
        for server_id, tool in tools:
            print(f"  - {tool.name} from server {server_id}")
            print(f"    Description: {tool.description}")
        
        # Test listing directory
        if tools:
            print(f"\nTesting list_directory tool:")
            try:
                result = await mcp_collector.call_tool(
                    "list_directory", 
                    server_id, 
                    {"path": test_dir}
                )
                print(f"Directory listing result: {json.dumps(result, indent=2)}")
            except Exception as e:
                print(f"Error listing directory: {str(e)}")
            
            print(f"\nTesting read_file tool:")
            try:
                result = await mcp_collector.call_tool(
                    "read_file", 
                    server_id, 
                    {"path": test_file}
                )
                print(f"File read result: {json.dumps(result, indent=2)}")
            except Exception as e:
                print(f"Error reading file: {str(e)}")
    else:
        print(f"Failed to connect to server {server_id}")
    
    # Clean up
    await mcp_collector.disconnect_all()
    
    # Clean up temp files
    if os.path.exists(fs_server_path):
        os.remove(fs_server_path)
    if os.path.exists(test_file):
        os.remove(test_file)
    if os.path.exists(test_dir):
        os.rmdir(test_dir)
  
if __name__ == "__main__":
    print("Testing MCP Echo Server:")
    asyncio.run(test_filesystem_server())
    
    print("\n" + "="*50 + "\n")
    
    print("Testing MCP Filesystem Server:")
    asyncio.run(test_simple_filesystem())