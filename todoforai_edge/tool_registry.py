"""Auto-install missing tools into ~/.todoforai/tools/"""

import logging
import os
import re
import shutil
import stat
import subprocess
import tarfile
import threading
import urllib.request
import zipfile

from .tool_catalog import BINARY_URL_FUNCS, TOOL_REGISTRY

logger = logging.getLogger("todoforai-edge")

TOOLS_DIR = os.path.join(os.path.expanduser("~"), ".todoforai", "tools")

# Per-binary locks to prevent duplicate concurrent installs
_install_locks: dict[str, threading.Lock] = {}
_global_lock = threading.Lock()


def _get_lock(name: str) -> threading.Lock:
    with _global_lock:
        if name not in _install_locks:
            _install_locks[name] = threading.Lock()
        return _install_locks[name]


def _npm_bin_dir() -> str:
    return os.path.join(TOOLS_DIR, "node_modules", ".bin")


def _venv_bin_dir() -> str:
    if os.name == "nt":
        return os.path.join(TOOLS_DIR, "venv", "Scripts")
    return os.path.join(TOOLS_DIR, "venv", "bin")


def _bin_dir() -> str:
    return os.path.join(TOOLS_DIR, "bin")


def _binary_dest_name(name: str) -> str:
    if os.name == "nt":
        return f"{name}.exe"
    return name


def _tool_path_entries() -> list[str]:
    return [_npm_bin_dir(), _venv_bin_dir(), _bin_dir()]


def build_env_with_tools() -> dict:
    """Return os.environ copy with tool dirs prepended to PATH."""
    env = os.environ.copy()
    extra = os.pathsep.join(_tool_path_entries())
    env["PATH"] = extra + os.pathsep + env.get("PATH", "")
    return env


def _which_with_tools(name: str) -> str | None:
    """shutil.which against augmented PATH."""
    path = os.pathsep.join(_tool_path_entries() + [os.environ.get("PATH", "")])
    return shutil.which(name, path=path)


def _find_referenced_tools(content: str) -> list[str]:
    """Return known tool names referenced in content."""
    return [name for name in TOOL_REGISTRY if re.search(r'\b' + re.escape(name) + r'\b', content)]


def find_missing_tools(content: str) -> list[str]:
    """Return list of known tool names referenced in content that aren't installed."""
    return [name for name in _find_referenced_tools(content) if not _which_with_tools(name)]


def _ensure_venv() -> str:
    """Create venv if it doesn't exist, return venv python path."""
    venv_dir = os.path.join(TOOLS_DIR, "venv")
    if os.name == "nt":
        python = os.path.join(venv_dir, "Scripts", "python.exe")
    else:
        python = os.path.join(venv_dir, "bin", "python")
    if not os.path.exists(python):
        logger.info(f"Creating venv at {venv_dir}")
        subprocess.run(
            [shutil.which("python3") or shutil.which("python") or "python3", "-m", "venv", venv_dir],
            check=True, capture_output=True,
        )
    return python


def _download_file(url: str, tmp_path: str) -> None:
    logger.info(f"Downloading from {url}")
    urllib.request.urlretrieve(url, tmp_path)


def _extract_tar_binary(tmp_path: str, dest: str, expected_names: set[str]) -> None:
    with tarfile.open(tmp_path) as tf:
        for member in tf.getmembers():
            member_base = os.path.basename(member.name)
            if member.isfile() and member_base in expected_names:
                f = tf.extractfile(member)
                if f is None:
                    continue
                with open(dest, "wb") as out:
                    out.write(f.read())
                return
    raise RuntimeError(f"Binary not found in archive: {tmp_path}")


def _extract_zip_binary(tmp_path: str, dest: str, expected_names: set[str]) -> None:
    with zipfile.ZipFile(tmp_path) as zf:
        for member in zf.infolist():
            member_base = os.path.basename(member.filename)
            if not member.is_dir() and member_base in expected_names:
                with zf.open(member) as f, open(dest, "wb") as out:
                    out.write(f.read())
                return
    raise RuntimeError(f"Binary not found in archive: {tmp_path}")


def _extract_binary(url: str, tmp_path: str, dest: str, expected_names: set[str]) -> None:
    if url.endswith(".tar.gz") or url.endswith(".tgz"):
        _extract_tar_binary(tmp_path, dest, expected_names)
        return
    if url.endswith(".zip"):
        _extract_zip_binary(tmp_path, dest, expected_names)
        return
    raise RuntimeError(f"Unsupported archive format for {url}")


def _finalize_binary(tmp_path: str, dest: str, is_archive: bool) -> None:
    if is_archive:
        os.unlink(tmp_path)
    else:
        os.replace(tmp_path, dest)
    os.chmod(dest, os.stat(dest).st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)


def _install_binary(name: str) -> bool:
    url_func = BINARY_URL_FUNCS.get(name)
    if not url_func:
        logger.warning(f"No download URL configured for binary: {name}")
        return False
    bin_dir = _bin_dir()
    os.makedirs(bin_dir, exist_ok=True)
    url, is_archive = url_func()
    dest = os.path.join(bin_dir, _binary_dest_name(name))
    tmp_path = dest + ".tmp"
    expected_names = {name, f"{name}.exe"}
    logger.info(f"Downloading {name}")
    _download_file(url, tmp_path)
    if is_archive:
        _extract_binary(url, tmp_path, dest, expected_names)
    _finalize_binary(tmp_path, dest, is_archive)
    return True


def _install_with_npm(name: str, pkg: str) -> None:
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError(f"npm not found, cannot install {name}")
    subprocess.run(
        [npm, "install", "--prefix", TOOLS_DIR, pkg],
        check=True, capture_output=True, timeout=120,
    )


def _install_with_pip(_: str, pkg: str) -> None:
    python = _ensure_venv()
    subprocess.run(
        [python, "-m", "pip", "install", pkg],
        check=True, capture_output=True, timeout=120,
    )


def _install_with_binary(name: str, _: str) -> None:
    _install_binary(name)


INSTALLERS = {
    "npm": _install_with_npm,
    "pip": _install_with_pip,
    "binary": _install_with_binary,
}


def ensure_tool(name: str) -> bool:
    """Install a single tool. Returns True if installed, False on failure."""
    pkg, installer = TOOL_REGISTRY[name]
    install_fn = INSTALLERS.get(installer)
    if install_fn is None:
        logger.warning(f"Unknown installer type: {installer}")
        return False
    lock = _get_lock(name)
    lock.acquire()
    try:
        if _which_with_tools(name):
            return False  # already installed (by another thread)
        logger.info(f"Installing tool: {name} ({pkg})")
        os.makedirs(TOOLS_DIR, exist_ok=True)
        install_fn(name, pkg)
        logger.info(f"Successfully installed {name}")
        return True
    except Exception as e:
        logger.warning(f"Failed to install {name}: {e}")
        return False
    finally:
        lock.release()


def ensure_tools_for_command(content: str) -> list[str]:
    """Find missing tools in command, install them. Returns list of newly installed names."""
    missing = find_missing_tools(content)
    if not missing:
        return []
    installed = []
    for name in missing:
        if ensure_tool(name):
            installed.append(name)
    return installed
