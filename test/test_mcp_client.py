import asyncio
import json
import logging
import os
import tempfile
from todoforai_edge.mcp_collector import MCPCollector

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

logger = logging.getLogger("mcp-test")

async def test_filesystem_server():
    """Test with a simple filesystem MCP server"""
    mcp_collector = MCPCollector()
    
    # Test with filesystem server (more commonly available)
    server_id = "filesystem"
    # Use npx to run the official filesystem server
    server_path = "npx"  # This will be the command
    
    print(f"Adding MCP server: {server_id}")
    
    # For npx servers, we need to handle it differently
    # Let's create a simple test with a Python server instead
    
    # First, let's try with a simple echo server script
    echo_server_script = """
import asyncio
import json
import sys
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
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
                capabilities=app.get_capabilities()
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

async def test_slack_mcp_collector():
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
  
async def test_config_file_loading():
    """Test loading configuration from a file with FastMCP"""
    print("Testing MCP configuration file loading with FastMCP...")
    
    # Create a temporary config file
    config_data = {
        "mcpServers": {
            "echo-test": {
                "command": "python",
                "args": ["/tmp/echo_server.py"]
            }
        }
    }
    
    # Create the echo server script using FastMCP
    echo_server_script = """
from fastmcp import FastMCP

# Create server
mcp = FastMCP("echo-server")

@mcp.tool
def echo(text: str) -> str:
    \"\"\"Echo back the input text\"\"\"
    return f"Echo: {text}"

if __name__ == "__main__":
    mcp.run(transport="stdio")
"""
    
    # Write the echo server to a temporary file
    echo_server_path = "/tmp/echo_server.py"
    with open(echo_server_path, "w") as f:
        f.write(echo_server_script)
    
    # Write config to temporary file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(config_data, f, indent=2)
        config_file_path = f.name
    
    try:
        # Test loading from file
        mcp_collector = MCPCollector()
        results = await mcp_collector.load_servers(config_file_path)
        
        print(f"Connection results: {results}")
        
        if results.get("echo-test"):
            print("✓ Successfully connected to echo-test server")
            
            # Test calling the echo tool
            try:
                result = await mcp_collector.call_tool(
                    "echo", 
                    None,  # server_id not needed with unified edge
                    {"text": "Hello from FastMCP test!"}
                )
                print(f"Echo result: {result}")
                
                if "result" in result and "Echo: Hello from FastMCP test!" in str(result["result"]):
                    print("✓ Tool invocation test passed!")
                else:
                    print("✗ Tool invocation test failed!")
            except Exception as e:
                print(f"✗ Error invoking tool: {str(e)}")
        else:
            print("✗ Failed to connect to echo-test server")
        
    finally:
        # Clean up temp files
        if os.path.exists(config_file_path):
            os.remove(config_file_path)
        if os.path.exists(echo_server_path):
            os.remove(echo_server_path)
    
    print("✓ Configuration file loading test completed!")

async def test_simple_fastmcp_server():
    """Test with a simple FastMCP server"""
    print("\nTesting simple FastMCP server...")
    
    # Create a simple server script
    server_script = """
from fastmcp import FastMCP

mcp = FastMCP("test-server")

@mcp.tool
def add(a: int, b: int) -> int:
    \"\"\"Add two numbers\"\"\"
    return a + b

@mcp.tool
def greet(name: str) -> str:
    \"\"\"Greet someone\"\"\"
    return f"Hello, {name}!"

@mcp.resource("info://server")
def server_info() -> str:
    \"\"\"Get server information\"\"\"
    return "This is a test FastMCP server"

if __name__ == "__main__":
    mcp.run(transport="stdio")
"""
    
    # Write server to temp file
    server_path = "/tmp/test_fastmcp_server.py"
    with open(server_path, "w") as f:
        f.write(server_script)
    
    # Create config for this server
    config_data = {
        "mcpServers": {
            "test-server": {
                "command": "python",
                "args": [server_path]
            }
        }
    }
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(config_data, f, indent=2)
        config_file_path = f.name
    
    try:
        mcp_collector = MCPCollector()
        results = await mcp_collector.load_servers(config_file_path)
        
        print(f"Server connection results: {results}")
        
        if results.get("test-server"):
            print("✓ Successfully connected to test server")
            
            # Test the add tool
            try:
                result = await mcp_collector.call_tool("add", None, {"a": 5, "b": 3})
                print(f"Add result: {result}")
                
                if "result" in result and "8" in str(result["result"]):
                    print("✓ Add tool test passed!")
                else:
                    print("✗ Add tool test failed!")
            except Exception as e:
                print(f"✗ Error with add tool: {str(e)}")
            
            # Test the greet tool
            try:
                result = await mcp_collector.call_tool("greet", None, {"name": "FastMCP"})
                print(f"Greet result: {result}")
                
                if "result" in result and "Hello, FastMCP!" in str(result["result"]):
                    print("✓ Greet tool test passed!")
                else:
                    print("✗ Greet tool test failed!")
            except Exception as e:
                print(f"✗ Error with greet tool: {str(e)}")
        else:
            print("✗ Failed to connect to test server")
            
    finally:
        # Clean up
        if os.path.exists(config_file_path):
            os.remove(config_file_path)
        if os.path.exists(server_path):
            os.remove(server_path)
    
    print("✓ Simple FastMCP server test completed!")

async def test_config_parsing():
    """Test parsing different MCP configuration formats"""
    print("\nTesting MCP configuration parsing...")
    
    mcp_collector = MCPCollector()
    
    # Test format 1: with "mcp" wrapper
    config1 = {
        "mcp": {
            "servers": {
                "server1": {
                    "command": "python",
                    "args": ["server1.py"]
                }
            }
        }
    }
    
    # Test format 2: direct servers
    config2 = {
        "servers": {
            "server2": {
                "command": "node",
                "args": ["server2.js"]
            }
        }
    }
    
    # Write test configs
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(config1, f)
        config1_path = f.name
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(config2, f)
        config2_path = f.name
    
    try:
        # Test parsing format 1
        servers1 = mcp_collector._parse_config_file(config1_path)
        print(f"Config 1 servers: {servers1}")
        assert "server1" in servers1
        assert servers1["server1"]["command"] == "python"
        print("✓ Config format 1 parsing passed!")
        
        # Test parsing format 2
        servers2 = mcp_collector._parse_config_file(config2_path)
        print(f"Config 2 servers: {servers2}")
        assert "server2" in servers2
        assert servers2["server2"]["command"] == "node"
        print("✓ Config format 2 parsing passed!")
        
    finally:
        # Clean up
        if os.path.exists(config1_path):
            os.remove(config1_path)
        if os.path.exists(config2_path):
            os.remove(config2_path)
    
    print("✓ Configuration parsing test completed!")

if __name__ == "__main__":
    print("Testing FastMCP-based MCP Client Implementation")
    print("=" * 50)
    
    asyncio.run(test_config_parsing())
    asyncio.run(test_config_file_loading())
    asyncio.run(test_simple_fastmcp_server())
    
    print("\n" + "=" * 50)
    print("All FastMCP tests completed!")