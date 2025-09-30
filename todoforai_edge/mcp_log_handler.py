import asyncio
import os
import logging
from typing import Dict, Any, Optional, Callable, Union
from fastmcp.client.logging import LogMessage
import mcp.types as types
from mcp.shared.session import RequestResponder

logger = logging.getLogger("todoforai-mcp-logs")

# Global callback for tool calls and logs
_mcp_callback: Optional[Callable[[dict], None]] = None

def set_mcp_callback(callback: Callable[[dict], None]) -> None:
    """Set the global callback for MCP events"""
    global _mcp_callback
    _mcp_callback = callback

class MCPLogHandler:
    """Handles MCP server logging using FastMCP's structured logging"""
    
    async def mcp_log_handler(self, message: LogMessage) -> None:
        """
        Robust handler for FastMCP logging notifications.
        Accepts:
          - SDK LogMessage objects (with .data/.level/.logger)
          - dicts with similar keys
          - plain strings
        """
        try:
            # Extract fields from various possible shapes
            data = None
            level = None
            logger_name = None

            if hasattr(message, "data"):
                data = getattr(message, "data")
                level = getattr(message, "level", None)
                logger_name = getattr(message, "logger", None)
            elif isinstance(message, dict):
                data = message.get("data", message)
                level = message.get("level")
                logger_name = message.get("logger")
            else:
                data = message

            # Normalize level
            level = (level or "INFO")
            if isinstance(level, bytes):
                level = level.decode("utf-8", errors="ignore")
            if not isinstance(level, str):
                level = str(level)
            level_upper = level.upper()

            # Normalize logger
            logger_name = logger_name or "mcp-server"
            if not isinstance(logger_name, str):
                logger_name = str(logger_name)

            # Extract message text
            if isinstance(data, dict):
                msg = data.get("msg") or data.get("message") or data.get("data") or str(data)
                extra = data.get("extra")
            elif isinstance(data, (str, bytes)):
                msg = data.decode("utf-8", errors="ignore") if isinstance(data, bytes) else data
                extra = None
            else:
                msg = str(data)
                extra = None

            # Level mapping (compatible)
            LEVEL_MAP = {
                "CRITICAL": logging.CRITICAL,
                "ERROR": logging.ERROR,
                "WARNING": logging.WARNING,
                "WARN": logging.WARNING,
                "INFO": logging.INFO,
                "DEBUG": logging.DEBUG,
                "TRACE": logging.DEBUG,
            }
            log_level = LEVEL_MAP.get(level_upper, logging.INFO)

            # Log
            mcp_logger = logging.getLogger(f"mcp.{logger_name}")
            mcp_logger.log(log_level, f"[MCP] {msg}", extra=extra if isinstance(extra, dict) else None)

            # Optional callback for UI
            if _mcp_callback:
                _mcp_callback({
                    "type": "log",
                    "level": level_upper.lower(),
                    "logger": logger_name,
                    "message": msg,
                    "extra": extra if isinstance(extra, dict) else None,
                })
        except Exception as e:
            logging.getLogger("todoforai-mcp").error(f"Error handling MCP log message: {e}")

    async def mcp_message_handler(
        self,
        message: Union[RequestResponder[types.ServerRequest, types.ClientResult], types.ServerNotification, Exception],
    ) -> None:
        """
        Handle ALL incoming MCP messages including exceptions from non-JSON stdout.
        This catches:
        - Exceptions (non-JSON stdout lines like console.error, debug prints, etc.)
        - Server notifications
        - Server requests
        """
        try:
            if isinstance(message, Exception):
                # This is a non-JSON stdout line that couldn't be parsed
                error_msg = str(message)
                
                # Log it
                mcp_logger = logging.getLogger("mcp.stdout")
                mcp_logger.warning(f"[MCP Non-JSON] {error_msg}")
                
                # Send to UI callback
                if _mcp_callback:
                    _mcp_callback({
                        "type": "stdout_error",
                        "level": "warning",
                        "logger": "stdout",
                        "message": error_msg,
                        "raw_exception": str(type(message).__name__),
                    })
                    
            elif isinstance(message, types.ServerNotification):
                # Handle server notifications (including logging notifications)
                notification_type = type(message.root).__name__
                mcp_logger = logging.getLogger("mcp.notifications")
                mcp_logger.debug(f"[MCP Notification] {notification_type}")
                
                # Send to UI callback
                if _mcp_callback:
                    _mcp_callback({
                        "type": "notification",
                        "level": "debug",
                        "logger": "notifications",
                        "message": f"Received {notification_type}",
                        "notification_type": notification_type,
                    })
                    
            elif isinstance(message, RequestResponder):
                # Handle server requests
                request_type = type(message.request.root).__name__
                mcp_logger = logging.getLogger("mcp.requests")
                mcp_logger.debug(f"[MCP Request] {request_type}")
                
                # Send to UI callback
                if _mcp_callback:
                    _mcp_callback({
                        "type": "request",
                        "level": "debug", 
                        "logger": "requests",
                        "message": f"Received {request_type}",
                        "request_type": request_type,
                        "request_id": message.request_id,
                    })
                    
        except Exception as e:
            logging.getLogger("todoforai-mcp").error(f"Error in MCP message handler: {e}")