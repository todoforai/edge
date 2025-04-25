import os
import sys
import threading
import asyncio
import tkinter as tk
from tkinter import messagebox
import traceback

from todoforai_edge.ui.auth_window import AuthWindow
from todoforai_edge.ui.client_window import ClientWindow

def setup_azure_theme(root):
    try:
        # Determine the base directory based on whether we're running from a PyInstaller bundle
        if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
            # Running as PyInstaller bundle
            base_dir = sys._MEIPASS
            print(f"Running from PyInstaller bundle, base dir: {base_dir}")
            base_dir = os.path.join(base_dir, "todoforai_edge")
        else:
            # Running as a normal Python script
            base_dir = os.path.dirname(os.path.abspath(__file__))
            print(f"Running as script, base dir: {base_dir}")
        
        # Check for theme file
        azure_tcl = os.path.join("todoforai_edge/ui", "azure.tcl")
        
        print(f"Checking for theme at: {azure_tcl}")
        if os.path.exists(azure_tcl):
            print(f"Found Azure theme at: {azure_tcl}")
        else:
            print("Azure theme file not found")
            return False

        # Load the theme
        root.tk.call("source", azure_tcl)
        root.tk.call("set_theme", "dark")  # Use dark theme by default
        print("Azure theme applied successfully")
        return True
    except Exception as e:
        print(f"Failed to set up Azure theme: {e}")
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
            print(f"Azure theme applied: {theme_applied}")
            
            # If we have a client, start with client window
            if todo_client is not None:
                print("Using existing TODOforAIEdge client")
                client_window = ClientWindow(root, todo_client)
                root.after(200, client_window.start_client)
            else:
                # Create auth window with default config
                print("No client provided, starting with auth window")
                AuthWindow(root, todo_client)
            
            # Set up a handler for when the window is closed
            def on_closing():
                print("Window closing, shutting down application...")
                # Stop any running client
                if todo_client and hasattr(todo_client, 'connected') and todo_client.connected:
                    print("Stopping client before exit...")
                    # We can't await here, so we'll just set the flag
                    todo_client.connected = False
                
                root.destroy()
                if not ui_future.done():
                    ui_future.set_result(None)
                
                # Force exit the application
                print("Exiting application...")
                os._exit(0)
            
            root.protocol("WM_DELETE_WINDOW", on_closing)
            
            # Start main loop
            root.mainloop()
            
            # Signal that UI has completed
            if not ui_future.done():
                ui_future.set_result(None)
                
        except Exception as e:
            print(f"Error starting UI: {str(e)}")
            traceback.print_exc()
            
            # Show error in a standard dialog
            messagebox.showerror("Error Starting UI", str(e))
            
            # Signal error to the main thread
            if not ui_future.done():
                ui_future.set_exception(e)
    
    # Start UI in a separate thread
    ui_thread = threading.Thread(target=ui_thread_func, daemon=True)
    ui_thread.start()
    
    # Wait for UI to complete
    await ui_future
