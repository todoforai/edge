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
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
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
    handlers[func.__name__] = func
    return func

@rpc
def ping(message):
    """Simple ping function that returns a pong with the message"""
    return {"response": f"pong: {message}"}

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
                        auth_success = await todo_client.authenticate()
                        if not auth_success:
                            await broadcast_event({
                                "type": "auth_error",
                                "payload": {"message": f"Authentication failed. Auth_success: {auth_success}"}
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

@rpc
def register_file_sync_hooks(params=None):
    """Register hooks to monitor file sync events"""
    try:
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
                    "payload": payload
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
                }
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
        
        return {"status": "success", "message": "File sync hooks registered"}
    except Exception as e:
        log.error(f"Error registering file sync hooks: {e}")
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@rpc
def register_workspace_paths_hooks(params=None):
    """Register hooks to monitor workspace paths changes"""
    try:
        # Check if client exists
        if not todo_client:
            return {"status": "error", "message": "Client not initialized"}
            
        # The hook is already set up in the client initialization
        # Just trigger it with current paths to ensure frontend is updated
        if todo_client.edge_config.workspacepaths:
            # Create a task to send the current workspace paths
            async def send_current_paths():
                # Send workspace paths directly to frontend
                await broadcast_event({
                    "type": "edge:workspace_paths",
                    "payload": {
                        "workspacePaths": todo_client.edge_config.workspacepaths
                    }
                })
                
            asyncio.create_task(send_current_paths())
            
        return {"status": "success", "message": "Workspace paths hooks registered"}
    except Exception as e:
        log.error(f"Error registering workspace paths hooks: {e}")
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

async def broadcast_event(event):
    """Send an event to all connected WebSocket clients"""
    if not connected_clients:
        return
        
    event_envelope = {
        "jsonrpc": "2.0", 
        "method": "_event", 
        "params": event
    }
    message = json.dumps(event_envelope)
    
    # Make a copy to avoid modification during iteration
    clients = connected_clients.copy()
    for websocket in clients:
        try:
            await websocket.send(message)
        except websockets.exceptions.ConnectionClosed:
            # Client disconnected, will be removed in the handler
            pass
        except Exception as e:
            log.error(f"Error sending event to client: {e}")

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