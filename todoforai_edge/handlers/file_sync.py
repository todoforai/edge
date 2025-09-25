import os
import hashlib
import asyncio
import logging
from typing import Dict, Set, Optional, Tuple, List
from concurrent.futures import ThreadPoolExecutor
import aiofiles

from watchfiles import awatch, Change

from ..constants.constants import Edge2FrontAgent as EFA
from ..constants.workspace_handler import get_filtered_files_and_folders
from ..observable import observable_registry

logger = logging.getLogger("todoforai-edge-sync")

# Hard cap for synced file payloads (can be overridden by env)
MAX_SYNC_BYTES = int(os.environ.get("TODOFORAI_EDGE_MAX_SYNC_BYTES", str(100 * 1024)))  # ~100 KiB

# Maximum number of files to sync in a workspace (can be overridden by env)
MAX_SYNC_FILES = int(os.environ.get("TODOFORAI_EDGE_MAX_SYNC_FILES", "2000"))

# Global registry to track active sync managers
active_sync_managers = observable_registry.create("active_sync_managers", {})

# Thread pool for CPU-bound operations
_hash_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="hash_worker")


class FileState:
    """Represents the state of a file for efficient change detection"""
    __slots__ = ('mtime', 'size', 'hash')
    
    def __init__(self, mtime: float, size: int, hash: str):
        self.mtime = mtime
        self.size = size
        self.hash = hash


class WorkspaceSyncManager:
    """Manages synchronization of workspace files with the server"""
    
    def __init__(self, edge, workspace_dir: str):
        self.edge = edge
        self.workspace_dir = os.path.abspath(workspace_dir)
        self.watch_task: Optional[asyncio.Task] = None
        self.is_running = False
        self.file_cache: Dict[str, FileState] = {}
        
        # Track which files we should sync
        self.project_files_abs: Set[str] = set()
        self.filtered_files_abs: Set[str] = set()
        self.filtered_dirs_abs: Set[str] = set()
        
        # Track initial sync progress
        self.initial_sync_complete = False
        
        # Batch processing
        self.pending_changes: Dict[str, Tuple[Change, float]] = {}
        self.batch_task: Optional[asyncio.Task] = None
        self.batch_interval = 0.5  # Process batches every 500ms
        
        # Performance tracking
        self.sync_stats = {
            'files_synced': 0,
            'files_skipped': 0,
            'sync_errors': 0,
            'bytes_synced': 0
        }

    async def initialize_file_lists(self):
        """Initialize the lists of files to sync based on workspace filtering"""
        # Use the workspace handler to get filtered files and folders
        project_files, filtered_files, filtered_dirs = get_filtered_files_and_folders(self.workspace_dir)
        
        # Check if we have too many files to sync
        if len(project_files) > MAX_SYNC_FILES:
            raise ValueError(
                f"Workspace has {len(project_files)} files to sync, which exceeds the limit of {MAX_SYNC_FILES}. "
                f"Consider adding more files to .gitignore or .aishignore, or set TODOFORAI_EDGE_MAX_SYNC_FILES environment variable to a higher value."
            )
        
        # Store as sets of absolute paths for O(1) lookup
        self.project_files_abs = set(project_files)
        self.filtered_files_abs = set(filtered_files)
        self.filtered_dirs_abs = set(filtered_dirs)
        
        logger.info(f"Initialized file lists: {len(self.project_files_abs)} project files to sync (limit: {MAX_SYNC_FILES})")

    async def start(self):
        """Start the file synchronization manager"""
        if self.is_running:
            return
            
        self.is_running = True
        
        # Initialize file lists
        await self.initialize_file_lists()
        
        # Start batch processing task
        self.batch_task = asyncio.create_task(self._batch_processor())
        
        # Start file watcher
        self.watch_task = asyncio.create_task(self._watch_files())
        
        logger.info(f"Started workspace sync for {self.workspace_dir}")
        
        # Initial sync of all project files
        await self.initial_sync()
        
        # Register this sync manager in the global registry
        active_sync_managers[self.workspace_dir] = self
        
    async def _watch_files(self):
        """Watch for file changes using watchfiles with better error handling"""
        try:
            # Configure watch parameters for better performance
            async for changes in awatch(
                self.workspace_dir,
                recursive=True,
                step=50,  # Check every 50ms
                yield_on_timeout=True,  # Yield empty set on timeout
                stop_event=asyncio.Event() if not self.is_running else None
            ):
                if not self.is_running:
                    break
                
                # Skip empty change sets (from timeout)
                if not changes:
                    continue
                    
                # Add changes to pending queue with timestamp
                current_time = asyncio.get_event_loop().time()
                for change, path in changes:
                    abs_path = os.path.abspath(path)
                    
                    # Quick filter check before adding to queue
                    if abs_path not in self.project_files_abs and change != Change.deleted:
                        # Check if this might be a new project file
                        if not self._is_potential_project_file(abs_path):
                            continue
                    
                    self.pending_changes[abs_path] = (change, current_time)
                        
        except asyncio.CancelledError:
            logger.info("File watcher cancelled")
        except Exception as e:
            logger.error(f"Error in file watcher: {str(e)}")
            # Attempt to restart watcher after error
            if self.is_running:
                await asyncio.sleep(5)
                self.watch_task = asyncio.create_task(self._watch_files())
    
    def _is_potential_project_file(self, abs_path: str) -> bool:
        """Quick check if a file might be a project file without full workspace scan"""
        # Check if it's in a filtered directory
        for filtered_dir in self.filtered_dirs_abs:
            if abs_path.startswith(filtered_dir + os.sep):
                return False
        return True
    
    async def _batch_processor(self):
        """Process pending changes in batches for better performance"""
        while self.is_running:
            try:
                await asyncio.sleep(self.batch_interval)
                
                if not self.pending_changes:
                    continue
                
                # Process all pending changes
                changes_to_process = self.pending_changes.copy()
                self.pending_changes.clear()
                
                # Group changes by type for efficient processing
                creates_modifies = []
                deletes = []
                
                for abs_path, (change, timestamp) in changes_to_process.items():
                    if change == Change.deleted:
                        deletes.append(abs_path)
                    else:
                        creates_modifies.append((change, abs_path))
                
                # Process in parallel
                tasks = []
                
                # Handle creates/modifies
                if creates_modifies:
                    tasks.append(self._process_file_batch(creates_modifies))
                
                # Handle deletes
                for abs_path in deletes:
                    tasks.append(self.delete_file(abs_path))
                
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in batch processor: {str(e)}")
    
    async def _process_file_batch(self, file_changes: List[Tuple[Change, str]]):
        """Process a batch of file creates/modifies"""
        # Read all files in parallel
        read_tasks = []
        for change, abs_path in file_changes:
            if os.path.exists(abs_path):
                read_tasks.append(self._read_file_async(abs_path))
            else:
                read_tasks.append(None)
        
        results = await asyncio.gather(*read_tasks, return_exceptions=True)
        
        # Process results
        for i, result in enumerate(results):
            change, abs_path = file_changes[i]
            
            if isinstance(result, Exception):
                logger.error(f"Error reading file {abs_path}: {result}")
                self.sync_stats['sync_errors'] += 1
                continue
                
            if result is None:
                logger.debug(f"File no longer exists: {abs_path}")
                continue
            
            content, file_hash, size, mtime = result
            
            # Skip oversized files
            if self._should_skip_oversized_file(abs_path, size, file_hash, mtime):
                continue
            
            # Check cache
            if abs_path in self.file_cache:
                cached = self.file_cache[abs_path]
                if cached.hash == file_hash:
                    logger.debug(f"File unchanged (same hash): {abs_path}")
                    self.sync_stats['files_skipped'] += 1
                    # Update metadata
                    self.file_cache[abs_path] = FileState(mtime, size, file_hash)
                    continue
            
            # Update cache
            self.file_cache[abs_path] = FileState(mtime, size, file_hash)
            self.project_files_abs.add(abs_path)
            
            # Send to server
            action = "create" if change == Change.added else "modify"
            await self._send_file_sync(action, abs_path, content)
            
            self.sync_stats['files_synced'] += 1
            self.sync_stats['bytes_synced'] += size
    
    async def _read_file_async(self, file_path: str) -> Optional[Tuple[str, str, int, float]]:
        """Read file asynchronously and compute hash"""
        try:
            # Get file stats first
            stat = os.stat(file_path)
            
            # Read file asynchronously
            async with aiofiles.open(file_path, mode='rb') as f:
                data = await f.read()
            
            # Compute hash in thread pool to avoid blocking
            file_hash = await asyncio.get_event_loop().run_in_executor(
                _hash_executor, hashlib.md5, data
            )
            
            # Decode content
            try:
                content = data.decode('utf-8')
            except UnicodeDecodeError:
                content = data.decode('utf-8', errors='replace')
            
            return content, file_hash.hexdigest(), len(data), stat.st_mtime
            
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {str(e)}")
            raise
    
    def _should_skip_oversized_file(self, abs_path: str, size: int, file_hash: str, mtime: float) -> bool:
        """Check if file should be skipped due to size, updating cache if so"""
        if size > MAX_SYNC_BYTES:
            logger.warning(f"Skipping oversized file (size={size:,} bytes > {MAX_SYNC_BYTES:,}): {abs_path}")
            # Update cache anyway to avoid reprocessing unchanged large files
            self.file_cache[abs_path] = FileState(mtime, size, file_hash)
            self.project_files_abs.add(abs_path)
            return True
        return False

    async def initial_sync(self):
        """Perform initial sync of all project files with improved performance"""
        logger.info("Starting initial sync of project files...")
        
        # Reset sync flag
        self.initial_sync_complete = False
        
        # Process files in batches for better performance
        batch_size = 50
        file_list = list(self.project_files_abs)
        
        for i in range(0, len(file_list), batch_size):
            batch = file_list[i:i + batch_size]
            
            # Create sync tasks for this batch
            tasks = []
            for abs_path in batch:
                if os.path.exists(abs_path):
                    tasks.append(self.sync_file("create", abs_path))
            
            # Process batch
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Log any errors
                for j, result in enumerate(results):
                    if isinstance(result, Exception):
                        logger.error(f"Error syncing file {batch[j]}: {result}")
            
            # Small delay between batches to avoid overwhelming the system
            if i + batch_size < len(file_list):
                await asyncio.sleep(0.1)
        
        # Send completion signal
        await self._send_sync_complete_signal()
        
        logger.info(f"Initial sync complete. Stats: {self.sync_stats}")
    
    async def _send_sync_complete_signal(self):
        """Send a signal that sync is complete for this workspace"""
        if self.initial_sync_complete:
            return
            
        self.initial_sync_complete = True
        
        # Send completion signal to server
        await self.edge.send_response({
            "type": EFA.WORKSPACE_FILE_DONE,
            "payload": {
                "path": self.workspace_dir,
                "edgeId": self.edge.edge_id, # TODO check if this is correct edge_id???
                "userId": self.edge.user_id,
                "stats": self.sync_stats  # Include sync statistics
            }
        })
        
        logger.info(f"Initial sync complete for workspace: {self.workspace_dir}")
    
    async def stop(self):
        """Stop the file synchronization manager"""
        if not self.is_running:
            return
            
        self.is_running = False
        
        # Cancel tasks
        for task in [self.watch_task, self.batch_task]:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        self.watch_task = None
        self.batch_task = None
            
        logger.info(f"Stopped workspace sync for {self.workspace_dir}")
        
        # Remove from global registry
        if self.workspace_dir in active_sync_managers:
            del active_sync_managers[self.workspace_dir]
    
    async def sync_file(self, action: str, abs_path: str):
        """Sync a single file to the server"""
        try:
            result = await self._read_file_async(abs_path)
            if result is None:
                return
                
            content, file_hash, size, mtime = result
            
            # Skip oversized files
            if self._should_skip_oversized_file(abs_path, size, file_hash, mtime):
                return
            
            # Check cache
            if abs_path in self.file_cache:
                cached = self.file_cache[abs_path]
                if cached.hash == file_hash:
                    logger.debug(f"File unchanged (same hash): {abs_path}")
                    # Update metadata
                    self.file_cache[abs_path] = FileState(mtime, size, file_hash)
                    return
            
            # Update cache
            self.file_cache[abs_path] = FileState(mtime, size, file_hash)
            self.project_files_abs.add(abs_path)
            
            # Send to server
            await self._send_file_sync(action, abs_path, content)
            
        except UnicodeDecodeError:
            logger.warning(f"Skipping binary file: {abs_path}")
        except Exception as e:
            logger.error(f"Error syncing file {abs_path}: {str(e)}")

    async def _send_file_sync(self, action: str, abs_path: str, content: str):
        """Send file sync message to server"""
        message_type = EFA.WORKSPACE_FILE_CREATE_SYNC if action == "create" else EFA.WORKSPACE_FILE_MODIFY_SYNC
        
        await self.edge.send_response({
            "type": message_type,
            "payload": {
                "path": abs_path,
                "content": content,
                "edgeId": self.edge.edge_id,
                "userId": self.edge.user_id
            }
        })

    async def delete_file(self, abs_path: str):
        """Handle deletion of a file"""
        if abs_path in self.project_files_abs:
            if abs_path in self.file_cache:
                del self.file_cache[abs_path]
            self.project_files_abs.remove(abs_path)
            
            # Send delete notification
            await self.edge.send_response({
                "type": EFA.WORKSPACE_FILE_DELETE_SYNC,
                "payload": {
                    "path": abs_path,
                    "edgeId": self.edge.edge_id,
                    "userId": self.edge.user_id
                }
            })
            logger.info(f"Deleted file: {abs_path}")

    def get_sync_stats(self) -> Dict[str, int]:
        """Get synchronization statistics"""
        return self.sync_stats.copy()


# Function to start syncing a workspace
async def start_workspace_sync(edge, workspace_dir: str) -> WorkspaceSyncManager:
    """Start syncing a workspace directory"""
    workspace_dir = os.path.abspath(workspace_dir)
    
    # Check if we're already syncing this workspace
    if workspace_dir in active_sync_managers:
        logger.info(f"Workspace {workspace_dir} is already being synced")
        return active_sync_managers[workspace_dir]
    
    # Pre-check file count before creating sync manager
    try:
        project_files, _, _ = get_filtered_files_and_folders(workspace_dir)
        if len(project_files) > MAX_SYNC_FILES:
            error_msg = (
                f"Cannot sync workspace {workspace_dir}: contains {len(project_files)} files, "
                f"which exceeds the limit of {MAX_SYNC_FILES}. "
                f"Consider adding more files to .gitignore or .aishignore, or set "
                f"TODOFORAI_EDGE_MAX_SYNC_FILES environment variable to a higher value."
            )
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        logger.info(f"Pre-sync check passed: {len(project_files)} files to sync (limit: {MAX_SYNC_FILES})")
        
    except Exception as e:
        logger.error(f"Failed to check file count for {workspace_dir}: {str(e)}")
        raise
    
    # Create and start a new sync manager
    sync_manager = WorkspaceSyncManager(edge, workspace_dir)
    
    # Store in registry before starting to prevent race conditions
    active_sync_managers[workspace_dir] = sync_manager
    
    try:
        await sync_manager.start()
        logger.info(f"Started syncing workspace: {workspace_dir}")
        return sync_manager
    except Exception as e:
        # If start fails, remove from registry
        if workspace_dir in active_sync_managers:
            del active_sync_managers[workspace_dir]
        logger.error(f"Failed to start sync for {workspace_dir}: {str(e)}")
        raise


# Function to stop syncing a workspace
async def stop_workspace_sync(workspace_dir: str) -> bool:
    """Stop syncing a workspace directory"""
    workspace_dir = os.path.abspath(workspace_dir)
    
    if workspace_dir in active_sync_managers:
        sync_manager = active_sync_managers[workspace_dir]
        await sync_manager.stop()
        logger.info(f"Stopped syncing workspace: {workspace_dir}")
        return True
    
    logger.info(f"Workspace {workspace_dir} was not being synced")
    return False


# Function to stop all active sync managers
async def stop_all_syncs():
    """Stop all active workspace syncs"""
    # Create a copy of the keys to avoid modifying during iteration
    workspace_dirs = list(active_sync_managers.keys())
    
    for workspace_dir in workspace_dirs:
        await stop_workspace_sync(workspace_dir)
    
    logger.info("Stopped all workspace syncs")


# Function to check if a path is in a workspace and ensure that workspace is synced
async def ensure_workspace_synced(edge, file_path: str) -> bool:
    """
    Ensure that the workspace containing the given file path is being synced.
    Returns True if sync was started, False if already syncing or not in a workspace.
    """
    file_path = os.path.abspath(file_path)
    
    # Find the most specific (innermost) workspace that contains this file
    best_workspace = None
    best_workspace_len = 0
    
    for workspace_dir in edge.edge_config.config["workspacepaths"]:
        workspace_dir = os.path.abspath(workspace_dir)
        
        # Check if the file is in this workspace
        if file_path.startswith(workspace_dir + os.sep) or file_path == workspace_dir:
            # Choose the longest matching workspace path (most specific)
            if len(workspace_dir) > best_workspace_len:
                best_workspace = workspace_dir
                best_workspace_len = len(workspace_dir)
    
    # If we found a workspace, ensure it's synced
    if best_workspace:
        # Check if this workspace is already being synced
        if best_workspace in active_sync_managers:
            return False  # Already syncing
        
        # Start syncing this workspace
        logger.info(f"Lazy-initializing sync for workspace: {best_workspace}")
        await start_workspace_sync(edge, best_workspace)
        return True
    
    return False  # Not in any workspace


# Cleanup function for module shutdown
def cleanup():
    """Cleanup resources on module shutdown"""
    _hash_executor.shutdown(wait=False)