import os
import hashlib
import asyncio
import logging
import time

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from .constants import Edge2Front as EF
from .workspace_handler import get_filtered_files_and_folders

logger = logging.getLogger("todoforai-edge-sync")

# Global registry to track active sync managers
active_sync_managers = {}

class FileChangeHandler(FileSystemEventHandler):
    """Watches for file system changes and queues them for syncing"""
    
    def __init__(self, sync_manager):
        self.sync_manager = sync_manager
        self.last_events = {}  # Track last event time per file
        self.debounce_time = 0.5  # seconds
        
    def on_created(self, event):
        if event.is_directory:
            return
        self._debounced_queue("create", event.src_path)
    
    def on_modified(self, event):
        if event.is_directory:
            return
        self._debounced_queue("modify", event.src_path)
    
    def on_deleted(self, event):
        if event.is_directory:
            return
        self.queue_change("delete", event.src_path)
    
    def _debounced_queue(self, action, path):
        """Queue a change with debouncing to avoid multiple events for the same file"""
        current_time = time.time()
        
        # If we've seen this file recently, update the action but don't queue yet
        if path in self.last_events and (current_time - self.last_events[path][1] < self.debounce_time):
            self.last_events[path] = (action, current_time)
            return
            
        # Otherwise, queue it and update the timestamp
        self.last_events[path] = (action, current_time)
        self.queue_change(action, path)
    
    def queue_change(self, action, path):
        """Queue a file change for processing"""
        rel_path = os.path.relpath(path, self.sync_manager.workspace_dir)
        
        asyncio.run_coroutine_threadsafe(
            self.sync_manager.sync_queue.put({
                "action": action,
                "path": rel_path,
            }),
            asyncio.get_event_loop()
        )

class WorkspaceSyncManager:
    """Manages synchronization of workspace files with the server"""
    
    def __init__(self, client, workspace_dir):
        self.client = client
        self.workspace_dir = os.path.abspath(workspace_dir)
        self.sync_queue = asyncio.Queue()
        self.observer = None
        self.sync_task = None
        self.is_running = False
        self.file_cache = {}  # Cache of file metadata and content hashes
        
        # Track which files we should sync
        self.project_files = set()
        self.filtered_files = set()
        self.filtered_dirs = set()
        
        # Track initial sync progress
        self.initial_sync_complete = False

    
    async def initialize_file_lists(self):
        """Initialize the lists of files to sync based on workspace filtering"""
        # Use the workspace handler to get filtered files and folders
        project_files, filtered_files, filtered_dirs = get_filtered_files_and_folders(self.workspace_dir)
        
        # Convert to sets of relative paths for easier lookup
        self.project_files = {os.path.relpath(f, self.workspace_dir) for f in project_files}
        self.filtered_files = {os.path.relpath(f, self.workspace_dir) for f in filtered_files}
        self.filtered_dirs = {os.path.relpath(f, self.workspace_dir) for f in filtered_dirs}
        
        logger.info(f"Initialized file lists: {len(self.project_files)} project files to sync")
    
    def should_sync_file(self, rel_path):
        """Check if a file should be synced based on workspace filtering"""
        # Check if the file is in our project files list
        if rel_path in self.project_files:
            return True
        
        # Check if the file is in a filtered directory
        for filtered_dir in self.filtered_dirs:
            if rel_path.startswith(filtered_dir):
                return False
        
        # Check if the file is explicitly filtered
        if rel_path in self.filtered_files:
            return False
        
        # For files not explicitly included or excluded, check if it's a text file
        try:
            # Simple check - try to open as text
            with open(os.path.join(self.workspace_dir, rel_path), 'r', encoding='utf-8', errors='replace') as f:
                # Read a small sample to check if it looks like text
                sample = f.read(1024)
                if '\0' in sample:  # Binary files often contain null bytes
                    return False
                return True  # It's a text file we can read
        except (UnicodeDecodeError, IOError):
            return False  # Can't read as text or other error
    
    async def start(self):
        """Start the file synchronization manager"""
        if self.is_running:
            return
            
        self.is_running = True
        
        # Initialize file lists
        await self.initialize_file_lists()
        
        # Start file watcher
        self.observer = Observer()
        event_handler = FileChangeHandler(self)
        self.observer.schedule(event_handler, self.workspace_dir, recursive=True)
        self.observer.start()
        
        # Start sync processor
        self.sync_task = asyncio.create_task(self.process_sync_queue())
        
        logger.info(f"Started workspace sync for {self.workspace_dir}")
        
        # Initial sync of all project files
        await self.initial_sync()
        
        # Register this sync manager in the global registry
        active_sync_managers[self.workspace_dir] = self
    
    async def initial_sync(self):
        """Perform initial sync of all project files"""
        logger.info("Starting initial sync of project files...")
        
        # Reset sync flag
        self.initial_sync_complete = False
        
        # Queue each project file for syncing
        for rel_path in self.project_files:
            await self.sync_queue.put({
                "action": "create",
                "path": rel_path
            })
        
        logger.info(f"Queued {len(self.project_files)} files for initial sync")
        
        # Wait for the queue to be processed
        await self.sync_queue.join()
        
        # Send completion signal
        await self._send_sync_complete_signal()

        
    async def _send_sync_complete_signal(self):
        """Send a signal that sync is complete for this workspace"""
        if self.initial_sync_complete:
            return  # Already sent
            
        self.initial_sync_complete = True
        
        # Send completion signal to server
        await self.client._send_response({
            "type": EF.WORKSPACE_FILE_DONE,
            "payload": {
                "path": self.workspace_dir,
                "edgeId": self.client.edge_id,
                "userId": self.client.user_id
            }
        })
        
        logger.info(f"Initial sync complete for workspace: {self.workspace_dir}")
    
  
    async def stop(self):
        """Stop the file synchronization manager"""
        if not self.is_running:
            return
            
        self.is_running = False
        
        # Stop the observer
        if self.observer:
            self.observer.stop()
            self.observer.join()
            self.observer = None
        
        # Cancel the sync task
        if self.sync_task:
            self.sync_task.cancel()
            try:
                await self.sync_task
            except asyncio.CancelledError:
                pass
            self.sync_task = None
            
        logger.info(f"Stopped workspace sync for {self.workspace_dir}")
        
        # Remove from global registry
        if self.workspace_dir in active_sync_managers:
            del active_sync_managers[self.workspace_dir]
    
    async def process_sync_queue(self):
        """Process the sync queue"""
        while self.is_running:
            try:
                # Get the next item from the queue with a timeout
                try:
                    event = await asyncio.wait_for(self.sync_queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                
                try:
                    action = event["action"]
                    path = event["path"]
                    
                    # Skip files that shouldn't be synced
                    if not self.should_sync_file(path):
                        logger.debug(f"Skipping {action} for non-project file: {path}")
                        continue
                    
                    logger.info(f"Processing {action} for {path}")
                    
                    if action in ("create", "modify"):
                        await self.sync_file(path)
                    elif action == "delete":
                        await self.delete_file(path)
                        
                except Exception as e:
                    logger.error(f"Error processing file: {str(e)}")
                    
                    # If this was part of initial sync, update counter even on error
                    if event.get("is_initial_sync", False):
                        self.initial_sync_processed += 1
                        if self.initial_sync_processed >= self.initial_sync_total:
                            await self._send_sync_complete_signal()
                finally:
                    self.sync_queue.task_done()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in sync queue processor: {str(e)}")
                await asyncio.sleep(1)  # Prevent tight loop on error
    
    def compute_file_hash(self, file_path):
        """Compute a simple hash of file content"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    async def sync_file(self, rel_path):
        """Sync a file to the server"""
        file_path = os.path.join(self.workspace_dir, rel_path)
        
        try:
            # Check if file still exists
            if not os.path.exists(file_path):
                logger.debug(f"File no longer exists: {file_path}")
                return
                
            # Get file stats
            stats = os.stat(file_path)
            current_size = stats.st_size
            current_mtime = stats.st_mtime
            
            # Check if file has changed since last sync
            if rel_path in self.file_cache:
                cached = self.file_cache[rel_path]
                if cached["mtime"] == current_mtime and cached["size"] == current_size:
                    logger.debug(f"File unchanged (same mtime and size): {rel_path}")
                    return
            
            # Compute hash for the current file
            current_hash = self.compute_file_hash(file_path)
            
            # Check if content has actually changed
            if rel_path in self.file_cache and self.file_cache[rel_path]["hash"] == current_hash:
                logger.debug(f"File unchanged (same hash): {rel_path}")
                # Update metadata but don't sync
                self.file_cache[rel_path].update({
                    "size": current_size,
                    "mtime": current_mtime
                })
                return
            
            # Read file content
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            
            # Update cache
            self.file_cache[rel_path] = {
                "size": current_size,
                "mtime": current_mtime,
                "hash": current_hash
            }
            
            # Send file to server
            await self.client._send_response({
                "type": EF.WORKSPACE_FILE_SYNC,
                "payload": {
                    "action": "sync",
                    "path": rel_path,
                    "content": content,
                    "edgeId": self.client.edge_id,
                    "userId": self.client.user_id
                }
            })
            
            logger.info(f"Synced file: {rel_path} ({current_size} bytes)")
            
        except UnicodeDecodeError:
            # Skip binary files
            logger.warning(f"Skipping binary file: {rel_path}")
        except Exception as e:
            logger.error(f"Error syncing file {rel_path}: {str(e)}")
    
    async def delete_file(self, rel_path):
        """Notify server about deleted file"""
        try:
            # Only notify about deletion if it was a project file we were tracking
            if rel_path not in self.project_files and not self.should_sync_file(rel_path):
                logger.debug(f"Ignoring deletion of non-project file: {rel_path}")
                return
                
            # Remove from cache
            if rel_path in self.file_cache:
                del self.file_cache[rel_path]
            
            # Remove from project files if present
            if rel_path in self.project_files:
                self.project_files.remove(rel_path)
            
            # Send delete notification
            await self.client._send_response({
                "type": EF.WORKSPACE_FILE_SYNC,
                "payload": {
                    "action": "delete",
                    "path": rel_path,
                    "edgeId": self.client.edge_id,
                    "userId": self.client.user_id
                }
            })
            
            logger.info(f"Notified server of deleted file: {rel_path}")
            
        except Exception as e:
            logger.error(f"Error notifying server of deleted file {rel_path}: {str(e)}")

# Function to start syncing a workspace
async def start_workspace_sync(client, workspace_dir):
    """Start syncing a workspace directory"""
    workspace_dir = os.path.abspath(workspace_dir)
    
    # Check if we're already syncing this workspace
    if workspace_dir in active_sync_managers:
        logger.info(f"Workspace {workspace_dir} is already being synced")
        return active_sync_managers[workspace_dir]
    
    # Create and start a new sync manager
    sync_manager = WorkspaceSyncManager(client, workspace_dir)
    await sync_manager.start()
    
    logger.info(f"Started syncing workspace: {workspace_dir}")
    return sync_manager

# Function to stop syncing a workspace
async def stop_workspace_sync(workspace_dir):
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
    for workspace_dir, sync_manager in list(active_sync_managers.items()):
        await sync_manager.stop()
    
    logger.info(f"Stopped all workspace syncs")

