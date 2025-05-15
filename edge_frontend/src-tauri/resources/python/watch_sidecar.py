#!/usr/bin/env python3
"""
Auto-restarting script for the WebSocket sidecar.
This script monitors Python files and restarts ws_sidecar.py when changes are detected.
"""

import os
import sys
import time
import subprocess
import signal
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Path to the sidecar script
SIDECAR_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ws_sidecar.py")
DEFAULT_PORT = 9528

def kill_process_on_port(port):
    """Kill any process using the specified port"""
    try:
        # Find and kill process using the port
        subprocess.run(f"kill -9 $(lsof -t -i:{port})", shell=True, stderr=subprocess.DEVNULL)
        return True
    except Exception as e:
        print(f"Error killing process on port {port}: {e}")
        return False

class RestartHandler(FileSystemEventHandler):
    def __init__(self, cmd):
        self.cmd = cmd
        self.process = None
        self.last_restart = 0
        self.start_process()
        
    def start_process(self):
        # First, kill any processes using the port
        kill_process_on_port(DEFAULT_PORT)
        
        # Now handle our own process
        if self.process:
            print("\n----- Terminating previous process -----")
            # Try to terminate gracefully
            self.process.terminate()
            try:
                # Wait for up to 2 seconds for process to terminate
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                # Force kill if it doesn't terminate
                print("Process didn't terminate gracefully, force killing...")
                self.process.kill()
                
        print("\n----- Starting WebSocket sidecar -----\n")
        self.process = subprocess.Popen(self.cmd, shell=True)
        self.last_restart = time.time()
        
    def on_modified(self, event):
        # Only restart for Python files
        if not event.src_path.endswith('.py'):
            return
            
        # Avoid multiple restarts in quick succession (debounce)
        if time.time() - self.last_restart < 1:
            return
            
        print(f"\nFile changed: {event.src_path}")
        self.start_process()
        
    def on_created(self, event):
        if event.src_path.endswith('.py'):
            print(f"\nNew Python file: {event.src_path}")
            self.start_process()

def main():
    # Get the directory to watch (parent directory of the script)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Kill any processes using the port at startup
    kill_process_on_port(DEFAULT_PORT)
    
    # Command to run the sidecar
    cmd = f"python3 {SIDECAR_SCRIPT}"
    
    # Add any command line arguments
    if len(sys.argv) > 1:
        cmd += " " + " ".join(sys.argv[1:])
    
    # Create the file watcher
    event_handler = RestartHandler(cmd)
    observer = Observer()
    
    # Watch the script directory and parent directories
    dirs_to_watch = [
        script_dir,  # Watch the python directory
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))), "todoforai_edge")  # Watch the edge module
    ]
    
    # Add unique directories to watch
    watched_dirs = set()
    for directory in dirs_to_watch:
        if os.path.exists(directory) and directory not in watched_dirs:
            print(f"Watching directory: {directory}")
            observer.schedule(event_handler, directory, recursive=True)
            watched_dirs.add(directory)
    
    # Start the observer
    observer.start()
    
    print(f"Watching for changes to restart {SIDECAR_SCRIPT}")
    print('watched_dirs:', watched_dirs)
    print("Press Ctrl+C to stop")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n----- Stopping -----")
        observer.stop()
        if event_handler.process:
            event_handler.process.terminate()
            try:
                event_handler.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                event_handler.process.kill()
    
    observer.join()
    
if __name__ == "__main__":
    main()