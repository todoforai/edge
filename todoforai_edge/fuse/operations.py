"""FUSE filesystem operations for todoforai resources.

Port of fs/fuse/src/index.ts (the ops object inside createFuse).
Uses the fusepy/refuse pattern: methods return values or raise FuseOSError.
"""

import errno
import logging
import os
import stat
import threading
import time
from typing import Dict, Optional, Tuple

from .path_mapping import SCHEMES, is_root, is_scheme_root, path_to_uri
from .resource_client import ResourceClient

logger = logging.getLogger("todoforai-edge.fuse")


class ResourceOperations:
    """FUSE operations backed by the todoforai ResourceService."""

    def __init__(self, client: ResourceClient):
        self._client = client
        self._lock = threading.Lock()
        self._next_fd = 10
        # fd → (uri, buffer_or_None)
        self._open_files: Dict[int, Tuple[str, Optional[bytes]]] = {}

        self._uid = os.getuid()
        self._gid = os.getgid()
        self._now = time.time()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _dir_stat(self) -> dict:
        return {
            "st_mode": stat.S_IFDIR | 0o755,
            "st_nlink": 2,
            "st_uid": self._uid,
            "st_gid": self._gid,
            "st_size": 0,
            "st_atime": self._now,
            "st_mtime": self._now,
            "st_ctime": self._now,
        }

    def _file_stat(self, size: int, mtime: float) -> dict:
        return {
            "st_mode": stat.S_IFREG | 0o644,
            "st_nlink": 1,
            "st_uid": self._uid,
            "st_gid": self._gid,
            "st_size": size,
            "st_atime": self._now,
            "st_mtime": mtime,
            "st_ctime": mtime,
        }

    def _raise(self, err: int):
        from ._compat import FuseOSError
        raise FuseOSError(err)

    # ------------------------------------------------------------------
    # FUSE callbacks
    # ------------------------------------------------------------------

    def getattr(self, path: str, fh=None):
        if is_root(path) or is_scheme_root(path):
            return self._dir_stat()

        uri = path_to_uri(path)
        if uri is None:
            self._raise(errno.ENOENT)

        try:
            meta = self._client.get_metadata(uri)
        except OSError as exc:
            self._raise(exc.errno or errno.ENOENT)

        if meta.is_directory:
            return self._dir_stat()

        mtime = (meta.created_at / 1000) if meta.created_at else self._now
        return self._file_stat(meta.size, mtime)

    def readdir(self, path: str, fh=None):
        entries = [".", ".."]

        if is_root(path):
            entries.extend(SCHEMES)
            return entries

        uri = path_to_uri(path)
        if uri is None:
            # scheme root without trailing content → use scheme://
            parts = [p for p in path.split("/") if p]
            if parts and parts[0] in SCHEMES:
                uri = f"{parts[0]}://"
            else:
                return entries

        try:
            items = self._client.list(uri)
            entries.extend(item.name for item in items)
        except OSError:
            pass  # return empty dir on error, same as TS version

        return entries

    def open(self, path: str, flags):
        uri = path_to_uri(path)
        if uri is None:
            self._raise(errno.ENOENT)

        with self._lock:
            fd = self._next_fd
            self._next_fd += 1
            self._open_files[fd] = (uri, None)

        return fd

    def read(self, path: str, size: int, offset: int, fh: int):
        with self._lock:
            entry = self._open_files.get(fh)
        if entry is None:
            return b""

        uri, buf = entry

        # Lazy fetch on first read (same pattern as TS version)
        if buf is None:
            try:
                content = self._client.fetch(uri)
                buf = content.data
            except OSError:
                return b""
            with self._lock:
                self._open_files[fh] = (uri, buf)

        return buf[offset:offset + size]

    def release(self, path: str, fh: int):
        with self._lock:
            self._open_files.pop(fh, None)
        return 0

    # ------------------------------------------------------------------
    # Phase-2 stubs (required by some FUSE consumers / tools)
    # ------------------------------------------------------------------

    def statfs(self, path: str):
        return {
            "f_bsize": 4096,
            "f_frsize": 4096,
            "f_blocks": 2**20,
            "f_bfree": 2**19,
            "f_bavail": 2**19,
            "f_files": 2**16,
            "f_ffree": 2**15,
            "f_favail": 2**15,
            "f_namemax": 255,
        }

    def access(self, path: str, amode: int):
        return 0

    def chmod(self, path: str, mode):
        return 0

    def chown(self, path: str, uid, gid):
        return 0

    def utimens(self, path: str, times=None):
        return 0
