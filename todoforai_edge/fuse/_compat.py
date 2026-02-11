"""Import shim for FUSE bindings. Tries refuse, then fusepy, else sets FUSE=None."""

FUSE = None
FuseOSError = None
Operations = None

try:
    from refuse.high import FUSE, FuseOSError, Operations
except ImportError:
    try:
        from fuse import FUSE, FuseOSError, Operations
    except ImportError:
        pass


def is_fuse_available() -> bool:
    return FUSE is not None
