import os
import hashlib
import asyncio
import logging
from typing import Dict, Optional, Tuple

from ..constants.constants import Edge2FrontAgent as EFA

logger = logging.getLogger("todoforai-edge-sync")

# Hard cap for synced file payloads (can be overridden by env)
MAX_SYNC_BYTES = int(os.environ.get("TODOFORAI_EDGE_MAX_SYNC_BYTES", str(100 * 1024)))  # ~100 KiB

# Simple hash cache for dedup: abs_path -> md5 hex
_file_hash_cache: Dict[str, str] = {}


async def _read_file_async(file_path: str) -> Optional[Tuple[str, str, int]]:
    """Read file and compute hash. Returns (content, hash_hex, size) or None."""
    try:
        with open(file_path, 'rb') as f:
            data = f.read()

        file_hash = hashlib.md5(data).hexdigest()

        try:
            content = data.decode('utf-8')
        except UnicodeDecodeError:
            content = data.decode('utf-8', errors='replace')

        return content, file_hash, len(data)

    except Exception as e:
        logger.error(f"Error reading file {file_path}: {str(e)}")
        raise


def _should_skip_oversized_file(abs_path: str, size: int) -> bool:
    """Check if file should be skipped due to size."""
    if size > MAX_SYNC_BYTES:
        logger.warning(f"Skipping oversized file (size={size:,} bytes > {MAX_SYNC_BYTES:,}): {abs_path}")
        return True
    return False


async def _send_file_sync(edge, action: str, abs_path: str, content: str):
    """Send file sync message to server."""
    message_type = EFA.WORKSPACE_FILE_CREATE_SYNC if action == "create" else EFA.WORKSPACE_FILE_MODIFY_SYNC

    await edge.send_response({
        "type": message_type,
        "payload": {
            "path": abs_path,
            "content": content,
            "edgeId": edge.edge_id,
            "userId": edge.user_id
        }
    })


async def sync_file(edge, action: str, abs_path: str):
    """Sync a single file to the server."""
    try:
        result = await _read_file_async(abs_path)
        if result is None:
            return

        content, file_hash, size = result

        if _should_skip_oversized_file(abs_path, size):
            return

        # Check cache for dedup
        if abs_path in _file_hash_cache and _file_hash_cache[abs_path] == file_hash:
            logger.debug(f"File unchanged (same hash): {abs_path}")
            return

        _file_hash_cache[abs_path] = file_hash
        await _send_file_sync(edge, action, abs_path, content)

    except UnicodeDecodeError:
        logger.warning(f"Skipping binary file: {abs_path}")
    except Exception as e:
        logger.error(f"Error syncing file {abs_path}: {str(e)}")


async def delete_file(edge, abs_path: str):
    """Handle deletion of a file."""
    _file_hash_cache.pop(abs_path, None)

    await edge.send_response({
        "type": EFA.WORKSPACE_FILE_DELETE_SYNC,
        "payload": {
            "path": abs_path,
            "edgeId": edge.edge_id,
            "userId": edge.user_id
        }
    })
    logger.info(f"Deleted file: {abs_path}")
