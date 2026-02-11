"""Generic extension system for TODOforAI Edge."""

import logging
from typing import Protocol, runtime_checkable

logger = logging.getLogger("todoforai-edge")


@runtime_checkable
class Extension(Protocol):
    name: str

    async def start(self, edge) -> None: ...
    async def stop(self) -> None: ...


def load_extensions(config) -> list[Extension]:
    """Try importing each optional extension. Returns list of available ones."""
    extensions: list[Extension] = []

    # FUSE extension
    if getattr(config, "fuse_enabled", True):
        try:
            from .fuse import create_extension

            ext = create_extension(config)
            if ext is not None:
                extensions.append(ext)
        except ImportError:
            logger.debug("FUSE extension module not available")

    return extensions
