import os
import json
from todoforai_edge.mcp_collector import MCPCollector


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