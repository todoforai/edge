"""Optional FUSE mount for todoforai resources."""

import logging

from ._compat import is_fuse_available
from .mount_manager import FuseMountManager

__all__ = ["is_fuse_available", "FuseMountManager", "create_extension"]

logger = logging.getLogger("todoforai-edge")


class FuseExtension:
    """Extension wrapper around FuseMountManager."""

    name = "fuse"

    def __init__(self, mount_path=None):
        self._mount_path = mount_path
        self._manager = None

    async def start(self, edge) -> None:
        if not is_fuse_available():
            logger.info("FUSE not available (refuse/fusepy not installed or libfuse missing)")
            return

        try:
            self._manager = FuseMountManager(
                api_url=edge.api_url,
                api_key=edge.api_key,
                mount_path=self._mount_path,
            )
            ok = await self._manager.start()
            if not ok:
                logger.warning("FUSE mount did not start successfully")
                self._manager = None
        except Exception:
            logger.exception("Failed to start FUSE mount")
            self._manager = None

    async def stop(self) -> None:
        if self._manager is not None:
            try:
                await self._manager.stop()
            except Exception:
                logger.exception("Error stopping FUSE mount")
            finally:
                self._manager = None


def create_extension(config):
    """Factory: return a FuseExtension or None."""
    mount_path = getattr(config, "fuse_mount_path", None)
    return FuseExtension(mount_path=mount_path)
