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

# Import constants
from .constants import (
    ServerResponse, Front2Edge, Edge2Agent, Agent2Edge, Edge2Front, EdgeStatus,
    SR, FE, EA, AE, EF
)
from .utils import generate_machine_fingerprint, async_request
from .config import config  # Import the config module
from .messages import edge_status_msg

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

class EdgeConfig:
    """Edge configuration class"""
    def __init__(self, data=None):
        data = data or {}
        self.id = data.get("id", "")
        self.name = data.get("name", "Unknown Edge")
        self.workspacepaths = data.get("workspacepaths", [])
        self.owner_id = data.get("ownerId", "")
        self.status = data.get("status", "OFFLINE")
        self.is_shell_enabled = data.get("isShellEnabled", False)
        self.is_filesystem_enabled = data.get("isFileSystemEnabled", False)
        self.created_at = data.get("createdAt", None)

class TODOforAIEdge:
    def __init__(self, config, api_key=None):
        """
        Initialize the TodoForAI Edge client
        
        Args:
            config: Configuration object (required)
            api_key: Optional API key to override the one in config
            
        Raises:
            ValueError: If config is not provided
        """
        if config is None:
            raise ValueError("Config object must be provided to TODOforAIEdge")
            
        # Store the config object
        self.config = config
        
        # API key can override config value
        self.api_key = api_key or self.config.api_key
        
        self.agent_id = ""
        self.user_id = ""
        self.edge_id = ""
        self.connected = False
        self.ws = None
        self.ws_url = self.config.get_ws_url()
        self.heartbeat_task = None
        self.edge_config = EdgeConfig()
        self.fingerprint = generate_machine_fingerprint()
        
        # Set logging level based on config
        if self.config.debug:
            logger.setLevel(logging.DEBUG)
        
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
            self.config = EdgeConfig(data)
            
            logger.info(f"Loaded edge configuration: {self.config.name}")
            logger.info(f"Workspace paths: {self.config.workspacepaths}")
            logger.info(f"Shell enabled: {self.config.is_shell_enabled}")
            logger.info(f"Filesystem enabled: {self.config.is_filesystem_enabled}")
            
            # Update edge status to ONLINE
            await self._update_edge_status(EdgeStatus.ONLINE)
            
            # Start file syncing for all workspace paths
            if self.config.workspacepaths:
                await self._start_workspace_syncs()
            
            return True
            
        except Exception as e:
            logger.error(f"Error loading edge configuration: {str(e)}")
            return False

    async def _start_workspace_syncs(self):
        """Start file synchronization for all workspace paths"""
        from .file_sync import start_workspace_sync
        
        for workspace_path in self.config.workspacepaths:
            try:
                logger.info(f"Starting file sync for workspace: {workspace_path}")
                await start_workspace_sync(self, workspace_path)
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
                asyncio.create_task(handle_ctx_workspace_request(payload, self))
                
            elif msg_type == AE.FILE_CHUNK_REQUEST:
                asyncio.create_task(handle_file_chunk_request(payload, self))
            
            elif msg_type == FE.GET_FOLDERS:
                asyncio.create_task(handle_get_folders(payload, self))
                
            else:
                logger.warning(f"Unknown message type: {msg_type}")
                
        except Exception as error:
            logger.error(f"Error handling message: {str(error)}")


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
            logger.error(f"WebSocket connection failed with status code: {error.status_code}")
            if error.status_code == 401:
                logger.error("Authentication failed. Please check your API key.")
            elif error.status_code == 403:
                logger.error("Access forbidden. Your API key might not have the required permissions.")
            else:
                logger.error(f"Server returned error: {error}")
        except websockets.exceptions.ConnectionClosedError as error:
            logger.error(f"WebSocket connection closed unexpectedly: {error}")
        except websockets.exceptions.ConnectionClosedOK as error:
            logger.info(f"WebSocket connection closed normally: {error}")
        except Exception as error:
            logger.error(f"WebSocket connection error: {str(error)}")
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
