#!/usr/bin/env python3
"""
WebSocket-based sidecar for Tauri-Python communication.
Can be used both in development mode and as an alternative to stdio_sidecar.py.
"""

import asyncio
import json
import sys, os, time
import traceback
import argparse
import logging
from typing import Any, Dict, Callable, Optional
import threading
import websockets

# Import TODOforAIEdge client
from todoforai_edge.client import TODOforAIEdge
from todoforai_edge.config import Config

# Import the file_sync module
from todoforai_edge import file_sync

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
log = logging.getLogger('ws_sidecar')

# Dictionary to store available functions
handlers: dict[str, Callable[[Any], Any]] = {}
# Global client instance
todo_client = None
# Client thread
client_thread = None
# Default API URL
default_api_url = None
# Lock for client operations
client_lock = threading.Lock()
# Connected WebSocket clients
connected_clients = set()

def rpc(func):
    """Decorator to register functions that can be called from the frontend"""
    def wrapper(*args, **kwargs):
        # Call the original function
        return func(*args, **kwargs)
    
    handlers[func.__name__] = wrapper
    return wrapper

@rpc
def ping(message):
    """Simple ping function that returns a pong with the message"""
    return {"response": f"pong: {message}"}

@rpc
def validate_stored_credentials(credentials):
    """Validate stored credentials with the server"""
    try:
        import requests
        
        api_url = credentials.get("apiUrl")
        api_key = credentials.get("apiKey")
        
        if not api_url or not api_key:
            return {"valid": False, "error": "Missing API URL or API key"}
        
        # Ensure proper URL format
        if api_url.startswith("localhost"):
            api_url = f"http://{api_url}"
        elif not api_url.startswith(("http://", "https://")):
            api_url = f"https://{api_url}"
        
        validation_url = f"{api_url}/token/v1/users/apikeys/validate"
        
        response = requests.get(validation_url, headers={
            'x-api-key': api_key,
            'Content-Type': 'application/json',
        }, timeout=10)
        
        if response.status_code == 200:
            validation_result = response.json()
            return {"valid": validation_result.get("valid", False)}
        else:
            return {"valid": False, "error": f"Validation failed with status {response.status_code}"}
            
    except Exception as e:
        log.error(f"Error validating credentials: {e}")
        return {"valid": False, "error": str(e)}

@rpc
def login(credentials):
    """Login with email and password or API key"""
    global todo_client, client_thread
    
    try:
        # Create a configuration object
        config = Config()
        
        # Set credentials from the request
        if "email" in credentials and "password" in credentials:
            config.email = credentials["email"]
            config.password = credentials["password"]
        
        if "apiKey" in credentials:
            config.api_key = credentials["apiKey"]
            
        # Use API URL from credentials or default
        if "apiUrl" in credentials and credentials["apiUrl"]:
            config.api_url = credentials["apiUrl"]
        elif default_api_url:
            config.api_url = default_api_url
            
        # Ensure proper URL format
        if config.api_url:
            # Normalize URL format
            if config.api_url.startswith("localhost"):
                config.api_url = f"http://{config.api_url}"
            elif not config.api_url.startswith(("http://", "https://")):
                config.api_url = f"https://{config.api_url}"
            
        # Debug mode
        config.debug = credentials.get("debug", False)
        
        log.info(f"Using API URL: {config.api_url}")
        
        with client_lock:
            # Check if we're already connected with the same credentials
            if todo_client and todo_client.connected:
                same_credentials = False
                
                # Check if API key matches
                if config.api_key and todo_client.api_key and config.api_key == todo_client.api_key:
                    same_credentials = True
                    
                # Or check if email/password match
                elif (config.email and config.password and 
                      todo_client.email and todo_client.password and
                      config.email == todo_client.email and 
                      config.password == todo_client.password):
                    same_credentials = True
                
                if same_credentials:
                    log.info("Already connected with the same credentials, sending auth_success")
                    # Create a task to send auth_success event
                    asyncio.create_task(broadcast_event({
                        "type": "auth_success",
                        "payload": {
                            "apiKey": todo_client.api_key,
                            "email": todo_client.email,
                        }
                    }))
                    return {"status": "success", "message": "Already connected with the same credentials"}
                else:
                    log.info("Disconnecting existing client to connect with new credentials")
                    # Different credentials, disconnect current client
                    if todo_client.connected:
                        todo_client.connected = False
                        if todo_client.heartbeat_task:
                            todo_client.heartbeat_task.cancel()
                    if client_thread and client_thread.is_alive():
                        client_thread.join(timeout=2)
            
            # Create the client
            todo_client = TODOforAIEdge(config)

            # Hooks into todo_client
            # Add message handler to forward messages to frontend
            original_handle_message = todo_client._handle_message
            
            async def handle_message_wrapper(message):
                # Forward message to frontend
                await broadcast_event({
                    "type": "ws_message",
                    "payload": json.loads(message)
                })
                # Call original handler
                await original_handle_message(message)
                
            todo_client._handle_message = handle_message_wrapper
            
            # Define the async function to run in the thread
            async def run_client():
                try:
                    # Authenticate if needed
                    if not todo_client.api_key and (todo_client.email and todo_client.password):
                        log.info(f"Authenticating with email: {todo_client.email}")
                        response = await todo_client.authenticate()
                        if not response["valid"]:
                            await broadcast_event({
                                "type": "auth_error",
                                "payload": {"message": f"Authentication failed. Result: {response}"}
                            })
                            return
                        
                        # Add the API key and user info to the event queue
                        await broadcast_event({
                            "type": "auth_success",
                            "payload": {
                                "apiKey": todo_client.api_key,
                                "email": todo_client.email,
                            }
                        })
                    elif todo_client.api_key:
                        # If we already have an API key, send auth success
                        await broadcast_event({
                            "type": "auth_success",
                            "payload": {
                                "apiKey": todo_client.api_key,
                                "email": todo_client.email
                            }
                        })
                    
                    # Register all hooks after successful authentication
                    await register_all_hooks()
                        
                    # Start the client
                    log.info("Starting client...")
                    await todo_client.start()
                except Exception as e:
                    log.error(f"Error in client thread: {e}")
                    traceback.print_exc()
                    await broadcast_event({
                        "type": "auth_error",
                        "payload": {"message": str(e)}
                    })
            
            def thread_target():
                asyncio.run(run_client())
                
            client_thread = threading.Thread(target=thread_target, daemon=True)
            client_thread.start()
        
        return {"status": "connecting", "message": "Client is connecting..."}
        
    except Exception as e:
        error_msg = f"Login error: {str(e)}"
        log.error(error_msg)
        traceback.print_exc()
        
        # Broadcast the error to the frontend
        asyncio.create_task(broadcast_event({
            "type": "auth_error",
            "payload": {"message": error_msg}
        }))
        
        return {"status": "error", "message": error_msg}
async def register_all_hooks():
    """Register all hooks automatically"""
    try:
        # Register file sync hooks
        try:
            await register_file_sync_hooks_internal()
            log.info("File sync hooks registered")
        except Exception as e:
            log.warn(f"Failed to register file sync hooks: {e}")

        # Register active workspaces hooks
        try:
            await register_active_workspaces_hooks_internal()
            log.info("Active workspaces hooks registered")
        except Exception as e:
            log.warn(f"Failed to register active workspaces hooks: {e}")

        # Register edge config hooks
        try:
            await register_edge_config_hooks_internal()
            log.info("Edge config hooks registered")
        except Exception as e:
            log.warn(f"Failed to register edge config hooks: {e}")
            
    except Exception as e:
        log.error(f"Error registering hooks: {e}")

async def register_file_sync_hooks_internal():
    """Internal function to register file sync hooks"""
    # Store original methods to hook into
    original_sync_file = file_sync.WorkspaceSyncManager.sync_file
    original_delete_file = file_sync.WorkspaceSyncManager.delete_file
    
    async def sync_file_hook(self, action, abs_path):
        # Call original method first
        result = await original_sync_file(self, action, abs_path)
        
        # Send event about the file sync
        try:
            # Get file size for logging
            payload = {
                "action": action,
                "path": abs_path,
                "workspace": self.workspace_dir
            }
            if os.path.exists(abs_path):
                payload["size"] = os.path.getsize(abs_path)

            await broadcast_event({
                "type": "file_sync",
                "payload": payload,
                "timestamp": int(time.time() * 1000)  # Add timestamp in milliseconds
            })
        except Exception as e:
            log.error(f"Error in sync_file_hook: {e}")
        
        return result
        
    async def delete_file_hook(self, abs_path):
        # Send event before deletion
        await broadcast_event({
            "type": "file_sync",
            "payload": {
                "action": "delete",
                "path": abs_path,
                "workspace": self.workspace_dir
            },
            "timestamp": int(time.time() * 1000)  # Add timestamp in milliseconds
        })
        
        # Call original method
        return await original_delete_file(self, abs_path)
    
    # Replace the methods with our hooked versions
    file_sync.WorkspaceSyncManager.sync_file = sync_file_hook
    file_sync.WorkspaceSyncManager.delete_file = delete_file_hook
    
    # Also hook into the initial sync complete signal
    original_send_sync_complete = file_sync.WorkspaceSyncManager._send_sync_complete_signal
    
    async def send_sync_complete_hook(self):
        # Call original method
        result = await original_send_sync_complete(self)
        
        # Send event about sync completion
        await broadcast_event({
            "type": "file_sync_complete",
            "payload": {
                "workspace": self.workspace_dir,
                "file_count": len(self.project_files_abs)
            }
        })
        
        return result
        
    file_sync.WorkspaceSyncManager._send_sync_complete_signal = send_sync_complete_hook

async def register_active_workspaces_hooks_internal():
    """Internal function to register active workspace hooks"""
    from todoforai_edge.file_sync import active_sync_managers
    
    # Define the callback function
    async def on_active_workspaces_change(active_workspaces_dict):
        # Send event about active workspaces change
        await broadcast_event({
            "type": "active_workspaces_change",
            "payload": {
                "activeWorkspaces": list(active_workspaces_dict.keys())
            }
        })
        
    # Register the callback with the observable using a named callback
    active_sync_managers.subscribe_async(on_active_workspaces_change, name="ws_sidecar_workspaces_hook")

async def register_edge_config_hooks_internal():
    """Internal function to register edge config hooks"""
    # Check if client exists
    if not todo_client:
        raise Exception("Client not initialized")
    
    # Subscribe to config changes to broadcast them to frontend
    async def on_config_change_hook(config_value):
        await broadcast_event({
            "type": "edge:config_update",
            "payload": config_value
        })
    
    # Subscribe to the observable
    todo_client.edge_config.config.subscribe_async(on_config_change_hook, name="ws_sidecar_config_hook")

# Keep the RPC functions for backward compatibility, but make them simple wrappers
@rpc
def register_file_sync_hooks(params=None):
    """Register hooks to monitor file sync events"""
    try:
        asyncio.create_task(register_file_sync_hooks_internal())
        return {"status": "success", "message": "File sync hooks registered"}
    except Exception as e:
        log.error(f"Error registering file sync hooks: {e}")
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@rpc
def register_active_workspaces_hooks(params=None):
    """Register hooks to monitor active workspace changes"""
    try:
        asyncio.create_task(register_active_workspaces_hooks_internal())
        return {"status": "success", "message": "Active workspaces hooks registered"}
    except Exception as e:
        log.error(f"Error registering active workspaces hooks: {e}")
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@rpc
def register_edge_config_hooks(params=None):
    """Register hooks to monitor edge config changes"""
    try:
        asyncio.create_task(register_edge_config_hooks_internal())
        return {"status": "success", "message": "Edge config hooks registered"}
    except Exception as e:
        log.error(f"Error registering edge config hooks: {e}")
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@rpc
def toggle_workspace_sync(params):
    """Toggle sync for a specific workspace path"""
    try:
        if not todo_client:
            return {"status": "error", "message": "Client not initialized"}
            
        workspace_path = os.path.abspath(params.get("path", ""))
        if not workspace_path:
            return {"status": "error", "message": "No workspace path provided"}
        
        # Import sync functions
        from todoforai_edge.file_sync import start_workspace_sync, stop_workspace_sync, active_sync_managers
        
        # Check if this workspace is already being synced
        is_active = workspace_path in active_sync_managers
        
        if is_active:
            # Stop syncing
            asyncio.create_task(stop_workspace_sync(workspace_path))
            return {"status": "success", "isActive": False}
        else:
            # Start syncing if in configured workspaces
            if workspace_path not in todo_client.edge_config.workspacepaths:
                return {"status": "error", "message": "Path not in configured workspaces"}
                
            asyncio.create_task(start_workspace_sync(todo_client, workspace_path))
            return {"status": "success", "isActive": True}
            
    except Exception as e:
        log.error(f"Error toggling workspace sync: {e}")
        return {"status": "error", "message": str(e)}

@rpc
def remove_workspace_path(params):
    """Remove a workspace path from the edge configuration"""
    try:
        if not todo_client:
            return {"status": "error", "message": "Client not initialized"}
            
        workspace_path = os.path.abspath(params.get("path", ""))
        if not workspace_path:
            return {"status": "error", "message": "No workspace path provided"}
        
        # Remove the path from the configuration
        removed = todo_client.edge_config.remove_workspace_path(workspace_path)
        
        if removed:
            log.info(f"Removed workspace path: {workspace_path}")
            
            # Stop file sync for this path if it's active
            from todoforai_edge.file_sync import stop_workspace_sync
            asyncio.create_task(stop_workspace_sync(workspace_path))
            
            return {"status": "success", "message": f"Workspace path removed: {workspace_path}"}
        else:
            return {"status": "error", "message": "Workspace path not found"}
            
    except Exception as e:
        log.error(f"Error removing workspace path: {e}")
        return {"status": "error", "message": str(e)}


async def broadcast_event(event):
    """Send an event to all connected WebSocket clients"""
    if not connected_clients:
        log.warning("No connected clients to broadcast to")
        return
        
    event_envelope = {
        "jsonrpc": "2.0", 
        "method": "_event", 
        "params": event
    }
    message = json.dumps(event_envelope, ensure_ascii=False)
    
    # Make a copy to avoid modification during iteration
    clients = connected_clients.copy()
    for websocket in clients:
        try:
            await websocket.send(message)
        except websockets.exceptions.ConnectionClosed:
            log.warning(f"Client {id(websocket)} disconnected, removing from connected_clients")
            connected_clients.discard(websocket)
        except Exception as e:
            log.error(f"Error sending event to client {id(websocket)}: {e}")

async def handle_websocket(websocket):
    """Handle a WebSocket connection"""
    client_id = id(websocket)
    log.info(f"Client connected: {client_id}")
    connected_clients.add(websocket)
    
    try:
        async for message in websocket:
            try:
                # Parse the request
                request = json.loads(message)
                method = request.get("method")
                params = request.get("params")
                req_id = request.get("id")
                
                log.info(f"Received request: {method}")
                
                # Handle the request
                if method in handlers:
                    try:
                        result = handlers[method](params)
                        response = {
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "result": result
                        }
                    except Exception as e:
                        log.error(f"Error handling method {method}: {e}")
                        traceback.print_exc()
                        response = {
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "error": {
                                "code": -32000,
                                "message": str(e)
                            }
                        }
                else:
                    response = {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {
                            "code": -32601,
                            "message": f"Method '{method}' not found"
                        }
                    }
                
                # Send the response
                await websocket.send(json.dumps(response))
                
            except json.JSONDecodeError:
                log.error(f"Invalid JSON received: {message}")
                await websocket.send(json.dumps({
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32700,
                        "message": "Parse error"
                    }
                }))
            except Exception as e:
                log.error(f"Error processing message: {e}")
                traceback.print_exc()
                try:
                    await websocket.send(json.dumps({
                        "jsonrpc": "2.0",
                        "error": {
                            "code": -32603,
                            "message": f"Internal error: {str(e)}"
                        }
                    }))
                except:
                    pass
    except websockets.exceptions.ConnectionClosed:
        log.info(f"Client disconnected: {client_id}")
    except Exception as e:
        log.error(f"WebSocket handler error: {e}")
        traceback.print_exc()
    finally:
        connected_clients.discard(websocket)
        log.info(f"Client removed: {client_id}, {len(connected_clients)} clients remaining")

async def start_server(host='127.0.0.1', port=9528):
    """Start the WebSocket server"""
    log.info(f"Starting WebSocket server on {host}:{port}")
    
    # Maximum retry attempts
    max_retries = 5
    retry_count = 0
    
    retry_delay = 1  # Start with 1 second delay
    
    while retry_count < max_retries:
        try:
            # Create the WebSocket server
            async with websockets.serve(handle_websocket, host, port):
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