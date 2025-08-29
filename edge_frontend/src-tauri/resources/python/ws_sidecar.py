#!/usr/bin/env python3
"""
WebSocket-based sidecar for Tauri-Python communication.
Can be used both in development mode and as an alternative to stdio_sidecar.py.
"""

import asyncio
import json
import sys
import os
import time
import traceback
import argparse
import logging
import threading
from typing import Any, Dict, Callable, Set
import websockets

# Import TODOforAI Edge edge
from todoforai_edge.mcp_collector import set_mcp_tool_call_callback
from todoforai_edge.edge import TODOforAIEdge
from todoforai_edge.config import default_config, Config
from todoforai_edge.handlers.file_sync import start_workspace_sync, stop_workspace_sync, active_sync_managers, WorkspaceSyncManager
from todoforai_edge.utils import normalize_api_url

async def _broadcast_auth_success():
    """Helper to broadcast auth success event"""
    asyncio.create_task(broadcast_event({
        "type": "auth_success",
        "payload": {
            "apiKey": sidecar.todo_edge.api_key,
            "email": sidecar.todo_edge.email,
        }
    }))

async def _broadcast_config_update():
    """Helper to broadcast config update event"""
    asyncio.create_task(broadcast_event({
        "type": "edge:config_update",
        "payload": sidecar.todo_edge.edge_config.config.safe_value
    }))

async def _broadcast_active_workspaces():
    """Helper to broadcast active workspaces event"""
    asyncio.create_task(broadcast_event({
        "type": "active_workspaces_change",
        "payload": {
            "activeWorkspaces": list(active_sync_managers.keys())
        }
    }))

# Helper functions for common broadcast patterns
async def _broadcast_auth_error(message: str):
    """Helper to broadcast auth error event"""
    asyncio.create_task(broadcast_event({
        "type": "auth_error",
        "payload": {"message": message}
    }))

async def _broadcast_file_sync(action: str, abs_path: str, workspace_dir: str, size: int = None):
    """Helper to broadcast file sync event"""
    payload = {
        "action": action,
        "path": abs_path,
        "workspace": workspace_dir
    }
    if size is not None:
        payload["size"] = size
        
    asyncio.create_task(broadcast_event({
        "type": "file_sync",
        "payload": payload,
        "timestamp": int(time.time() * 1000)
    }))

async def _broadcast_file_sync_complete(workspace_dir: str, file_count: int):
    """Helper to broadcast file sync complete event"""
    asyncio.create_task(broadcast_event({
        "type": "file_sync_complete",
        "payload": {
            "workspace": workspace_dir,
            "file_count": file_count
        }
    }))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
log = logging.getLogger('ws_sidecar')

class WebSocketSidecar:
    def __init__(self):
        self.handlers: Dict[str, Callable[[Any], Any]] = {}
        self.todo_edge = None
        self.edge_thread = None
        self.default_api_url = None
        self.edge_lock = threading.Lock()
        self.connected_edges: Set = set()
        self.nonverbose_types = {'file_sync'}
        
    def rpc(self, func):
        """Decorator to register RPC functions"""
        self.handlers[func.__name__] = func
        return func

# Global instance
sidecar = WebSocketSidecar()

@sidecar.rpc
def ping(message):
    """Simple ping function that returns a pong with the message"""
    return {"response": f"pong: {message}"}

@sidecar.rpc
def validate_stored_credentials(credentials):
    """Validate stored credentials with the server"""
    # This function is deprecated - validation should happen during normal auth flow
    return {"valid": True, "message": "Validation will happen during authentication"}

async def _send_initial_state_events():
    """Send all initial state events for reconnected edges"""
    if not sidecar.todo_edge:
        return
        
    await _broadcast_config_update()
    await _broadcast_active_workspaces()
  
@sidecar.rpc
def login(credentials):
    """Login with email and password or API key"""
    try:
        config = _create_config_from_credentials(credentials)
        log.info(f"Using API URL: {config.api_url}")
        
        with sidecar.edge_lock:
            # Check if we're already connected with the same credentials
            if sidecar.todo_edge and sidecar.todo_edge.connected:
                if _has_same_credentials(config):
                    log.info("Already connected with the same credentials, sending auth_success")
                    asyncio.create_task(_broadcast_auth_success())
                    asyncio.create_task(_send_initial_state_events())
                    return {"status": "success", "message": "Already connected with the same credentials"}
                else:
                    log.info("Disconnecting existing edge to connect with new credentials")
                    _disconnect_existing_edge()
            
            _start_new_edge(config)
        
        return {"status": "connecting", "message": "Client is connecting..."}
        
    except Exception as e:
        error_msg = f"Login error: {str(e)}"
        log.error(error_msg)
        traceback.print_exc()
        asyncio.create_task(_broadcast_auth_error(error_msg))
        return {"status": "error", "message": error_msg}

def _has_same_credentials(config: Config) -> bool:
    """Check if the new config has the same credentials as the current edge"""
    if not sidecar.todo_edge:
        return False
        
    # Check if API key matches
    if config.api_key and sidecar.todo_edge.api_key and config.api_key == sidecar.todo_edge.api_key:
        return True
        
    # Or check if email/password match
    if (config.email and config.password and 
        sidecar.todo_edge.email and sidecar.todo_edge.password and
        config.email == sidecar.todo_edge.email and 
        config.password == sidecar.todo_edge.password):
        return True
        
    return False

def _create_config_from_credentials(credentials):
    """Create config object from credentials"""
    config = default_config()
    
    if "email" in credentials:
        config.email = credentials["email"]
    if "password" in credentials:
        config.password = credentials["password"]
    if "apiKey" in credentials:
        config.api_key = credentials["apiKey"]
        
    # Use API URL from credentials or default
    if "apiUrl" in credentials and credentials["apiUrl"]:
        config.api_url = credentials["apiUrl"]
    elif sidecar.default_api_url:
        config.api_url = sidecar.default_api_url
        
    # Normalize URL format
    if config.api_url:
        config.api_url = normalize_api_url(config.api_url)
        
    config.debug = credentials.get("debug", False)
    return config

def _start_new_edge(config):
    """Start a new edge with the given config"""
    sidecar.todo_edge = TODOforAIEdge(config)
    
    def thread_target():
        asyncio.run(_run_edge())
        
    sidecar.edge_thread = threading.Thread(target=thread_target, daemon=True)
    sidecar.edge_thread.start()

def _disconnect_existing_edge():
    """Disconnect the existing edge"""
    if sidecar.todo_edge and sidecar.todo_edge.connected:
        sidecar.todo_edge.connected = False
        if sidecar.todo_edge.heartbeat_task:
            sidecar.todo_edge.heartbeat_task.cancel()
    if sidecar.edge_thread and sidecar.edge_thread.is_alive():
        sidecar.edge_thread.join(timeout=2)

def _setup_edge_hooks():
        
    # Add message handler to forward messages to frontend
    original_handle_message = sidecar.todo_edge._handle_message
    
    async def handle_message_wrapper(message):
        # Forward message to frontend
        asyncio.create_task(broadcast_event({
            "type": "ws_message",
            "payload": json.loads(message)
        }))
        # Call original handler
        await original_handle_message(message)
        
    sidecar.todo_edge._handle_message = handle_message_wrapper
    
    # Hook into shutdown request handler
    # original_handle_shutdown = sidecar.todo_edge.handle_shutdown_request
    
    # async def handle_shutdown_wrapper(payload):
    #     # Broadcast shutdown event to frontend first
    #     await broadcast_event({
    #         "type": "edge_shutdown_request",
    #         "payload": {"message": "Edge edge received shutdown request"}
    #     })
        
    #     # Call original shutdown handler
    #     await original_handle_shutdown(payload)
        
    #     # Schedule sidecar shutdown after edge edge shutdown
    #     asyncio.create_task(_delayed_sidecar_shutdown())
        
    # sidecar.todo_edge.handle_shutdown_request = handle_shutdown_wrapper

async def _delayed_sidecar_shutdown():
    """Perform delayed sidecar shutdown after edge edge shutdown"""
    try:
        # Wait for edge edge to finish shutdown
        await asyncio.sleep(1.0)
        
        # Close all WebSocket connections
        edges = sidecar.connected_edges.copy()
        for websocket in edges:
            try:
                await websocket.close()
            except Exception as e:
                log.warning(f"Error closing websocket: {e}")
        
        # Clear the connected edges set
        sidecar.connected_edges.clear()
        
        log.info("Sidecar shutdown after edge edge shutdown completed")
        
        # Exit the process
        import os
        os._exit(0)
        
    except Exception as e:
        log.error(f"Error in delayed sidecar shutdown: {e}")
        import os
        os._exit(1)

async def _run_edge():
    """Run the edge in async context"""
    try:
        # Ensure we have a valid API key (validate existing or authenticate) without interactive prompts
        ok = await sidecar.todo_edge.ensure_api_key(prompt_if_missing=False)
        if not ok:
            await _broadcast_auth_error("Unable to obtain a valid API key")
            return

        await _broadcast_auth_success()
        
        # Register all hooks after successful authentication
        await register_all_hooks()
            
        # Start the edge
        log.info("Logging in with todo_edge.start()")
        await sidecar.todo_edge.start()
    except Exception as e:
        log.error(f"Error in edge thread: {e}")
        traceback.print_exc()
        await _broadcast_auth_error(str(e))

async def register_all_hooks():
    """Register all hooks automatically"""
    _setup_edge_hooks()
    try:
        # Register file sync hooks
        try:
            await register_file_sync_hooks_internal()
            log.info("Frontend file sync hooks registered")
        except Exception as e:
            log.warning(f"Failed to register file sync hooks: {e}")

        # Register active workspaces hooks
        try:
            await register_active_workspaces_hooks_internal()
            log.info("Frontend active workspaces hooks registered")
        except Exception as e:
            log.warning(f"Failed to register active workspaces hooks: {e}")

        # Register edge config hooks
        try:
            await register_edge_config_hooks_internal()
            log.info("Frontend edge config hooks registered")
        except Exception as e:
            log.warning(f"Failed to register edge config hooks: {e}")

        # Register MCP tool call hooks
        try:
            await register_mcp_hooks_internal()
            log.info("Frontend MCP tool call hooks registered")
        except Exception as e:
            log.warning(f"Failed to register MCP hooks: {e}")
            
    except Exception as e:
        log.error(f"Error registering hooks: {e}")

async def register_file_sync_hooks_internal():
    """Internal function to register file sync hooks"""
    # Store original methods to hook into
    original_sync_file = WorkspaceSyncManager.sync_file
    original_delete_file = WorkspaceSyncManager.delete_file
    original_send_sync_complete = WorkspaceSyncManager._send_sync_complete_signal
    
    async def sync_file_hook(self, action, abs_path):
        # Call original method first
        result = await original_sync_file(self, action, abs_path)
        
        # Send event about the file sync
        try:
            size = os.path.getsize(abs_path) if os.path.exists(abs_path) else None
            await _broadcast_file_sync(action, abs_path, self.workspace_dir, size)
        except Exception as e:
            log.error(f"Error in sync_file_hook: {e}")
        
        return result
        
    async def delete_file_hook(self, abs_path):
        await _broadcast_file_sync("delete", abs_path, self.workspace_dir)
        return await original_delete_file(self, abs_path)
    
    async def send_sync_complete_hook(self):
        # Call original method
        result = await original_send_sync_complete(self)
        await _broadcast_file_sync_complete(self.workspace_dir, len(self.project_files_abs))
        return result
        
    # Replace the methods with our hooked versions
    WorkspaceSyncManager.sync_file = sync_file_hook
    WorkspaceSyncManager.delete_file = delete_file_hook
    WorkspaceSyncManager._send_sync_complete_signal = send_sync_complete_hook

async def register_active_workspaces_hooks_internal():
    """Internal function to register active workspace hooks"""
    # Define the callback function
    async def on_active_workspaces_change(active_workspaces_dict):
        await _broadcast_active_workspaces()
        
    # Register the callback with the observable using a named callback
    active_sync_managers.subscribe_async(on_active_workspaces_change, name="ws_sidecar_workspaces_hook")

async def register_edge_config_hooks_internal():
    """Internal function to register edge config hooks"""
    # Check if edge exists
    if not sidecar.todo_edge:
        raise Exception("Client not initialized")
    
    # Subscribe to config changes to broadcast them to frontend
    async def on_config_change_hook(config_value):
        await _broadcast_config_update()
    
    # Subscribe to the observable
    sidecar.todo_edge.edge_config.config.subscribe_async(on_config_change_hook, name="ws_sidecar_config_hook")

async def register_mcp_hooks_internal():
    """Internal function to register MCP tool call hooks"""
    def tool_call_callback(call_data):
        asyncio.create_task(broadcast_event({
            "type": "mcp_tool_call",
            "payload": call_data,
        }))
    
    set_mcp_tool_call_callback(tool_call_callback)

# Simplify RPC error handling
def _create_rpc_response(success: bool, message: str) -> dict:
    """Create standardized RPC response"""
    return {
        "status": "success" if success else "error",
        "message": message
    }

# Keep the RPC functions for backward compatibility, but make them simple wrappers
@sidecar.rpc
def register_file_sync_hooks(params=None):
    """Register hooks to monitor file sync events"""
    try:
        asyncio.create_task(register_file_sync_hooks_internal())
        return _create_rpc_response(True, "Frontend file sync hooks registered")
    except Exception as e:
        log.error(f"Error registering file sync hooks: {e}")
        traceback.print_exc()
        return _create_rpc_response(False, str(e))

@sidecar.rpc
def register_active_workspaces_hooks(params=None):
    """Register hooks to monitor active workspace changes"""
    try:
        asyncio.create_task(register_active_workspaces_hooks_internal())
        return _create_rpc_response(True, "Active workspaces hooks registered")
    except Exception as e:
        log.error(f"Error registering active workspaces hooks: {e}")
        traceback.print_exc()
        return _create_rpc_response(False, str(e))

@sidecar.rpc
def register_edge_config_hooks(params=None):
    """Register hooks to monitor edge config changes"""
    try:
        asyncio.create_task(register_edge_config_hooks_internal())
        return _create_rpc_response(True, "Edge config hooks registered")
    except Exception as e:
        log.error(f"Error registering edge config hooks: {e}")
        traceback.print_exc()
        return _create_rpc_response(False, str(e))

@sidecar.rpc
def update_edge_config(params):
    """Update edge config fields in local config after successful API call"""
    try:
        if not sidecar.todo_edge:
            return {"status": "error", "message": "Client not initialized"}
        
        if not params:
            return {"status": "error", "message": "No config updates provided"}
        
        # Update the local config using update_value - this will trigger the observable
        sidecar.todo_edge.edge_config.config.update_value(params)
        
        log.info(f"Updated edge config: {params}")
        return {"status": "success", "message": "Edge config updated"}
        
    except Exception as e:
        log.error(f"Error updating edge config: {e}")
        return {"status": "error", "message": str(e)}

@sidecar.rpc
def refresh_mcp_config(params):
    """Refresh MCP configuration by reloading from file"""
    try:
        if not sidecar.todo_edge:
            return {"status": "error", "message": "Client not initialized"}
        
        if not hasattr(sidecar.todo_edge, 'mcp_collector') or not sidecar.todo_edge.mcp_collector:
            return {"status": "error", "message": "No MCP collector available"}
        
        # Get the config file path (optional parameter, fallback to stored path)
        config_path = params.get("configPath")
        if not config_path and hasattr(sidecar.todo_edge.mcp_collector, 'config_file_path'):
            config_path = sidecar.todo_edge.mcp_collector.config_file_path
        
        if not config_path:
            return {"status": "error", "message": "No config path available"}
        
        # Simple reload using existing functionality
        asyncio.create_task(_refresh_mcp_config_async(config_path))
        
        return {"status": "success", "message": f"Refreshing MCP config from: {config_path}"}
        
    except Exception as e:
        log.error(f"Error refreshing MCP config: {e}")
        return {"status": "error", "message": str(e)}

async def _refresh_mcp_config_async(config_path: str):
    """Simple async helper to reload MCP config"""
    try:
        # Just call the existing load_from_file method
        results = await sidecar.todo_edge.mcp_collector.load_from_file(config_path)
        
        log.info(f"Successfully refreshed MCP config from: {config_path}")
        
        # Broadcast refresh complete event
        await broadcast_event({
            "type": "mcp_config_refreshed",
            "payload": {
                "configPath": config_path,
                "serversLoaded": len(results)
            }
        })
        
    except Exception as e:
        log.error(f"Error in async MCP config refresh: {e}")
        await broadcast_event({
            "type": "mcp_config_refresh_error", 
            "payload": {"configPath": config_path, "error": str(e)}
        })

async def broadcast_event(event):
    """Send an event to all connected WebSocket edges"""
    if not sidecar.connected_edges:
        log.warning("No connected edges to broadcast to")
        return
        
    event_envelope = {
        "jsonrpc": "2.0", 
        "method": "_event", 
        "params": event
    }
    message = json.dumps(event_envelope, ensure_ascii=False)
    
    # Make a copy to avoid modification during iteration
    edges = sidecar.connected_edges.copy()
    for websocket in edges:
        try:
            await websocket.send(message)
        except websockets.ConnectionClosed:
            log.warning(f"Client {id(websocket)} disconnected, removing from connected_edges")
            sidecar.connected_edges.discard(websocket)
        except Exception as e:
            log.error(f"Error sending event to edge {id(websocket)}: {e}")

async def handle_websocket_message(websocket, message: str):
    """Handle individual WebSocket message"""
    try:
        request = json.loads(message)
        method = request.get("method")
        params = request.get("params")
        req_id = request.get("id")
        
        log.info(f"Received request: {method}")
        
        if method in sidecar.handlers:
            try:
                result = sidecar.handlers[method](params)
                response = {"jsonrpc": "2.0", "id": req_id, "result": result}
            except Exception as e:
                log.error(f"Error handling method {method}: {e}")
                traceback.print_exc()
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32000, "message": str(e)}
                }
        else:
            response = {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32601, "message": f"Method '{method}' not found"}
            }
        
        await websocket.send(json.dumps(response, ensure_ascii=False))
        
    except json.JSONDecodeError:
        log.error(f"Invalid JSON received: {message}")
        await websocket.send(json.dumps({
            "jsonrpc": "2.0",
            "error": {"code": -32700, "message": "Parse error"}
        }, ensure_ascii=False))
    except Exception as e:
        log.error(f"Error processing message: {e}")
        traceback.print_exc()
        await websocket.send(json.dumps({
            "jsonrpc": "2.0",
            "error": {"code": -32603, "message": f"Internal error: {str(e)}"}
        }, ensure_ascii=False))

async def handle_websocket(websocket):
    """Handle a WebSocket connection"""
    edge_id = id(websocket)
    log.info(f"Client connected: {edge_id}")
    sidecar.connected_edges.add(websocket)
    
    try:
        async for message in websocket:
            await handle_websocket_message(websocket, message)
    except websockets.ConnectionClosed:
        log.info(f"Client disconnected: {edge_id}")
    except Exception as e:
        log.error(f"WebSocket handler error: {e}")
        traceback.print_exc()
    finally:
        sidecar.connected_edges.discard(websocket)
        log.info(f"Client removed: {edge_id}, {len(sidecar.connected_edges)} edges remaining")

async def start_server(host='127.0.0.1', port=9528):
    """Start the WebSocket server"""
    log.info(f"Starting WebSocket server on {host}:{port}")
    
    # Maximum retry attempts
    max_retries = 5
    retry_count = 0
    retry_delay = 1  # Start with 1 second delay
    
    while retry_count < max_retries:
        try:
            # Create the WebSocket server with compression disabled
            async with websockets.serve(
                handle_websocket,
                host,
                port,
                compression=None  # Disable compression to avoid frame compression issues
            ):
                # Keep the server running
                await asyncio.Future()
                return
                
        except OSError as e:
            if e.errno == 98:  # Address already in use
                retry_count += 1
                log.warning(f"Port {port} is in use, retrying. Sleeping for {retry_delay} second...")
                await asyncio.sleep(retry_delay)
                # Exponential backoff
                retry_delay *= 2
            else:
                log.error(f"Error binding to port: {e}")
                raise
    
    # If we get here, we've exhausted our retries
    log.error(f"Failed to start server after {max_retries} attempts")
    raise RuntimeError("Failed to start server")

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='WebSocket sidecar for Tauri-Python communication')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--port', type=int, default=9528, help='Port to listen on')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')
    
    args = parser.parse_args()
    
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    log.info(f"Starting WebSocket sidecar on {args.host}:{args.port}")
    
    try:
        asyncio.run(start_server(args.host, args.port))
    except KeyboardInterrupt:
        log.info("Server stopped by user")
    except Exception as e:
        log.error(f"Server error: {e}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()