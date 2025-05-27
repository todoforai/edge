import os
import json
import base64
import asyncio
import websockets
import requests
import platform
import uuid
import logging
from pathlib import Path
import traceback
from typing import List, Optional, Dict, Any, Callable, Coroutine, Union, TypeVar, cast

# Import constants
from .constants import (
    ServerResponse, Front2Edge, Edge2Agent, Agent2Edge, Edge2Front, EdgeStatus,
    SR, FE, EA, AE, EF
)
from .utils import generate_machine_fingerprint, async_request
from .messages import edge_status_msg
from .apikey import authenticate_and_get_api_key
from .observable import registry

# Configure logging
logger = logging.getLogger("todoforai-client")

# Import handlers
from .handlers import (
    handle_todo_dir_list,
    handle_todo_cd,
    handle_block_execute,
    handle_block_save,
    handle_block_refresh,
    handle_block_keyboard,
    handle_block_signal,
    handle_block_diff,
    handle_task_action_new,
    handle_ctx_julia_request,
    handle_file_chunk_request,
    handle_get_folders
)
from .workspace_handler import handle_ctx_workspace_request
from .file_sync import ensure_workspace_synced

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

class EdgeConfig:
    """Edge configuration class with observable pattern"""
    def __init__(self, data: Optional[Dict[str, Any]] = None):
        data = data or {}
        
        # Create an observable for the entire config
        self.config = registry.create("edge_config", {
            "id": data.get("id", ""),
            "name": data.get("name", "Unknown Edge"),
            "workspacepaths": data.get("workspacepaths", []),
            "ownerId": data.get("ownerId", ""),
            "status": data.get("status", "OFFLINE"),
            "isShellEnabled": data.get("isShellEnabled", False),
            "isFileSystemEnabled": data.get("isFileSystemEnabled", False),
            "createdAt": data.get("createdAt", None)
        })
    
    def update(self, data: Dict[str, Any]) -> None:
        """Update configuration with new data"""
        if not data:
            return
            
        # Create a new dictionary with updated values
        current = self.config.value
        updated = current.copy()
        # Update only the fields that are present in the data
        if "id" in data:
            updated["id"] = data["id"]
        if "name" in data:
            updated["name"] = data["name"]
        if "workspacepaths" in data:
            updated["workspacepaths"] = data["workspacepaths"]
        if "ownerId" in data:
            updated["ownerId"] = data["ownerId"]
        if "status" in data:
            updated["status"] = data["status"]
        if "isShellEnabled" in data:
            updated["isShellEnabled"] = data["isShellEnabled"]
        if "isFileSystemEnabled" in data:
            updated["isFileSystemEnabled"] = data["isFileSystemEnabled"]
        if "createdAt" in data:
            updated["createdAt"] = data["createdAt"]
        
        # Set the new value to trigger notifications
        self.config.set_value(updated)
    
    @property
    def id(self) -> str:
        """Get edge ID"""
        return self.config.value.get("id", "")
    
    @property
    def name(self) -> str:
        """Get edge name"""
        return self.config.value.get("name", "Unknown Edge")
    
    @property
    def workspacepaths(self) -> List[str]:
        """Get workspace paths"""
        return self.config.value.get("workspacepaths", [])
    
    @property
    def owner_id(self) -> str:
        """Get owner ID"""
        return self.config.value.get("ownerId", "")
    
    @property
    def status(self) -> str:
        """Get status"""
        return self.config.value.get("status", "OFFLINE")
    
    @property
    def is_shell_enabled(self) -> bool:
        """Get shell enabled flag"""
        return self.config.value.get("isShellEnabled", False)
    
    @property
    def is_filesystem_enabled(self) -> bool:
        """Get filesystem enabled flag"""
        return self.config.value.get("isFileSystemEnabled", False)
    
    @property
    def created_at(self) -> Optional[str]:
        """Get created at timestamp"""
        return self.config.value.get("createdAt", None)
    
    def add_workspace_path(self, path: str) -> bool:
        """Add a workspace path if it doesn't already exist"""
        current_paths = self.workspacepaths
        if path not in current_paths:
            # Create a new list with the added path
            new_paths = current_paths.copy()
            new_paths.append(path)
            
            # Update the config with the new paths
            current = self.config.value
            updated = current.copy()
            updated["workspacepaths"] = new_paths
            self.config.value = updated
            return True
        return False

    def remove_workspace_path(self, path: str) -> bool:
        """Remove a workspace path if it exists"""
        current_paths = self.workspacepaths
        if path in current_paths:
            # Create a new list without the removed path
            new_paths = [p for p in current_paths if p != path]
            
            # Update the config with the new paths
            current = self.config.value
            updated = current.copy()
            updated["workspacepaths"] = new_paths
            self.config.value = updated
            return True
        return False

class TODOforAIEdge:
    def __init__(self, client_config):
        """
        Initialize the TodoForAI Edge client
        
        Args:
            client_config: Configuration object (required)
            
        Raises:
            ValueError: If config is not provided
        """
        if client_config is None:
            raise ValueError("Config object must be provided to TODOforAIEdge")
            
        # Store the config object
        self.api_url = client_config.api_url
        self.api_url = f"http://{self.api_url}" if self.api_url.startswith("localhost") else self.api_url
        self.api_key = client_config.api_key
        self.email = client_config.email
        self.password = client_config.password
        # Add debug attribute for convenience
        self.debug = client_config.debug
        self.ws = None
        self.ws_url = client_config.get_ws_url()
        self.edge_config = EdgeConfig()
        
        # Subscribe to config changes
        self.edge_config.config.subscribe_async(self._on_config_change, name="edge2backend_on_config_change")
        
        self.agent_id = ""
        self.user_id = ""
        self.edge_id = ""
        self.connected = False
        self.heartbeat_task = None
        self.fingerprint = generate_machine_fingerprint()
        
        # Set logging level based on config
        if self.debug:
            logger.setLevel(logging.DEBUG)
    
    async def _on_config_change(self, config: Dict[str, Any]) -> None:
        """Callback when config changes"""
        logger.info("Edge config changed")
        paths = config.get("workspacepaths", [])

        # If we have an edge_id, update the server
        if self.edge_id and self.connected:
            try:
                response = await async_request(
                    self,
                    'patch',
                    f"/api/v1/edges/{self.edge_id}",
                    {"workspacepaths": paths}
                )
                
                if response:
                    logger.info("Updated edge config on server")
                else:
                    logger.error("Failed to update edge config on server")
            except Exception as e:
                logger.error(f"Error updating edge config on server: {str(e)}")
        
    async def authenticate(self):
        """Authenticate with email and password to get API key"""
        if self.api_key:
            logger.info("Already have API key, skipping authentication")
            return True
            
        if not self.email or not self.password:
            logger.error("Email and password are required for authentication")
            return False
            
        try:
            logger.info(f"Authenticating with email: {self.email}")
            self.api_key = authenticate_and_get_api_key(self.email, self.password, self.api_url)
            logger.info(f"Successfully authenticated as {self.email}")
            return True
        except Exception as e:
            logger.error(f"Authentication failed: {str(e)}")
            return False
        
    async def _load_edge_config(self):
        """Load edge configuration from the API"""
        if not self.edge_id:
            logger.warning("Cannot load edge config: missing edge_id")
            return False
        
        try:
            response = await async_request(self, 'get', f"/api/v1/edges/{self.edge_id}")
            
            if not response:
                return False
                
            data = response.json()
            
            # Use the update method to update the config
            self.edge_config.update(data)
            
            logger.info(f"Loaded edge configuration: {self.edge_config.name}")
            logger.info(f"Workspace paths: {self.edge_config.workspacepaths}")
            logger.info(f"Shell enabled: {self.edge_config.is_shell_enabled}")
            logger.info(f"Filesystem enabled: {self.edge_config.is_filesystem_enabled}")
            
            # Update edge status to ONLINE
            await self._update_edge_status(EdgeStatus.ONLINE)
            
            # We no longer start file syncing for all workspace paths here
            # It will be done lazily when files are requested
            
            return True
            
        except Exception as e:
            logger.error(f"Error loading edge configuration: {str(e)}")
            return False

    async def _start_workspace_syncs(self):
        """Start file synchronization for all workspace paths"""
        from .file_sync import start_workspace_sync, stop_all_syncs
        
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
            await self._send_response(edge_status_msg(self.edge_id, status))
                
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
                logger.info(f"Connected with edge ID: {self.edge_id} and user ID: {self.user_id}")
        
            # Load edge configuration after connection
                asyncio.create_task(self._load_edge_config())
            
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
            
            elif msg_type == FE.BLOCK_SIGNAL:
                asyncio.create_task(handle_block_signal(payload, self))
            
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
            
            else:
                logger.warning(f"Unknown message type: {msg_type}")
                
        except Exception as error:
            stack_trace = traceback.format_exc()
            logger.error(f"Error handling message: {str(error)}\nStacktrace:\n{stack_trace}")


    async def _send_response(self, message):
        """Send a response to the server
        
        Args:
            message: A complete message object with type and payload
        """
        if self.ws and self.connected:
            message_json = json.dumps(message)
            await self.ws.send(message_json)
            if self.debug:
                logger.debug(f"Sent response: {message['type']}")
                if self.debug > 1:  # More verbose debugging
                    logger.debug(f"Payload: {message['payload']}")

    async def connect(self):
        """Connect to the WebSocket server"""
        # Authenticate if needed
        if not self.api_key and (self.email and self.password):
            auth_success = await self.authenticate()
            if not auth_success:
                logger.error("Authentication failed, cannot connect")
                return
                
        if not self.api_key:
            logger.error("No API key available, cannot connect")
            return
            
        fingerprint = generate_machine_fingerprint()
        print(f"Fingerprint: {fingerprint}")
        
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
        except websockets.exceptions.InvalidStatusCode as error:
            stack_trace = traceback.format_exc()
            logger.error(f"WebSocket connection failed with status code: {error.status_code}\nStacktrace:\n{stack_trace}")
            if error.status_code == 401:
                logger.error("Authentication failed. Please check your API key.")
            elif error.status_code == 403:
                logger.error("Access forbidden. Your API key might not have the required permissions.")
            else:
                logger.error(f"Server returned error: {error}")
        except websockets.exceptions.ConnectionClosedError as error:
            stack_trace = traceback.format_exc()
            logger.error(f"WebSocket connection closed unexpectedly: {error}\nStacktrace:\n{stack_trace}")
        except websockets.exceptions.ConnectionClosedOK as error:
            logger.info(f"WebSocket connection closed normally: {error}")
        except Exception as error:
            stack_trace = traceback.format_exc()
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
            logger.info(f"Connecting to server (attempt {attempt+1}/{max_attempts})")
            
            try:
                await self.connect()
                
                # If we get here, the connection was closed normally
                # Reset attempt counter
                attempt = 0
                
                # Stop all file syncs when disconnected
                from .file_sync import stop_all_syncs
                await stop_all_syncs()
                
                # Wait before reconnecting
                logger.info("Connection closed. Reconnecting in 4 seconds...")
                await asyncio.sleep(4.0)
                
            except Exception as error:
                logger.error(f"Connection error: {str(error)}")
                attempt += 1
                
                # Stop all file syncs on error
                from .file_sync import stop_all_syncs
                await stop_all_syncs()
                
                if attempt < max_attempts:
                    delay = min(4 + attempt, 20.0)
                    logger.info(f"Reconnecting in {delay:.1f} seconds...")
                    await asyncio.sleep(delay)
                else:
                    logger.error("Maximum reconnection attempts reached. Giving up.")
                    break
