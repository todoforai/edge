"""Frontend WebSocket client for todo streaming updates."""

import asyncio
import json
import logging
import ssl
import uuid
import platform
from typing import Callable, Dict, Any, Optional

import aiohttp
import websockets

from .utils import normalize_api_url

logger = logging.getLogger("todoforai-edge.frontend-ws")


class TodoStreamError(Exception):
    pass


class FrontendWebSocket:
    """WebSocket client for /ws/v1/frontend to receive todo updates."""

    # Connection
    MSG_CONNECTED = "ServerResponse.CONNECTED_FRONTEND"

    # Todo lifecycle
    MSG_TODO_START = "todo:msg_start"
    MSG_TODO_DONE = "todo:msg_done"
    MSG_TODO_ERROR = "todo:msg_error"
    MSG_TODO_STOP = "todo:msg_stop_sequence"

    # Block types (for callback to distinguish)
    MSG_BLOCK_MESSAGE = "block:message"
    MSG_BLOCK_END = "block:end"
    MSG_BLOCK_START_TEXT = "block:start_text"
    MSG_BLOCK_START_SHELL = "block:start_shell"
    MSG_BLOCK_START_FILE = "block:start_createfile"
    MSG_BLOCK_START_MODIFY = "block:start_modifyfile"
    MSG_BLOCK_SH_RESULT = "block:sh_msg_result"

    def __init__(self, api_url: str, api_key: str):
        self.api_url = normalize_api_url(api_url)
        self.api_key = api_key
        self.tab_id = str(uuid.uuid4())
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.connected = False
        self._callbacks: Dict[str, Callable] = {}
        self._completion_events: Dict[str, asyncio.Event] = {}
        self._completion_results: Dict[str, Dict[str, Any]] = {}
        self._receive_task: Optional[asyncio.Task] = None

    def _get_ws_url(self) -> str:
        url = self.api_url
        if url.startswith("https://"):
            ws_url = url.replace("https://", "wss://")
        elif url.startswith("http://"):
            ws_url = url.replace("http://", "ws://")
        else:
            ws_url = f"wss://{url}"
        return f"{ws_url}/ws/v1/frontend?tabId={self.tab_id}"

    def _create_ssl_context(self) -> Optional[ssl.SSLContext]:
        if not self._get_ws_url().startswith("wss://"):
            return None
        if platform.system() == "Darwin" and platform.machine() == "arm64":
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            return context
        return None

    async def __aenter__(self):
        await self._connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._close()

    async def _connect(self) -> bool:
        if self.connected and self.ws:
            return True

        ws_url = self._get_ws_url()
        logger.info(f"Connecting to frontend WebSocket: {ws_url}")

        try:
            self.ws = await websockets.connect(
                ws_url,
                subprotocols=[self.api_key],
                ssl=self._create_ssl_context(),
                max_size=5 * 1024 * 1024,
            )
            self.connected = True
            self._receive_task = asyncio.create_task(self._receive_loop())
            await asyncio.sleep(0.1)
            return True
        except Exception as e:
            logger.error(f"Failed to connect frontend WebSocket: {e}")
            self.connected = False
            return False

    async def _close(self):
        self.connected = False
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None
        if self.ws:
            await self.ws.close()
            self.ws = None
        self._callbacks.clear()
        self._completion_events.clear()
        self._completion_results.clear()

    async def _subscribe(self, todo_id: str, callback: Callable = None) -> bool:
        if not self.connected and not await self._connect():
            return False

        if callback:
            self._callbacks[todo_id] = callback

        subscribe_url = f"{self.api_url}/api/v1/todos/{todo_id}/subscribe"
        headers = {
            "x-api-key": self.api_key,
            "x-tab-id": self.tab_id,
            "Content-Type": "application/json"
        }

        ssl_context = self._create_ssl_context()
        connector = aiohttp.TCPConnector(ssl=ssl_context) if ssl_context else None

        try:
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.post(subscribe_url, headers=headers, json={"todoId": todo_id}) as response:
                    if response.status == 200:
                        logger.info(f"Subscribed to todo: {todo_id}")
                        return True
                    error_text = await response.text()
                    logger.error(f"Subscribe failed {todo_id}: {response.status} - {error_text}")
                    return False
        except Exception as e:
            logger.error(f"Subscribe error {todo_id}: {e}")
            return False

    async def _receive_loop(self):
        try:
            async for message in self.ws:
                try:
                    await self._handle_message(json.loads(message))
                except json.JSONDecodeError:
                    pass
                except Exception as e:
                    logger.error(f"Message handling error: {e}")
        except websockets.ConnectionClosed:
            self.connected = False
        except asyncio.CancelledError:
            pass

    async def _handle_message(self, data: Dict[str, Any]):
        msg_type = data.get("type", "")
        payload = data.get("payload", {})
        todo_id = payload.get("todoId") or payload.get("todo_id")

        if msg_type == self.MSG_CONNECTED:
            return

        if todo_id and todo_id in self._callbacks:
            callback = self._callbacks[todo_id]
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(msg_type, payload)
                else:
                    callback(msg_type, payload)
            except Exception as e:
                logger.error(f"Callback error: {e}")

        if msg_type in (self.MSG_TODO_DONE, self.MSG_TODO_ERROR, self.MSG_TODO_STOP):
            if todo_id and todo_id in self._completion_events:
                self._completion_results[todo_id] = {
                    "type": msg_type,
                    "payload": payload,
                    "success": msg_type == self.MSG_TODO_DONE
                }
                self._completion_events[todo_id].set()

    async def wait_for_completion(
        self,
        todo_id: str,
        callback: Callable[[str, Dict[str, Any]], None] = None,
        timeout: float = 300
    ) -> Dict[str, Any]:
        if not await self._subscribe(todo_id, callback):
            raise TodoStreamError(f"Failed to subscribe to todo {todo_id}")

        self._completion_events[todo_id] = asyncio.Event()
        self._completion_results[todo_id] = None

        try:
            await asyncio.wait_for(self._completion_events[todo_id].wait(), timeout=timeout)
            return self._completion_results.get(todo_id, {})
        finally:
            self._completion_events.pop(todo_id, None)
            self._completion_results.pop(todo_id, None)
