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

# Message Types
CONNECTED_EDGE = "connected_edge"
PROJECT_DIR_LIST = "project:dir"
TODO_DIR_LIST = "todo:dir"
BLOCK_EXECUTE = "block:execute"
BLOCK_SAVE = "block:save" 
BLOCK_REFRESH = "block:refresh"
BLOCK_KEYBOARD = "block:keyboard"
BLOCK_SIGNAL = "block:signal"
BLOCK_DIFF = "block:diff" 

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("todo4ai-client")

# Import handlers
from .handlers import (
    handle_project_dir_list,
    handle_todo_dir_list,
    handle_block_execute,
    handle_block_save,
    handle_block_refresh,
    handle_block_keyboard,
    handle_block_signal,
    handle_block_diff
)

class Todo4AIClient:
    def __init__(self, api_url=None, api_key=None, debug=False):
        self.api_url = api_url or os.environ.get("TODO4AI_API_URL", "http://localhost:4000")
        self.api_key = api_key or os.environ.get("TODO4AI_API_KEY", "")
        self.debug = debug
        self.agent_id = ""
        self.user_id = ""
        self.edge_id = ""
        self.connected = False
        self.ws = None
        self.ws_url = self._api_to_ws_url(self.api_url)
        self.heartbeat_task = None

    def _api_to_ws_url(self, api_url):
        """Convert HTTP URL to WebSocket URL"""
        if api_url.startswith("https://"):
            return api_url.replace("https://", f"wss://") + f"/ws/v1/edge"
        else:
            return api_url.replace("http://", f"ws://") + f"/ws/v1/edge"

    def _generate_fingerprint(self):
        """Generate a unique fingerprint for this client"""
        identifiers = {}
        
        # Basic system info (OS, architecture, hostname)
        identifiers["platform"] = platform.system()
        identifiers["machine"] = platform.machine()
        identifiers["node"] = platform.node()
        
        # Add CPU info
        identifiers["processor"] = platform.processor()
        
        # Add more stable identifiers based on OS
        if platform.system() == "Linux":
            # Try to get machine-id (stable across reboots)
            try:
                if os.path.exists("/etc/machine-id"):
                    with open("/etc/machine-id", "r") as f:
                        identifiers["machine_id"] = f.read().strip()
            except Exception:
                pass
        elif platform.system() == "Darwin":  # macOS
            try:
                import subprocess
                result = subprocess.run(["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"], 
                                    capture_output=True, text=True)
                for line in result.stdout.splitlines():
                    if "IOPlatformUUID" in line:
                        identifiers["hardware_uuid"] = line.split('=')[1].strip().strip('"')
                        break
            except Exception:
                pass
        elif platform.system() == "Windows":
            try:
                import subprocess
                result = subprocess.run(["wmic", "csproduct", "get", "UUID"], 
                                    capture_output=True, text=True)
                if result.stdout:
                    identifiers["hardware_uuid"] = result.stdout.splitlines()[1].strip()
            except Exception:
                pass
        
        # Encode as base64 for transmission
        return base64.b64encode(json.dumps(identifiers).encode()).decode()


    async def _send_heartbeat(self):
        """Send periodic heartbeats to the server"""
        while self.connected:
            try:
                if self.agent_id:
                    if self.debug:
                        logger.debug(f"Sending heartbeat for agent {self.agent_id}")
                    
                    headers = {"X-API-Key": self.api_key, "Content-Type": "application/json"}
                    url = f"{self.api_url}/api/v1/agents/{self.agent_id}/heartbeat"
                    requests.post(url, headers=headers, json={})
            except Exception as e:
                logger.error(f"Heartbeat error: {str(e)}")
            
            await asyncio.sleep(30)  # Send heartbeat every 30 seconds

    async def _handle_message(self, message):
        """Process incoming messages from the server"""
        try:
            data = json.loads(message)
            msg_type = data.get("type")
            payload = data.get("payload", {})
            
            if self.debug:
                logger.info(f"Received message type: {msg_type}")
                
            if msg_type == CONNECTED_EDGE:
                self.edge_id = payload.get("edgeId", "")
                self.user_id = payload.get("userId", "")
                logger.info(f"Connected with edge ID: {self.edge_id} and user ID: {self.user_id}")
                
            elif msg_type == PROJECT_DIR_LIST:
                await handle_project_dir_list(payload, self)
                
            elif msg_type == TODO_DIR_LIST:
                await handle_todo_dir_list(payload, self)
                
            elif msg_type == BLOCK_EXECUTE:
                await handle_block_execute(payload, self)
                
            elif msg_type == BLOCK_SAVE:
                await handle_block_save(payload, self)
                
            elif msg_type == BLOCK_REFRESH:
                await handle_block_refresh(payload, self)
                
            elif msg_type == BLOCK_KEYBOARD:
                await handle_block_keyboard(payload, self)
                
            elif msg_type == BLOCK_SIGNAL:
                await handle_block_signal(payload, self)
                
            elif msg_type == BLOCK_DIFF:
                await handle_block_diff(payload, self)
                
            else:
                logger.warning(f"Unknown message type: {msg_type}")
                
        except Exception as e:
            logger.error(f"Error handling message: {str(e)}")

    async def _send_response(self, channel, payload):
        """Send a response to the server"""
        if self.ws and self.connected:
            message = json.dumps({"type": channel, "payload": payload})
            await self.ws.send(message)
            if self.debug:
                logger.debug(f"Sent response: {channel}")

    async def connect(self):
        """Connect to the WebSocket server"""
        fingerprint = self._generate_fingerprint()
        print(f"Fingerprint: {fingerprint}")
        ws_url = f"{self.ws_url}?apiKey={self.api_key}&fingerprint={fingerprint}"
        
        if self.debug:
            logger.info(f"Connecting to WebSocket: {ws_url}")
        
        try:
            async with websockets.connect(ws_url) as ws:
                self.ws = ws
                self.connected = True
                logger.info("WebSocket connected")
                
                # Start heartbeat task
                self.heartbeat_task = asyncio.create_task(self._send_heartbeat())
                
                # Process messages
                async for message in ws:
                    await self._handle_message(message)
                    
        except websockets.exceptions.InvalidStatusCode as e:
            logger.error(f"WebSocket connection failed with status code: {e.status_code}")
            if e.status_code == 401:
                logger.error("Authentication failed. Please check your API key.")
            elif e.status_code == 403:
                logger.error("Access forbidden. Your API key might not have the required permissions.")
            else:
                logger.error(f"Server returned error: {e}")
        except websockets.exceptions.ConnectionClosedError as e:
            logger.error(f"WebSocket connection closed unexpectedly: {e}")
        except websockets.exceptions.ConnectionClosedOK as e:
            logger.info(f"WebSocket connection closed normally: {e}")
        except Exception as e:
            logger.error(f"WebSocket connection error: {str(e)}")
        finally:
            self.connected = False
            self.ws = None
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
                
                # Wait before reconnecting
                logger.info("Connection closed. Reconnecting in 4 seconds...")
                await asyncio.sleep(4.0)
                
            except Exception as e:
                logger.error(f"Connection error: {str(e)}")
                attempt += 1
                
                if attempt < max_attempts:
                    delay = min(4 + attempt, 20.0)
                    logger.info(f"Reconnecting in {delay:.1f} seconds...")
                    await asyncio.sleep(delay)
                else:
                    logger.error("Maximum reconnection attempts reached. Giving up.")
                    break
