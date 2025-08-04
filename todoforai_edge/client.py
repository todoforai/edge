import os
import logging
import traceback
from typing import List, Optional, Dict, Any, Callable, Coroutine, Union, TypeVar, cast
import json
import asyncio
import websockets

# Import constants
from .constants.constants import (
    EdgeStatus, SR, FE, AE, EF, S2E
)
from .utils import generate_machine_fingerprint, async_request
from .constants.messages import edge_status_msg
from .constants.workspace_handler import handle_ctx_workspace_request
from .apikey import authenticate_and_get_api_key
from .observable import registry
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
    handle_block_diff,
    handle_task_action_new,
    handle_ctx_julia_request,
    handle_file_chunk_request,
    handle_get_folders,
    handle_function_call_request,
    handle_call_edge_method
)
from .handlers.file_sync import ensure_workspace_synced, start_workspace_sync, stop_all_syncs
from .mcp_client import setup_mcp_from_config

# Configure logging
logger = logging.getLogger("todoforai-client")

# Type for callback functions
T = TypeVar('T')
CallbackType = Union[Callable[[T], None], Callable[[T], Coroutine[Any, Any, None]]]


def invoke_callback(callback: CallbackType, arg: Any) -> None:
    """Helper function to invoke a callback, handling both sync and async callbacks"""
    if callback is None:
        return
        
    if asyncio.iscoroutinefunction(callback):
        asyncio.create_task(cast(Callable[[Any], Coroutine[Any, Any, None]], callback)(arg))
    else:
        cast(Callable[[Any], None], callback)(arg)

class TODOforAIEdge:
    def __init__(self, client_config):
        if client_config is None:
            raise ValueError("Config object must be provided to TODOforAIEdge")
            
        # Store the config object
        self.api_url = client_config.api_url
        # Normalize API URL - don't force localhost to http
        if self.api_url.startswith("localhost"):
            self.api_url = f"http://{self.api_url}"
        elif not self.api_url.startswith(("http://", "https://")):
            self.api_url = f"https://{self.api_url}"
            
        self.api_key = client_config.api_key
        self.email = client_config.email
        self.password = client_config.password
        # Add debug attribute for convenience
        self.debug = client_config.debug
        
        # Store only the add_workspace_path if provided
        self.add_workspace_path = getattr(client_config, 'add_workspace_path', None)
        
        self.ws = None
        self.ws_url = get_ws_url(self.api_url)
        self.edge_config = EdgeConfig()
        logger.info("EdgeConfig initialized.")
        
        # Subscribe to config changes
        self.config_syncable_fields = ["workspacepaths", "installedMCPs", "name", "isShellEnabled", "isFileSystemEnabled"]
        self.edge_config.config.subscribe_async(self._on_config_change, name="edge2backend_on_config_change") # TODO csinálni kell functort belőle. VAGY JOBB megoldást
        
        self.agent_id = ""
        self.user_id = ""
        self.edge_id = ""
        self.connected = False
        self.heartbeat_task = None
        self.fingerprint = None  # Will be generated when needed
        self.mcp_collector = None  # Will be initialized if mcp.json exists
        
        # Set logging level based on config
        if self.debug:
            logger.setLevel(logging.DEBUG)
    
    def _generate_fingerprint(self):
        """Generate fingerprint based on machine characteristics"""
        self.fingerprint = generate_machine_fingerprint()
        logger.info(f'{Colors.CYAN}{Colors.BOLD}Generated fingerprint{Colors.END}')
        return self.fingerprint

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
        
    async def authenticate(self):
        """Authenticate with email and password to get API key"""
        if self.api_key and self.email:
            logger.info("Already have API key and email, skipping authentication")
            return {"valid": True}
            
        if not self.email or not self.password:
            logger.error("Email and password are required for authentication")
            return {"valid": False, "error": "Email and password are required for authentication"}
            
        try:
            logger.info(f"Authenticating with email: {self.email}")
            self.api_key = authenticate_and_get_api_key(self.email, self.password, self.api_url)
            logger.info(f"Successfully authenticated as {self.email}")
            return {"valid": True}
        except Exception as e:
            logger.error(f"Authentication failed: {str(e)}")
            return {"valid": False, "error": str(e)}
        
    async def _handle_edge_config_update(self, payload):
        """Handle edge config update from server"""
        edge_id = payload.get("edgeId")
        print("payload!!!!", payload)
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
        
        for workspace_path in self.edge_config.workspacepaths:
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
                self.mcp_collector = await setup_mcp_from_config("mcp.json", self.edge_config)
                logger.info("MCP client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to load MCP configuration: {str(e)}")
        else:
            logger.debug("No mcp.json found in current directory")

    async def _update_edge_status(self, status):
        """Update edge status in the API"""
        if not self.edge_id:
            logger.warning("Cannot update edge status: missing edge_id")
            return False
        
        try:
            # Update status in API
            response = await async_request(
                self, 
                'patch', 
                f"/api/v1/edges/{self.edge_id}", 
                {"status": status}
            )
            
            if not response:
                return False
            
            # Also broadcast status to connected clients
            await self.send_response(edge_status_msg(self.edge_id, status))
                
            logger.info(f"Updated edge status to {status}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating edge status: {str(e)}")
            return False

    async def _send_heartbeat(self):
        """Send periodic heartbeats to the server"""
        while self.connected:
            try:
                if self.edge_id:
                    if self.debug:
                        logger.debug(f"Sending heartbeat for edge {self.edge_id}")
                    
                    # Update edge status to ONLINE with each heartbeat
                    await self._update_edge_status(EdgeStatus.ONLINE)
                    
            except Exception as error:
                logger.error(f"Heartbeat error: {str(error)}")
            
            await asyncio.sleep(300)  # Send heartbeat every 300 seconds

    async def _handle_message(self, message):
        """Process incoming messages from the server"""
        try:
            data = json.loads(message)
            msg_type = data.get("type")
            payload = data.get("payload", {})
            
            if self.debug:
                logger.info(f"Received message type: {msg_type}")
                
            # Create a task for each message handler so they run concurrently
            # This ensures that one long-running handler doesn't block others
            if msg_type == SR.CONNECTED_EDGE:
                self.edge_id = payload.get("edgeId", "")
                self.user_id = payload.get("userId", "")
                logger.info(f"{Colors.GREEN}{Colors.BOLD}🔗 Connected with edge ID: {self.edge_id} and user ID: {self.user_id}{Colors.END}")
                
                # Load MCP if exists (only once on initial connection)
                await self._load_mcp_if_exists()
                
                # Update edge status to ONLINE
                await self._update_edge_status(EdgeStatus.ONLINE)
                
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
            
            elif msg_type == FE.BLOCK_DIFF:
                asyncio.create_task(handle_block_diff(payload, self))
            
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
            
            elif msg_type == FE.CALL_EDGE_METHOD:
                asyncio.create_task(handle_call_edge_method(payload, self))

            elif msg_type == AE.FUNCTION_CALL_REQUEST:
                asyncio.create_task(handle_function_call_request(payload, self))
            
            else:
                logger.warning(f"Unknown message type: {msg_type}")
                
        except Exception as error:
            stack_trace = traceback.format_exc()
            logger.error(f"Error handling message: {str(error)}\nStacktrace:\n{stack_trace}")

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
        # Authenticate if needed
        if not self.api_key and (self.email and self.password):
            auth_result = await self.authenticate()
            if not auth_result["valid"]:
                logger.error("Authentication failed, cannot connect")
                return
                
        if not self.api_key:
            logger.error("No API key available, cannot connect")
            return
            
        fingerprint = self._generate_fingerprint()
        
        # Only include fingerprint in URL
        ws_url = f"{self.ws_url}?fingerprint={fingerprint}"
        
        if self.debug:
            logger.info(f"Connecting to WebSocket: {ws_url}")
        
        try:
            # Use a custom subprotocol that includes the API key
            # Format: "apikey-{api_key}"
            custom_protocol = f"{self.api_key}"
            
            async with websockets.connect(ws_url, subprotocols=[custom_protocol]) as ws:
                self.ws = ws
                self.connected = True
                logger.info("WebSocket connected")
                
                # Start heartbeat task
                self.heartbeat_task = asyncio.create_task(self._send_heartbeat())
                
                # Process messages
                async for message in ws:
                    await self._handle_message(message)
        except websockets.ConnectionClosedError as error:
            stack_trace = traceback.format_exc()
            logger.error(f"WebSocket connection closed unexpectedly: {error}\nStacktrace:\n{stack_trace}")
        except websockets.ConnectionClosedOK as error:
            logger.info(f"WebSocket connection closed normally: {error}")
        except Exception as error:
            stack_trace = traceback.format_exc()
            
            # Check if it's a status code related error (replaces deprecated InvalidStatusCode)
            if hasattr(error, 'status_code'):
                logger.error(f"WebSocket connection failed with status code: {error.status_code}\nStacktrace:\n{stack_trace}")
                if error.status_code == 401:
                    logger.error("Authentication failed. Please check your API key.")
                elif error.status_code == 403:
                    logger.error("Access forbidden. Your API key might not have the required permissions.")
                else:
                    logger.error(f"Server returned error: {error}")
            else:
                logger.error(f"WebSocket connection error: {str(error)}\nStacktrace:\n{stack_trace}")
        finally:
            self.connected = False
            self.ws = None
            
            # Update edge status to OFFLINE when disconnecting
            await self._update_edge_status(EdgeStatus.OFFLINE)
            
            if self.heartbeat_task:
                self.heartbeat_task.cancel()
                self.heartbeat_task = None
            logger.info("WebSocket disconnected")

    async def start(self):
        """Start the client with reconnection logic"""
        max_attempts = 20
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
                await asyncio.sleep(4.0)
                
            except Exception as error:
                logger.error(f"Connection error: {str(error)}")
                attempt += 1
                
                # Stop all file syncs on error
                await stop_all_syncs()
                
                if attempt < max_attempts:
                    delay = min(4 + attempt, 20.0)
                    logger.info(f"Reconnecting in {delay:.1f} seconds...")
                    await asyncio.sleep(delay)
                else:
                    logger.error("Maximum reconnection attempts reached. Giving up.")
                    break