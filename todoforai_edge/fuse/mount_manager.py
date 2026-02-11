"""Lifecycle manager for the FUSE mount.

Starts FUSE in a daemon thread and provides clean unmount on shutdown.
Designed to be called from edge's asyncio context.
"""

import asyncio
import logging
import os
import platform
import subprocess
import threading
import time
from typing import Optional

logger = logging.getLogger("todoforai-edge.fuse")

DEFAULT_MOUNT_PATH = os.path.expanduser("~/.todoforai/resources")


class FuseMountManager:
    def __init__(self, api_url: str, api_key: Optional[str] = None, mount_path: Optional[str] = None):
        self._api_url = api_url
        self._api_key = api_key
        self._mount_path = mount_path or DEFAULT_MOUNT_PATH
        self._thread: Optional[threading.Thread] = None
        self._mounted = False

    @property
    def mounted(self) -> bool:
        return self._mounted

    @property
    def mount_path(self) -> str:
        return self._mount_path

    # ------------------------------------------------------------------
    # Public API (called from async context)
    # ------------------------------------------------------------------

    async def start(self) -> bool:
        """Mount the FUSE filesystem in a background daemon thread.

        Returns True if mounted successfully, False otherwise.
        """
        from ._compat import FUSE, is_fuse_available
        if not is_fuse_available():
            logger.info("FUSE not available (refuse/fusepy not installed or libfuse missing)")
            return False

        # Handle stale mount from a previous crash
        if os.path.ismount(self._mount_path):
            logger.warning(f"Stale mount detected at {self._mount_path}, attempting unmount")
            self._force_unmount()
            await asyncio.sleep(0.5)
            if os.path.ismount(self._mount_path):
                logger.error(f"Could not clear stale mount at {self._mount_path}")
                return False

        # Ensure mount directory exists
        os.makedirs(self._mount_path, exist_ok=True)

        # Build the operations object
        from .resource_client import ResourceClient
        from .operations import ResourceOperations

        client = ResourceClient(self._api_url, self._api_key)
        ops = ResourceOperations(client)

        # Launch FUSE in a daemon thread (FUSE() blocks until unmount)
        def _run_fuse():
            try:
                FUSE(ops, self._mount_path, foreground=True, nothreads=False, allow_other=False)
            except Exception:
                logger.exception("FUSE thread crashed")
            finally:
                self._mounted = False

        self._thread = threading.Thread(target=_run_fuse, name="fuse-mount", daemon=True)
        self._thread.start()

        # Poll for mount to appear (up to 5 seconds)
        ok = await self._wait_for_mount(timeout=5.0)
        if ok:
            self._mounted = True
            logger.info(f"Mounted resources at {self._mount_path}")
        else:
            logger.error(f"FUSE thread started but mount not detected at {self._mount_path}")

        return ok

    async def stop(self) -> None:
        """Unmount cleanly and wait for the FUSE thread to exit."""
        if not self._mounted and (self._thread is None or not self._thread.is_alive()):
            return

        self._force_unmount()

        # Wait for thread to finish (up to 5 seconds)
        if self._thread and self._thread.is_alive():
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._thread.join, 5.0)

        self._mounted = False
        logger.info(f"Unmounted {self._mount_path}")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _wait_for_mount(self, timeout: float) -> bool:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if os.path.ismount(self._mount_path):
                return True
            # Also bail early if the thread died
            if self._thread and not self._thread.is_alive():
                return False
            await asyncio.sleep(0.2)
        return False

    def _force_unmount(self) -> None:
        system = platform.system()
        try:
            if system == "Linux":
                subprocess.run(["fusermount", "-u", self._mount_path],
                               capture_output=True, timeout=10)
            elif system == "Darwin":
                subprocess.run(["umount", self._mount_path],
                               capture_output=True, timeout=10)
            else:
                subprocess.run(["umount", self._mount_path],
                               capture_output=True, timeout=10)
        except FileNotFoundError:
            logger.warning("fusermount/umount not found; cannot force-unmount")
        except subprocess.TimeoutExpired:
            logger.warning("Unmount command timed out")
