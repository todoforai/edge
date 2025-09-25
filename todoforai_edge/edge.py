import os
import logging
import traceback
from typing import List, Optional, Dict, Any, Callable, Coroutine, Union, TypeVar, cast
import json
import asyncio
import websockets
import ssl
import sys

# Import constants
from .constants.constants import (
    EdgeStatus, SR, FE, AE, EF, S2E
)
from .utils import generate_machine_fingerprint, async_request, normalize_api_url, safe_print
from .constants.messages import edge_status_msg
from .constants.workspace_handler import handle_ctx_workspace_request
from .config import get_ws_url
from .edge_config import EdgeConfig
from .colors import Colors
from .handlers.handlers import (
    handle_todo_dir_list,
    handle_todo_cd,
    handle_block_execute,
    handle_block_save,
    handle_block_refresh,
    handle_block_keyboard,
    handle_task_action_new,
    handle_ctx_julia_request,
    handle_file_chunk_request,
    handle_get_folders,
    handle_function_call_request_front,
    handle_function_call_request_agent,
)
from .handlers.file_sync import ensure_workspace_synced, start_workspace_sync, stop_all_syncs
from .mcp_collector import MCPCollector
import aiohttp

# Configure logging
logger = logging.getLogger("todoforai-edge")

# Type for callback functions
T = TypeVar('T')
CallbackType = Union[Callable[[T], None], Callable[[T], Coroutine[Any, Any, None]]]

class AuthenticationError(Exception):
    """Raised when authentication fails"""
    pass

class ServerError(Exception):
    """Raised when server sends an error message"""
    pass

def invoke_callback(callback: CallbackType, arg: Any) -> None:
    """Helper function to invoke a callback, handling both sync and async callbacks"""
    if callback is None:
        return
        
    if asyncio.iscoroutinefunction(callback):
        asyncio.create_task(cast(Callable[[Any], Coroutine[Any, Any, None]], callback)(arg))
    else:
        cast(Callable[[Any], None], callback)(arg)

class TODOforAIEdge:
    def __init__(self, config):
        if config is None:
            raise ValueError("Config object must be provided to TODOforAIEdge")
            
        # Store the config object
        self.api_url = normalize_api_url(config.api_url)
        self.api_key = config.api_key
        # Add debug attribute for convenience
        self.debug = config.debug
        
        # Store only the add_workspace_path if provided
        self.add_workspace_path = config.add_workspace_path
        
        self.ws = None
        self.ws_url = get_ws_url(self.api_url)
        self.edge_config = EdgeConfig()
        
        # Subscribe to config changes
        self.config_syncable_fields = ["workspacepaths", "installedMCPs", "name", "isShellEnabled", "isFileSystemEnabled"]
        self.edge_config.config.subscribe_async(self._on_config_change, name="edge2backend_on_config_change") # TODO csinálni kell functort belőle. VAGY JOBB megoldást
        
        self.agent_id = ""
        self.user_id = ""
        self.edge_id = ""
        self.connected = False
        self.heartbeat_task = None
        self.fingerprint = None  # Will be generated when needed
        self.mcp_collector = MCPCollector(self.edge_config)  # Initialize MCP collector
        
        # Set logging level based on config
        if self.debug:
            logger.setLevel(logging.DEBUG)
    
    def _generate_fingerprint(self):
        """Generate fingerprint based on machine characteristics"""
        self.fingerprint = generate_machine_fingerprint()
        safe_print(f'👆 {Colors.CYAN}{Colors.BOLD}Generated fingerprint:{Colors.END} {self.fingerprint}')
        return self.fingerprint

    def _create_ssl_context(self):
        """Create SSL context that doesn't verify certificates"""
        if not self.ws_url.startswith("wss://"):
            return None
            
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        return context

    async def _on_config_change(self, changes: Dict[str, Any]) -> None:
        """Callback when config changes - receives only the changed fields"""
        logger.info(f"Edge config changed: {list(changes.keys())}")
        
        # If we have an edge_id, update the server with workspace/MCP changes
        if self.edge_id and self.connected:
            syncable_changed_data = {k: v for k, v in changes.items() if k in self.config_syncable_fields}
            
            if syncable_changed_data:
                try:
                    response = await async_request(self, 'patch', f"/api/v1/edges/{self.edge_id}", syncable_changed_data)
                    if response:
                        logger.info(f"Updated edge config on server: {list(syncable_changed_data.keys())}")
                    else:
                        logger.error("Failed to update edge config on server")
                except Exception as e:
                    logger.error(f"Error updating edge config on server: {str(e)}")
        
    async def validate_api_key(self):
        """Validate the current API key by making a test request"""
        if not self.api_key:
            return {"valid": False, "error": "No API key provided"}
            
        try:
            
            # Use the dedicated validation endpoint
            url = f"{self.api_url}/noauth/v1/users/apikeys/validate"
            headers = {"x-api-key": self.api_key}
            
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("valid"):
                            logger.info("API key validation successful")
                            return {"valid": True}
                        else:
                            return {"valid": False, "error": data.get("error", "API key is invalid")}
                    else:
                        return {"valid": False, "error": f"Validation request failed with status {response.status}"}
                        
        except Exception as e:
            logger.error(f"API key validation failed: {str(e)}")
            return {"valid": False, "error": str(e)}

    async def ensure_api_key(self, prompt_if_missing=True):
        """Ensure we have a valid API key"""
        # If we already have an API key, validate it
        if self.api_key:
            result = await self.validate_api_key()
            if result.get("valid"):
                return True
            logger.warning(f"API key invalid: {result.get('error')}")
            self.api_key = None
        
        if not prompt_if_missing:
            logger.error("No valid API key available")
            return False
        else:
            # Prompt for API key
            print(f"{Colors.YELLOW}Please provide your API key{Colors.END}")
            while True:
                try:
                    self.api_key = input("API Key: ").strip()
                    if not self.api_key:
                        print(f"{Colors.YELLOW}No API key provided. Please try again.{Colors.YELLOW}")
                        continue
                        
                    # Validate the new API key
                    result = await self.validate_api_key()
                    if result.get("valid", False):
                        return True
                    else:
                        print(f"{Colors.RED}Invalid API key. Please try again.{Colors.END}")
                        
                except KeyboardInterrupt:
                    print("\nOperation cancelled.")
                    break
            print(f"{Colors.RED}❌ Error: Unable to obtain a valid API key{Colors.END}")
            sys.exit(1)

    async def _handle_edge_config_update(self, payload):
        """Handle edge config update from server"""
        edge_id = payload.get("edgeId")
        if edge_id and edge_id != self.edge_id:
            logger.warning(f"Received config update for different edge: {edge_id} vs {self.edge_id} - ignoring")
            return
            
        logger.info(f"Received edge config update for edge {self.edge_id}")
        
        # Update the edge config with the payload, marking server as source
        self.edge_config.config.update_value(payload, source="edge2backend_on_config_change")
        
        # Handle --add-path after we receive the initial config from backend
        if self.add_workspace_path:
            logger.info(f"Adding workspace path from CLI: {self.add_workspace_path}")
            path_added = self.edge_config.add_workspace_path(self.add_workspace_path)
            
            if path_added:
                logger.info(f"✅ Successfully added workspace path: {self.add_workspace_path}")
            else:
                logger.info(f"ℹ️  Workspace path already exists: {self.add_workspace_path}")
            
            # Clear the flag so we don't try to add it again on subsequent config updates
            self.add_workspace_path = None
        
        logger.info("Edge config update processed successfully")
        

    async def _start_workspace_syncs(self):
        """Start file synchronization for all workspace paths"""
        # First stop any existing syncs to prevent duplicates
        await stop_all_syncs()
        
        for workspace_path in self.edge_config.config["workspacepaths"]:
            try:
                if os.path.exists(workspace_path):
                    logger.info(f"Starting file sync for workspace: {workspace_path}")
                    await start_workspace_sync(self, workspace_path)
                else:
                    logger.warning(f"Workspace path does not exist: {workspace_path}")
            except Exception as e:
                logger.error(f"Failed to start file sync for {workspace_path}: {str(e)}")

    async def _load_mcp_if_exists(self):
        """Load MCP config if mcp.json exists in current directory"""
        if os.path.exists("mcp.json"):
            try:
                logger.info("Found mcp.json, loading MCP configuration")
                results = await self.mcp_collector.load_from_file("mcp.json")
                logger.info(f"MCP setup completed. Loaded {len(results)} servers with auto-reload and file sync.")
            except Exception as e:
                logger.error(f"Failed to load MCP configuration: {str(e)}")
        else:
            logger.debug("No mcp.json found in current directory")

    async def _handle_message(self, message):
        """Process incoming messages from the server"""
        data = json.loads(message)
        msg_type = data.get("type")
        payload = data.get("payload", {})
        
        if self.debug:
            logger.info(f"Received message type: {msg_type}")
            
        # Handle error messages
        if msg_type == "ERROR":
            error_message = payload.get("message", "Unknown error")
            logger.error(f"Server error: {error_message}")
            # Raise specific exception types based on error content
            if "API key" in error_message or "authentication" in error_message.lower():
                raise AuthenticationError(error_message)
            else:
                raise ServerError(error_message)
            
        # Create a task for each message handler so they run concurrently
        # This ensures that one long-running handler doesn't block others
        elif msg_type == SR.CONNECTED_EDGE:
            self.edge_id = payload.get("edgeId", "")
            self.user_id = payload.get("userId", "")
            safe_print(f"{Colors.GREEN}{Colors.BOLD}🔗 Connected with edge ID: {self.edge_id} and user ID: {self.user_id}{Colors.END}")
            
            # Update the edge config with the edge ID
            if self.edge_id:
                self.edge_config.config.update_value({"id": self.edge_id}, source="server_connection")
            
            # Load MCP if exists (run in background, don't block)
            asyncio.create_task(self._load_mcp_if_exists())
            
        elif msg_type == S2E.EDGE_CONFIG_UPDATE:  # Handle EDGE_CONFIG_UPDATE
            asyncio.create_task(self._handle_edge_config_update(payload))
        
        elif msg_type == FE.EDGE_DIR_LIST:
            asyncio.create_task(handle_todo_dir_list(payload, self))
        
        elif msg_type == FE.EDGE_CD:
            asyncio.create_task(handle_todo_cd(payload, self))
        
        elif msg_type == FE.BLOCK_SAVE:
            asyncio.create_task(handle_block_save(payload, self))
        
        elif msg_type == FE.BLOCK_REFRESH:
            asyncio.create_task(handle_block_refresh(payload, self))
        
        elif msg_type == FE.BLOCK_EXECUTE:
            asyncio.create_task(handle_block_execute(payload, self))
        
        elif msg_type == FE.BLOCK_KEYBOARD:
            asyncio.create_task(handle_block_keyboard(payload, self))
        
        
        elif msg_type == FE.TASK_ACTION_NEW:
            asyncio.create_task(handle_task_action_new(payload, self))
        
        elif msg_type == AE.CTX_JULIA_REQUEST:
            asyncio.create_task(handle_ctx_julia_request(payload, self))
        
        elif msg_type == AE.CTX_WORKSPACE_REQUEST:
            path = payload.get("path", ".")
            asyncio.create_task(ensure_workspace_synced(self, path))
            asyncio.create_task(handle_ctx_workspace_request(payload, self))
        
        elif msg_type == AE.FILE_CHUNK_REQUEST:
            asyncio.create_task(handle_file_chunk_request(payload, self))

        elif msg_type == FE.FRONTEND_FILE_CHUNK_REQUEST:
            asyncio.create_task(handle_file_chunk_request(payload, self, response_type=EF.FRONTEND_FILE_CHUNK_RESULT))
        
        elif msg_type == FE.GET_FOLDERS:
            asyncio.create_task(handle_get_folders(payload, self))
        
        elif msg_type == AE.FUNCTION_CALL_REQUEST_AGENT:
            asyncio.create_task(handle_function_call_request_agent(payload, self))
        
        elif msg_type == FE.FUNCTION_CALL_REQUEST_FRONT:
            asyncio.create_task(handle_function_call_request_front(payload, self))
        
        else:
            logger.warning(f"Unknown message type: {msg_type}")

    async def send_response(self, message):
        """Send a response to the server
        
        Args:
            message: A complete message object with type and payload
        """
        if self.ws and self.connected:
            message_json = json.dumps(message)
            message_size = len(message_json.encode('utf-8'))
            
            if self.debug:
                logger.debug(f"Sending response: {message['type']} (size: {message_size} bytes)")
                if message_size > 100000:  # Log if message is larger than 100KB
                    logger.warning(f"Large message detected: {message_size} bytes")
                    
            await self.ws.send(message_json)

    async def connect(self):
        """Connect to the WebSocket server"""
        if not self.api_key:
            logger.error("No API key available, cannot connect")
            return
            
        # Only include fingerprint in URL
        ws_url = f"{self.ws_url}?fingerprint={self.fingerprint}"
        
        if self.debug:
            logger.info(f"Connecting to WebSocket: {ws_url}")
        
        # Use a custom subprotocol that includes the API key
        custom_protocol = f"{self.api_key}"
        
        ssl_context = self._create_ssl_context()
        
        async with websockets.connect(
            ws_url,
            subprotocols=[custom_protocol],
            max_size=5 * 1024 * 1024,
            ssl=ssl_context
        ) as ws:
            self.ws = ws
            self.connected = True
            logger.info("WebSocket connected")
            
            # Start heartbeat task
            # self.heartbeat_task = asyncio.create_task(self._send_heartbeat())
            
            # Process messages
            async for message in ws:
                await self._handle_message(message)

    async def start(self):
        """Start the edge with reconnection logic"""
        self._generate_fingerprint()
        
        max_attempts = 10
        attempt = 0
        
        while attempt < max_attempts:
            logger.info(f"Connecting to server (attempt {attempt + 1}/{max_attempts})")
            
            try:
                await self.connect()
                
                # If we get here, the connection was closed normally
                # Reset attempt counter
                attempt = 0
                
                # Stop all file syncs when disconnected
                await stop_all_syncs()
                
                # Wait before reconnecting
                logger.info("Connection closed. Reconnecting in 4 seconds...")
                await asyncio.sleep(attempt * 2)
                
            except AuthenticationError as error:
                logger.error(f"Authentication error: {str(error)}")
                logger.error("Stopping reconnection attempts due to authentication failure")
                break
                
            except ServerError as error:
                logger.error(f"Server error: {str(error)}")
                # For now, treat server errors as non-recoverable too
                logger.error("Stopping reconnection attempts due to server error")
                break
                
            except websockets.ConnectionClosedError as error:
                logger.warning(f'Connection closed unexpectedly: {error}')
                attempt += 1
                
            except websockets.ConnectionClosedOK as error:
                logger.info(f"WebSocket connection closed normally: {error}")
                # Don't increment attempt counter for normal closures
                
            except Exception as error:
                logger.error(f"Connection error: {str(error)}")
                
                # Check if it's a status code related error
                if hasattr(error, 'status_code'):
                    if error.status_code in [401, 403]:
                        logger.error("Authentication/authorization failed. Please check your API key.")
                        break
                
                attempt += 1
                
            finally:
                self.connected = False
                self.ws = None
                
                if self.heartbeat_task:
                    self.heartbeat_task.cancel()
                    self.heartbeat_task = None
                logger.info("WebSocket disconnected!")
                
                # Stop all file syncs on error
                await stop_all_syncs()
                
            if attempt < max_attempts and attempt > 0:
                delay = min(4 + attempt, 20.0)
                logger.info(f"Reconnecting in {delay:.1f} seconds...")
                await asyncio.sleep(delay)
            elif attempt >= max_attempts:
                logger.error("Maximum reconnection attempts reached. Giving up.")
                break