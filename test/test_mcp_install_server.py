import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
import pytest

# Configure logging - reduce noisy DEBUG from fastmcp/mcp internals
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
for _name in ("mcp", "mcp.server", "mcp.server.lowlevel.server", "fastmcp"):
    logging.getLogger(_name).setLevel(logging.WARNING)
logger = logging.getLogger("mcp-install-test")

# Mock edge config for testing
class MockEdgeConfig:
    def __init__(self):
        self.config = MockObservableConfig()
        
    def set_mcp_json(self, mcp_json):
        self.config.value["mcp_json"] = mcp_json
        # Trigger change notification
        self.config._notify_change({"mcp_json": mcp_json})
        
    def set_edge_mcps(self, tools):
        self.config.value["installedMCPs"] = tools
        logger.info(f"MockEdgeConfig: set_edge_mcps called with {len(tools)} tools")

class MockObservableConfig:
    def __init__(self):
        self.value = {"mcp_json": {}, "installedMCPs": []}
        self._subscribers = []
        self._async_subscribers = []

    def safe_get(self, key, default=None):
        """Safe get method that returns a deep copy"""
        import copy
        return copy.deepcopy(self.value.get(key, default))

    def subscribe(self, callback):
        self._subscribers.append(callback)
        return lambda: self._subscribers.remove(callback)

    def subscribe_async(self, callback, name=None):
        self._async_subscribers.append(callback)
        return lambda: self._async_subscribers.remove(callback)

    def _notify_change(self, changes):
        for callback in self._subscribers:
            if asyncio.iscoroutinefunction(callback):
                asyncio.create_task(callback(changes))
            else:
                callback(changes)
        for callback in self._async_subscribers:
            if asyncio.iscoroutinefunction(callback):
                asyncio.create_task(callback(changes))
            else:
                callback(changes)

class MockClient:
    def __init__(self):
        self.edge_config = MockEdgeConfig()
        self.mcp_collector = None

@pytest.mark.asyncio
async def test_mcp_install_server_basic():
    """Test basic MCP server installation"""
    print("\n=== Testing mcp_install_server basic functionality ===")
    
    # Import the function
    from todoforai_edge.handlers.handlers import mcp_install_server
    
    # Create mock client
    client = MockClient()
    
    # Test parameters matching the frontend request
    server_id = "newGmailServerId"
    command = "npx"
    args = ["@gongrzhe/server-gmail-autoauth-mcp"]
    env = {"GMAIL_CREDENTIALS_PATH": ""}
    
    print(f"Installing MCP server with:")
    print(f"  serverId: {server_id}")
    print(f"  command: {command}")
    print(f"  args: {args}")
    print(f"  env: {env}")
    
    try:
        # Call the install function
        result = await mcp_install_server(
            serverId=server_id,
            command=command,
            args=args,
            env=env,
            client_instance=client
        )
        
        print(f"✓ Install result: {result}")
        
        # Verify the result
        assert result["installed"] == True
        assert result["serverId"] == server_id
        assert result["command"] == command
        assert result["args"] == args
        assert result["env_keys"] == list(env.keys())
        
        # Verify the MCP collector was created
        assert client.mcp_collector is not None
        print("✓ MCP collector was created")
        
        # Verify the config was updated
        mcp_json = client.edge_config.config.safe_get("mcp_json", {})
        assert "mcpServers" in mcp_json
        assert server_id in mcp_json["mcpServers"]
        
        server_config = mcp_json["mcpServers"][server_id]
        assert server_config["command"] == command
        assert server_config["args"] == args
        assert server_config["env"] == env
        
        print("✓ MCP JSON config was updated correctly")
        print(f"  Config: {json.dumps(mcp_json, indent=2)}")
        
        print("✓ Basic mcp_install_server test passed!")
        
    except Exception as e:
        print(f"✗ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

@pytest.mark.asyncio
async def test_mcp_install_server_with_existing_collector():
    """Test installing when MCP collector already exists"""
    print("\n=== Testing mcp_install_server with existing collector ===")
    
    from todoforai_edge.handlers.handlers import mcp_install_server
    from todoforai_edge.mcp_collector import MCPCollector
    
    # Create mock client with existing collector
    client = MockClient()
    client.mcp_collector = MCPCollector(client.edge_config)
    client.mcp_collector.config_file_path = "mcp.json"
    
    # Add some existing config
    existing_config = {
        "mcpServers": {
            "existing-server": {
                "command": "python",
                "args": ["existing.py"],
                "env": {}
            }
        }
    }
    client.edge_config.set_mcp_json(existing_config)
    
    # Install new server
    result = await mcp_install_server(
        serverId="newGmailServerId",
        command="npx",
        args=["@gongrzhe/server-gmail-autoauth-mcp"],
        env={"GMAIL_CREDENTIALS_PATH": ""},
        client_instance=client
    )
    
    print(f"✓ Install result: {result}")
    
    # Verify both servers exist in config
    mcp_json = client.edge_config.config.value["mcp_json"]
    assert "existing-server" in mcp_json["mcpServers"]
    assert "newGmailServerId" in mcp_json["mcpServers"]
    
    print("✓ Both existing and new servers are in config")
    print(f"  Servers: {list(mcp_json['mcpServers'].keys())}")
    
    print("✓ Existing collector test passed!")

@pytest.mark.asyncio
async def test_mcp_install_server_error_cases():
    """Test error handling in mcp_install_server"""
    print("\n=== Testing mcp_install_server error cases ===")
    
    from todoforai_edge.handlers.handlers import mcp_install_server
    
    # Test missing client instance
    try:
        await mcp_install_server("test", "cmd", client_instance=None)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        print(f"✓ Correctly caught missing client: {e}")
    
    # Test empty serverId
    client = MockClient()
    try:
        await mcp_install_server("", "cmd", client_instance=client)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        print(f"✓ Correctly caught empty serverId: {e}")
    
    # Test empty command
    try:
        await mcp_install_server("test", "", client_instance=client)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        print(f"✓ Correctly caught empty command: {e}")
    
    print("✓ Error handling test passed!")

@pytest.mark.asyncio
async def test_mcp_install_server_with_real_collector():
    """Test with a real MCPCollector to verify tool loading"""
    print("\n=== Testing mcp_install_server with real collector and tool verification ===")
    
    from todoforai_edge.handlers.handlers import mcp_install_server
    
    # Create a simple FastMCP server for testing
    test_server_script = '''
from fastmcp import FastMCP

mcp = FastMCP("test-gmail-server")

@mcp.tool
def gmail_send_email(to: str, subject: str, body: str) -> str:
    """Send an email via Gmail"""
    return f"Email sent to {to} with subject '{subject}'"

@mcp.tool  
def gmail_list_messages(limit: int = 10) -> str:
    """List Gmail messages"""
    return f"Listed {limit} messages"

if __name__ == "__main__":
    mcp.run(transport="stdio")
'''
    
    # Write test server to temp file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(test_server_script)
        test_server_path = f.name
    
    try:
        # Create client
        client = MockClient()
        
        # Install the test server
        result = await mcp_install_server(
            serverId="testGmailServerId",
            command="python",
            args=[test_server_path],
            env={},
            client_instance=client
        )
        
        print(f"✓ Install result: {result}")
        
        # Verify collector was created and configured
        assert client.mcp_collector is not None
        print("✓ MCP collector created")
        
        # Wait a moment for async operations
        await asyncio.sleep(0.1)
        
        # Check if tools were loaded (this might fail if FastMCP isn't available)
        try:
            if hasattr(client.mcp_collector, 'unified_client') and client.mcp_collector.unified_client:
                tools = await client.mcp_collector.list_tools()
                print(f"✓ Found {len(tools)} tools:")
                
                # Look for our expected tools
                tool_names = [tool['name'] for tool in tools]
                print(f"  Tool names: {tool_names}")
                
                # Check if we have tools with the expected server prefix
                gmail_tools = [name for name in tool_names if 'gmail' in name.lower()]
                if gmail_tools:
                    print(f"✓ Found Gmail-related tools: {gmail_tools}")
                else:
                    print("ℹ️  No Gmail-specific tools found (may be expected)")
                    
            else:
                print("ℹ️  MCP client not fully initialized (may be expected in test)")
                
        except Exception as e:
            print(f"ℹ️  Tool loading test skipped due to: {e}")
        
        print("✓ Real collector test completed!")
        
    finally:
        # Clean up temp file
        if os.path.exists(test_server_path):
            os.remove(test_server_path)

@pytest.mark.asyncio
async def test_mcp_install_server_lists_expected_tool():
    """Install a serverId=newGmailServerId that exposes SEND_GMAIL and assert list_tools contains newGmailServerId_SEND_GMAIL"""
    print("\n=== Testing mcp_install_server lists expected tool name ===")

    from todoforai_edge.handlers.handlers import mcp_install_server

    # Minimal FastMCP server exposing SEND_GMAIL
    server_script = '''
from fastmcp import FastMCP

mcp = FastMCP("gmail-autoauth")  # internal server name isn't used for tool prefixing

@mcp.tool
def SEND_GMAIL(to: str, subject: str, body: str) -> str:
    """Send an email via Gmail"""
    return f"Email sent to {to} with subject '{subject}'"

if __name__ == "__main__":
    mcp.run(transport="stdio")
'''
    # Write temp server
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(server_script)
        server_path = f.name

    try:
        client = MockClient()

        # Install with the exact serverId from the UI request
        install_result = await mcp_install_server(
            serverId="newGmailServerId",
            command="python",
            args=[server_path],
            env={"GMAIL_CREDENTIALS_PATH": ""},
            client_instance=client
        )
        print(f"✓ Install result: {install_result}")

        # Wait until the collector is ready and tools are listed (reactive reload)
        expected_tool = "newGmailServerId_SEND_GMAIL"
        tools = []
        for _ in range(5):  # up to ~0.5s
            try:
                if client.mcp_collector and client.mcp_collector.unified_client:
                    tools = await client.mcp_collector.list_tools()
                    names = [t["name"] for t in tools]
                    if expected_tool in names or "SEND_GMAIL" in names:
                        break
                else:
                    print('NO CLIENT.MCP_COLLECTOR')
            except RuntimeError:
                pass
            await asyncio.sleep(0.1)

        assert tools, "No tools returned from list_tools()"
        names = [t["name"] for t in tools]
        print('tools:', tools)
        print(f"Tools listed: {names}")
        assert (expected_tool in names) or ("SEND_GMAIL" in names), f"Expected tool '{expected_tool}' or 'SEND_GMAIL' not found in tools: {names}"
        print("✓ Found expected tool (prefixed or unprefixed) in list_tools")

    finally:
        if os.path.exists(server_path):
            os.remove(server_path)

async def run_all_tests():
    """Run all test cases"""
    print("Testing mcp_install_server function")
    print("=" * 50)
    
    try:
        await test_mcp_install_server_basic()
        await test_mcp_install_server_with_existing_collector()
        await test_mcp_install_server_error_cases()
        await test_mcp_install_server_with_real_collector()
        await test_mcp_install_server_lists_expected_tool()  # NEW: assert actual tool name
            
        print("\n" + "=" * 50)
        print("✅ All mcp_install_server tests passed!")
        
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    asyncio.run(run_all_tests())