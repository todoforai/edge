#!/usr/bin/env python3
"""
Simple FastMCP server example
"""

from fastmcp import FastMCP
import os
import json
from datetime import datetime

mcp = FastMCP("simple-server")

@mcp.tool
def get_current_time() -> str:
    """Get the current time"""
    return datetime.now().isoformat()

@mcp.tool
def echo_message(message: str) -> str:
    """Echo a message back"""
    return f"Echo: {message}"

@mcp.tool
def list_files(directory: str = ".") -> dict:
    """List files in a directory"""
    try:
        files = []
        dirs = []
        
        for item in os.listdir(directory):
            path = os.path.join(directory, item)
            if os.path.isfile(path):
                files.append(item)
            elif os.path.isdir(path):
                dirs.append(item)
        
        return {
            "directory": directory,
            "files": files,
            "directories": dirs,
            "total": len(files) + len(dirs)
        }
    except Exception as e:
        return {"error": str(e)}

@mcp.tool
def calculate(expression: str) -> dict:
    """Safely calculate a mathematical expression"""
    try:
        # Only allow safe operations
        allowed_chars = set('0123456789+-*/()., ')
        if not all(c in allowed_chars for c in expression):
            return {"error": "Invalid characters in expression"}
        
        result = eval(expression)
        return {
            "expression": expression,
            "result": result
        }
    except Exception as e:
        return {"error": str(e)}

@mcp.resource("info://server")
def server_info() -> str:
    """Get server information"""
    return json.dumps({
        "name": "simple-server",
        "version": "1.0.0",
        "description": "A simple FastMCP server example",
        "tools": ["get_current_time", "echo_message", "list_files", "calculate"]
    }, indent=2)

if __name__ == "__main__":
    mcp.run(transport="stdio")