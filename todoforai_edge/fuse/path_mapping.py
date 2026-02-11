"""Path ↔ URI mapping for the FUSE filesystem.

Port of fs/fuse/src/index.ts lines 32-56.
"""

from typing import Optional

SCHEMES = ["todoforai", "http", "https", "gdrive", "edge"]


def path_to_uri(path: str) -> Optional[str]:
    """Convert a FUSE path to a resource URI.

    /todoforai/abc123            → todoforai://attachment/abc123
    /http/example.com/file.txt   → http://example.com/file.txt
    /https/example.com/file.txt  → https://example.com/file.txt
    """
    parts = [p for p in path.split("/") if p]
    if not parts:
        return None

    scheme = parts[0]
    if scheme not in SCHEMES:
        return None

    if scheme == "todoforai":
        return f"todoforai://attachment/{'/'.join(parts[1:])}"
    return f"{scheme}://{'/'.join(parts[1:])}"


def is_scheme_root(path: str) -> bool:
    parts = [p for p in path.split("/") if p]
    return len(parts) == 1 and parts[0] in SCHEMES


def is_root(path: str) -> bool:
    return path == "/"
