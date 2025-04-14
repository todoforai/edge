import os
import hashlib
import asyncio
import logging
import time
import queue
import threading

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from .constants import Edge2FrontAgent as EFA
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
        abs_path = os.path.abspath(path)
        
        # Use the thread-safe queue instead of directly interacting with asyncio
        self.sync_manager.thread_queue.put({
            "action": action,
            "abs_path": abs_path,
        })

class WorkspaceSyncManager:
    """Manages synchronization of workspace files with the server"""
    
    def __init__(self, client, workspace_dir):
        self.client = client
        self.workspace_dir = os.path.abspath(workspace_dir)
        self.sync_queue = asyncio.Queue()
        self.thread_queue = queue.Queue()  # Thread-safe queue for file events
        self.observer = None
        self.sync_task = None
        self.queue_task = None  # Task to process the thread queue
        self.is_running = False
        self.file_cache = {}  # Cache of file metadata and content hashes
        
        
        # Track which files we should sync
        self.project_files_abs = set()
        self.filtered_files_abs = set()
        self.filtered_dirs_abs = set()
        
        # Track initial sync progress
        self.initial_sync_complete = False

    
    async def initialize_file_lists(self):
        """Initialize the lists of files to sync based on workspace filtering"""
        # Use the workspace handler to get filtered files and folders
        project_files, filtered_files, filtered_dirs = get_filtered_files_and_folders(self.workspace_dir)
        
        # Store as sets of absolute paths for easier lookup
        self.project_files_abs = set(project_files)
        self.filtered_files_abs = set(filtered_files)
        self.filtered_dirs_abs = set(filtered_dirs)
        
        logger.info(f"Initialized file lists: {len(self.project_files_abs)} project files to sync")
    
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
        
        # Start thread queue processor
        self.queue_task = asyncio.create_task(self.process_thread_queue())
        
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
        
        # Create tasks for parallel syncing of all files
        sync_tasks = []
        for abs_path in self.project_files_abs:
            sync_tasks.append(asyncio.create_task(self.sync_file("create", abs_path)))
        
        logger.info(f"Started parallel sync of {len(self.project_files_abs)} files")
        
        # Wait for all sync tasks to complete
        if sync_tasks:
            await asyncio.gather(*sync_tasks)
    
        # Send completion signal
        await self._send_sync_complete_signal()
        
    async def process_thread_queue(self):
        """Process the thread queue and move items to the asyncio queue"""
        while self.is_running:
            try:
                # Check if there are items in the thread queue
                try:
                    # Non-blocking get with timeout
                    event = self.thread_queue.get(block=True, timeout=0.5)
                    # Put the event in the asyncio queue
                    await self.sync_queue.put(event)
                    self.thread_queue.task_done()
                except queue.Empty:
                    # No items in queue, just continue
                    await asyncio.sleep(0.1)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error processing thread queue: {str(e)}")
                await asyncio.sleep(1)  # Prevent tight loop on error
    
    async def _send_sync_complete_signal(self):
        """Send a signal that sync is complete for this workspace"""
        if self.initial_sync_complete:
            return  # Already sent
            
        self.initial_sync_complete = True
        
        # Send completion signal to server
        await self.client._send_response({
            "type": EFA.WORKSPACE_FILE_DONE,
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
            
        if self.queue_task:
            self.queue_task.cancel()
            try:
                await self.queue_task
            except asyncio.CancelledError:
                pass
            self.queue_task = None
            
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
                    abs_path = event["abs_path"]
                    
                    # Skip files that shouldn't be synced
                    if abs_path not in self.project_files_abs:
                        logger.debug(f"Skipping {action} for non-project file: {abs_path}")
                        continue
                    
                    logger.info(f"Processing {action} for {abs_path}")
                    
                    if action in ("create", "modify"):
                        await self.sync_file(action, abs_path)
                    elif action == "delete":
                        await self.delete_file(abs_path)
                    else:
                        logger.warning(f"Unhandled action type '{action}' for file: {abs_path}")
                        
                except Exception as e:
                    logger.error(f"Error processing file: {str(e)}")
                    
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
    
    async def sync_file(self, action, abs_path):
        """Sync a file to the server"""
        try:
            # Check if file still exists
            if not os.path.exists(abs_path):
                logger.debug(f"File no longer exists: {abs_path}")
                return
            
            if action == "create" or action == "modify":
                
                # Get file stats
                stats = os.stat(abs_path)
                current_size = stats.st_size
                current_mtime = stats.st_mtime
                
                # Check if file has changed since last sync
                if abs_path in self.file_cache:
                    cached = self.file_cache[abs_path]
                    if cached["mtime"] == current_mtime:
                        logger.debug(f"File unchanged (same mtime and size): {abs_path}")
                        return
            
                    # Compute hash for the current file
                    current_hash = self.compute_file_hash(abs_path)
                    
                    # Check if content has actually changed
                    if (cached["hash"] == current_hash and cached["size"] == current_size):
                        logger.debug(f"File unchanged (same hash): {abs_path}")
                        # Update metadata but don't sync
                        self.file_cache[abs_path].update({
                            "mtime": current_mtime,
                        })
                        return
                    
                current_hash = self.compute_file_hash(abs_path)
                self.project_files_abs.add(abs_path)
                # Read file content
                with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                
                # Update cache
                self.file_cache[abs_path] = {
                    "size": current_size,
                    "mtime": current_mtime,
                    "hash": current_hash
                }
            
                # Send file to server with appropriate message type
                await self.client._send_response({
                    "type": EFA.WORKSPACE_FILE_CREATE_SYNC if action == "create" else EFA.WORKSPACE_FILE_MODIFY_SYNC,
                    "payload": {
                        "path": abs_path,
                        "content": content,
                        "edgeId": self.client.edge_id,
                        "userId": self.client.user_id
                    }
                })
            
                logger.info(f"Synced file: {action} {abs_path} ({current_size} bytes)")
            
        except UnicodeDecodeError:
            # Skip binary files
            logger.warning(f"Skipping binary file: {abs_path}")
        except Exception as e:
            logger.error(f"Error syncing file {abs_path}: {str(e)}")

    async def delete_file(self, abs_path):
        """Handle deletion of a file"""
        if abs_path in self.project_files_abs:
            if abs_path in self.file_cache:
                del self.file_cache[abs_path]
            self.project_files_abs.remove(abs_path)
            # Send delete notification
            await self.client._send_response({
                "type": EFA.WORKSPACE_FILE_DELETE_SYNC,
                "payload": {
                    "path": abs_path,
                    "edgeId": self.client.edge_id,
                    "userId": self.client.user_id
                }
            })
            logger.info(f"Deleted file: {abs_path}")


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
    
    logger.info("Stopped all workspace syncs")