import os
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse, unquote
from urllib.request import url2pathname


def get_parent_directory_if_needed(path: str, root_path: Optional[str], fallback_root_paths: List[str]) -> Optional[str]:
    """
    If a relative path starts with the workspace folder name, return the parent dir of that workspace.
    """
    if os.path.isabs(path):
        return None

    all_workspace_paths = []
    if root_path:
        all_workspace_paths.append(root_path)
    if fallback_root_paths:
        all_workspace_paths.extend(fallback_root_paths)

    for workspace_path in all_workspace_paths:
        if not workspace_path:
            continue
        workspace_folder_name = os.path.basename(workspace_path.rstrip(os.sep))
        if path.startswith(workspace_folder_name + os.sep) or path == workspace_folder_name:
            workspace_parent = os.path.dirname(workspace_path)
            if workspace_parent:
                return workspace_parent
    return None


def find_file_in_workspaces(path: str, workspace_paths: List[str], primary_path: Optional[str] = None) -> Optional[str]:
    """Find a file in workspace paths, with optional primary path priority"""
    if primary_path:
        candidate_path = os.path.join(primary_path, path) if not os.path.isabs(path) else path
        candidate_path = os.path.expanduser(candidate_path)
        candidate_path = os.path.abspath(candidate_path)
        if Path(candidate_path).exists():
            return candidate_path

    for workspace_path in workspace_paths:
        candidate_path = os.path.join(workspace_path, path)
        candidate_path = os.path.expanduser(candidate_path)
        candidate_path = os.path.abspath(candidate_path)
        if Path(candidate_path).exists():
            return candidate_path

    return None


def resolve_file_path(path: str, root_path: Optional[str] = None, fallback_root_paths: List[str] = None) -> str:
    """Resolve file path using root path and fallback paths (supports file://)"""
    if isinstance(path, str) and path.startswith('file://'):
        parsed = urlparse(path)
        path = url2pathname(unquote(parsed.path))

    path = os.path.expanduser(path)

    if fallback_root_paths:
        all_paths = [root_path] + fallback_root_paths if root_path else fallback_root_paths
        parent_dir = get_parent_directory_if_needed(path, root_path, fallback_root_paths)
        if parent_dir and parent_dir not in all_paths:
            all_paths.append(parent_dir)

        found_path = find_file_in_workspaces(path, all_paths, root_path)
        if found_path:
            return found_path

    if root_path and not os.path.isabs(path):
        return os.path.join(root_path, path)

    return path

