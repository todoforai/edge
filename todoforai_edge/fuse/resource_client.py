"""Synchronous HTTP client for the backend ResourceService.

Port of fs/fuse/src/client.ts.  Uses requests.Session (blocking) because
FUSE callbacks run in OS threads where blocking I/O is expected.
"""

import errno
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import requests

logger = logging.getLogger("todoforai-edge.fuse")


class ResourceMetadata:
    __slots__ = ("uri", "name", "mime_type", "size", "created_at", "is_directory")

    def __init__(self, data: Dict[str, Any]):
        self.uri: str = data.get("uri", "")
        self.name: str = data.get("name", "")
        self.mime_type: str = data.get("mimeType", "")
        self.size: int = data.get("size", 0) or 0
        self.created_at: Optional[float] = data.get("createdAt")
        self.is_directory: bool = bool(data.get("isDirectory", False))


class ResourceContent:
    __slots__ = ("data", "metadata")

    def __init__(self, data: bytes, metadata: ResourceMetadata):
        self.data = data
        self.metadata = metadata


# Map HTTP status codes to errno values
_STATUS_TO_ERRNO = {
    404: errno.ENOENT,
    403: errno.EACCES,
    401: errno.EACCES,
}


class ResourceClient:
    def __init__(self, base_url: str, api_key: Optional[str] = None, timeout: float = 30):
        self._session = requests.Session()
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        if api_key:
            self._session.headers["x-api-key"] = api_key

    def _request(self, path: str) -> requests.Response:
        url = f"{self._base_url}{path}"
        try:
            resp = self._session.get(url, timeout=self._timeout)
        except requests.Timeout:
            raise OSError(errno.ETIMEDOUT, "Request timed out")
        except requests.ConnectionError:
            raise OSError(errno.EIO, "Connection error")

        if resp.ok:
            return resp

        os_errno = _STATUS_TO_ERRNO.get(resp.status_code, errno.EIO)
        raise OSError(os_errno, f"HTTP {resp.status_code}: {resp.reason}")

    def get_metadata(self, uri: str) -> ResourceMetadata:
        resp = self._request(f"/resources/metadata?uri={quote(uri, safe='')}")
        return ResourceMetadata(resp.json())

    def fetch(self, uri: str) -> ResourceContent:
        resp = self._request(f"/resources?uri={quote(uri, safe='')}")
        data = resp.content
        metadata = self.get_metadata(uri)
        return ResourceContent(data, metadata)

    def list(self, uri: str) -> List[ResourceMetadata]:
        resp = self._request(f"/resources/list?uri={quote(uri, safe='')}")
        entries = resp.json().get("entries", [])
        return [ResourceMetadata(e) for e in entries]

    def close(self):
        self._session.close()
