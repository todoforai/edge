import os
import sys
import threading
import asyncio
import tkinter as tk
from tkinter import messagebox
import traceback
import logging

from todoforai_edge.ui.auth_window import AuthWindow
from todoforai_edge.ui.client_window import ClientWindow

logger = logging.getLogger("todoforai-ui")

def setup_azure_theme(root):
    try:
        # Determine the base directory based on whether we're running from a PyInstaller bundle
        if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
            # Running as PyInstaller bundle
            base_dir = sys._MEIPASS
            logger.debug(f"Running from PyInstaller bundle, base dir: {base_dir}")
            base_dir = os.path.join(base_dir, "todoforai_edge")
        else:
            # Running as a normal Python script
            base_dir = os.path.dirname(os.path.abspath(__file__))
            logger.debug(f"Running as script, base dir: {base_dir}")
        
        # Check for theme file
        azure_tcl = os.path.join("todoforai_edge/ui", "azure.tcl")
        
        logger.debug(f"Checking for theme at: {azure_tcl}")
        if os.path.exists(azure_tcl):
            logger.debug(f"Found Azure theme at: {azure_tcl}")
        else:
            logger.warning("Azure theme file not found")
            return False

        # Load the theme
        root.tk.call("source", azure_tcl)
        root.tk.call("set_theme", "dark")  # Use dark theme by default
        logger.debug("Azure theme applied successfully")
        return True
    except Exception as e:
        stack_trace = traceback.format_exc()
        logger.error(f"Failed to set up Azure theme: {e}\nStacktrace:\n{stack_trace}")
        return False

async def start_ui(todo_client):
    """
    Start the UI using an optional existing client
    
    Args:
        existing_client: Optional existing TODOforAIEdge client to use
        
    Returns:
        None
    """
    ui_future = asyncio.get_event_loop().create_future()
    
    def ui_thread_func():
        try:
            # Create root window for UI
            root = tk.Tk()
            root.title("TodoForAI Edge")
            
            # Try to apply a modern theme
            theme_applied = setup_azure_theme(root)
            logger.debug(f"Azure theme applied: {theme_applied}")
            
            # If we have a client, start with client window
            if todo_client is not None:
                logger.info("Using existing TODOforAIEdge client")
                client_window = ClientWindow(root, todo_client)
                root.after(200, client_window.start_client)
            else:
                # Create auth window with default config
                logger.info("No client provided, starting with auth window")
                AuthWindow(root, todo_client)
            
            # Set up a handler for when the window is closed
            def on_closing():
                logger.info("Window closing, shutting down application...")
                # Stop any running client
                if todo_client and hasattr(todo_client, 'connected') and todo_client.connected:
                    logger.info("Stopping client before exit...")
                    # We can't await here, so we'll just set the flag
                    todo_client.connected = False
                
                root.destroy()
                if not ui_future.done():
                    ui_future.set_result(None)
                
                # Force exit the application
                logger.info("Exiting application...")
                os._exit(0)
            
            root.protocol("WM_DELETE_WINDOW", on_closing)
            
            # Start main loop
            root.mainloop()
            
            # Signal that UI has completed
            if not ui_future.done():
                ui_future.set_result(None)
                
        except Exception as e:
            stack_trace = traceback.format_exc()
            logger.error(f"Error starting UI: {str(e)}\nStacktrace:\n{stack_trace}")
            
            # Show error in a standard dialog
            messagebox.showerror("Error Starting UI", f"{str(e)}\n\nSee logs for details.")
            
            # Signal error to the main thread
            if not ui_future.done():
                ui_future.set_exception(e)
    
    # Check if we're on macOS
    is_macos = sys.platform == "darwin"
    
    # On macOS, we must run Tkinter on the main thread
    if is_macos and threading.current_thread() is threading.main_thread():
        logger.info("Running UI directly on main thread (macOS)")
        ui_thread_func()
    elif is_macos:
        # We're on macOS but not on the main thread
        # This is a problematic situation - log a warning
        logger.warning("On macOS, but not on main thread. This may cause UI issues.")
        # Try to use the main thread if possible
        loop = asyncio.get_event_loop()
        if hasattr(loop, 'call_soon_threadsafe'):
            logger.info("Attempting to schedule UI on main thread via event loop")
            loop.call_soon_threadsafe(ui_thread_func)
        else:
            # Fallback, but this will likely fail on macOS
            logger.warning("No way to schedule on main thread, attempting direct call (may fail)")
            ui_thread_func()
    else:
        # Not on macOS, we can use a separate thread
        logger.info("Starting UI in separate thread (non-macOS platform)")
        ui_thread = threading.Thread(target=ui_thread_func, daemon=True)
        ui_thread.start()
    
    # Wait for UI to complete
    await ui_future
