import asyncio
import json
import subprocess
from todoforai_edge.mcp_client import MCPCollector
from todoforai_edge.handlers import mcp_list_tools, mcp_call_tool

class MockClient:
    def __init__(self):
        self.mcp_collector = None

async def test_current_mcp_config():
    """Test with the current mcp.json file"""
    print("Testing with current mcp.json file...")
    
    mock_client = MockClient()
    mock_client.mcp_collector = MCPCollector()
    
    try:
        # Load the current mcp.json file
        results = await mock_client.mcp_collector.load_servers("mcp.json")
        print(f"Server load results: {results}")
        
        # Test mcp_list_tools
        tools_output = await mcp_list_tools(client_instance=mock_client)
        
        print("\nmcp_list_tools output:")
        print("=" * 50)
        print(json.dumps(tools_output, indent=2, default=str))
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

async def test_puppeteer_connect_active_tab():
    """Test puppeteer_puppeteer_connect_active_tab function"""
    print("\nTesting puppeteer_puppeteer_connect_active_tab...")
    print("=" * 50)
    
    mock_client = MockClient()
    mock_client.mcp_collector = MCPCollector()
    
    try:
        # Load servers first
        results = await mock_client.mcp_collector.load_servers("mcp.json")
        print(f"Server load results: {results}")
        
        # Check if puppeteer tools are available
        tools_output = await mcp_list_tools(client_instance=mock_client)
        puppeteer_tools = [tool for tool in tools_output.get('tools', []) if 'puppeteer' in tool.get('name', '').lower()]
        
        if not puppeteer_tools:
            print("No puppeteer tools found. Available tools:")
            for tool in tools_output.get('tools', []):
                print(f"  - {tool.get('name', 'Unknown')}")
            return
        
        print(f"Found {len(puppeteer_tools)} puppeteer tools")
        
        # First check if Chrome is running with remote debugging
        print("\nChecking if Chrome is running with remote debugging on port 9222...")
        try:
            result = subprocess.run(['curl', '-s', 'http://localhost:9222/json/version'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                print("✓ Chrome is running with remote debugging enabled")
                print(f"Chrome info: {result.stdout}")
            else:
                print("✗ Chrome is not running with remote debugging on port 9222")
                print("Please start Chrome with: google-chrome --remote-debugging-port=9222")
                return
        except Exception as e:
            print(f"✗ Could not check Chrome status: {e}")
            print("Please start Chrome with: google-chrome --remote-debugging-port=9222")
            return
        
        # Test puppeteer_puppeteer_connect_active_tab with default parameters
        print("\nTesting puppeteer_puppeteer_connect_active_tab with default parameters...")
        result = await mcp_call_tool(
            tool_name="puppeteer_puppeteer_connect_active_tab",
            arguments={},
            client_instance=mock_client
        )
        print("Result with default parameters:")
        print(json.dumps(result, indent=2, default=str))
        
        # If successful, try to navigate to a test page
        if "error" not in str(result).lower():
            print("\nTesting navigation to example.com...")
            # nav_result = await mcp_call_tool(
            #     tool_name="puppeteer_puppeteer_navigate",
            #     arguments={"url": "https://example.com"},
            #     client_instance=mock_client
            # )
            # print("Navigation result:")
            # print(json.dumps(nav_result, indent=2, default=str))
            
            # Take a screenshot
            print("\nTaking a screenshot...")
            screenshot_result = await mcp_call_tool(
                tool_name="puppeteer_puppeteer_screenshot",
                arguments={"name": "test_screenshot", "width": 100, "height": 100},
                client_instance=mock_client
            )
            print("Screenshot result:")
            print(json.dumps(screenshot_result, indent=2, default=str))
        
    except Exception as e:
        print(f"Error testing puppeteer connect: {e}")
        import traceback
        traceback.print_exc()

async def run_all_tests():
    """Run all test cases"""
    await test_current_mcp_config()
    await test_puppeteer_connect_active_tab()

if __name__ == "__main__":
    asyncio.run(run_all_tests())