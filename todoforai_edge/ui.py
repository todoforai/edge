import os
import sys
import threading
import asyncio
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import argparse
import queue

from .apikey import authenticate_and_get_api_key
from .client import TODOforAIEdge
from .protocol_handler import register_protocol_handler
from .config import config  # Import the config module

# Default API URL from config

def setup_azure_theme(root):
    """Set up the Azure theme for Tkinter using local files"""
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



class AuthWindow:
    def __init__(self, root, email="", password=""):
        self.root = root
        self.root.title("TodoForAI Edge - Login")
        self.root.geometry("400x600")
        self.email = email
        self.password = password
        self.create_widgets()
        
        # Pre-fill from provided arguments or environment variables
        if self.email:
            self.email_entry.insert(0, self.email)
        elif os.environ.get("TODO4AI_EMAIL"):
            self.email_entry.insert(0, os.environ.get("TODO4AI_EMAIL"))
            
        if self.password:
            self.password_entry.insert(0, self.password)
            
        if os.environ.get("TODO4AI_API_KEY"):
            self.apikey_entry.insert(0, os.environ.get("TODO4AI_API_KEY"))
            
        # Register protocol handler on startup
        self.register_protocol()
    
    def register_protocol(self):
        """Register the application as a protocol handler"""
        try:
            register_protocol_handler()
            print("Protocol handler registered successfully")
        except Exception as e:
            print(f"Failed to register protocol handler: {e}")
    
    def create_widgets(self):
        # Main frame
        main_frame = ttk.Frame(self.root, padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Title label
        label = ttk.Label(
            main_frame,
            text="Connect your PC to TodoForAI",
            font=("Helvetica", 14, "bold")
        )
        label.pack(pady=(20, 20))
        
        # Email login section
        ttk.Label(main_frame, text="Login with Email", font=("Helvetica", 12, "bold")).pack(anchor="w", pady=(10, 5))
        self.email_entry = ttk.Entry(main_frame, width=40)
        self.email_entry.pack(fill="x", pady=(0, 10))
        
        ttk.Label(main_frame, text="Password").pack(anchor="w")
        self.password_entry = ttk.Entry(main_frame, width=40, show="•")
        self.password_entry.pack(fill="x", pady=(0, 10))
        
        self.login_button = ttk.Button(main_frame, text="Login", command=self.login)
        self.login_button.pack(pady=10)
        
        # Separator
        ttk.Separator(main_frame, orient="horizontal").pack(fill="x", pady=15)
        
        # API Key section
        ttk.Label(main_frame, text="Connect with API Key", font=("Helvetica", 12, "bold")).pack(anchor="w", pady=(10, 5))
        self.apikey_entry = ttk.Entry(main_frame, width=40)
        self.apikey_entry.pack(fill="x", pady=(0, 10))
        
        self.connect_button = ttk.Button(main_frame, text="Connect", command=self.connect_with_key)
        self.connect_button.pack(pady=10)
    
    def show_error(self, title, message):
        messagebox.showerror(title, message)
        print(f"ERROR: {title} - {message}")
    
    def login(self):
        email = self.email_entry.get()
        password = self.password_entry.get()
        
        if not email or not password:
            self.show_error("Error", "Email and password are required")
            return
        
        # Disable login button to prevent multiple attempts
        self.login_button.configure(state="disabled", text="Authenticating...")
        
        # Run authentication in a separate thread
        threading.Thread(target=self._authenticate, args=(email, password), daemon=True).start()
    
    def _authenticate(self, email, password):
        try:
            api_key = authenticate_and_get_api_key(email, password)
            self.root.after(0, lambda: self._auth_success(api_key))
        except Exception as exc:
            error_message = str(exc)
            self.root.after(0, lambda: self._auth_failed(error_message))
    
    def _auth_success(self, api_key):
        self.login_button.configure(state="normal", text="Login")
        # Transform this window into client window instead of creating a new one
        self.transform_to_client_window(api_key)

    def connect_with_key(self):
        api_key = self.apikey_entry.get()

        if not api_key:
            self.show_error("Error", "API Key is required")
            return

        # Transform this window into client window
        self.transform_to_client_window(api_key)

    def transform_to_client_window(self, api_key):
        """Transform the login window into a client window"""
        # Clear all widgets from the root window
        for widget in self.root.winfo_children():
            widget.destroy()
        
        # Resize the window
        self.root.geometry("800x600")
        self.root.title("TodoForAI Edge - Client")
        
        # Create client window in the same root
        client_window = ClientWindow(self.root, api_key)
        
        # Start client after a short delay
        self.root.after(200, client_window.start_client)


class ClientWindow:
    def __init__(self, root, api_key):
        self.root = root
        self.api_key = api_key
        self.client_running = False
        self.client_thread = None
        self.message_queue = queue.Queue()
        
        self.root.title("TodoForAI Edge - Client")
        self.root.geometry("800x600")
        self.create_widgets()
        
        # Log initial information
        self.log_message(f"TodoForAI Edge Client initialized")
        self.log_message(f"API Key: {api_key[:5]}...{api_key[-5:] if len(api_key) > 10 else ''}")
        self.log_message("Click 'Start Client' to connect to the server")
        
        # Start checking the message queue
        self.check_message_queue()
    
    def create_widgets(self):
        # Main frame
        main_frame = ttk.Frame(self.root, padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Title and logout button in the same row
        title_frame = ttk.Frame(main_frame)
        title_frame.pack(fill="x", pady=(0, 10))
        
        ttk.Label(title_frame, text="TodoForAI Edge", font=("Helvetica", 16, "bold")).pack(side="left")
        self.logout_button = ttk.Button(title_frame, text="Logout", command=self.logout)
        self.logout_button.pack(side="right")
        
        # Status
        status_frame = ttk.Frame(main_frame)
        status_frame.pack(fill="x", pady=(0, 10))
        
        ttk.Label(status_frame, text="Status:").pack(side="left", padx=(0, 5))
        self.connection_status = ttk.Label(status_frame, text="Disconnected", foreground="red")
        self.connection_status.pack(side="left")
        
        # Log area
        log_frame = ttk.LabelFrame(main_frame, text="Client Log")
        log_frame.pack(fill="both", expand=True, pady=10)
        
        # Create scrolled textbox
        self.log_area = scrolledtext.ScrolledText(log_frame, height=15, font=("Courier", 10))
        self.log_area.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Control buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill="x", pady=10)
        
        self.start_button = ttk.Button(button_frame, text="Start Client", command=self.start_client)
        self.start_button.pack(side="left", padx=5)
        
        self.stop_button = ttk.Button(button_frame, text="Stop Client", command=self.stop_client, state="disabled")
        self.stop_button.pack(side="right", padx=5)
        
        # Status bar
        self.status_label = ttk.Label(main_frame, text="Ready")
        self.status_label.pack(pady=10)

    
    def log_message(self, message):
        self.log_area.insert(tk.END, f"{message}\n")
        self.log_area.see(tk.END)
    
    def check_message_queue(self):
        """Check for messages from the client thread"""
        try:
            while not self.message_queue.empty():
                message = self.message_queue.get_nowait()
                action = message.get('action')
                
                if action == 'connected':
                    self.client_connected()
                elif action == 'error':
                    self.client_error(message.get('error', 'Unknown error'))
                # Add more actions as needed
                
                self.message_queue.task_done()
        except Exception as e:
            print(f"Error processing message queue: {e}")
        
        # Schedule the next check
        self.root.after(100, self.check_message_queue)
    
    def start_client(self):
        if not self.client_running:
            self.start_button.configure(state="disabled")
            self.stop_button.configure(state="normal")
            self.status_label.configure(text="Starting client...")
            self.log_message("Starting client...")
            
            # Start client in a separate thread
            self.client_running = True
            self.client_thread = threading.Thread(
                target=self.run_client,
                daemon=True
            )
            self.client_thread.start()
    
    def stop_client(self):
        if self.client_running:
            self.start_button.configure(state="normal")
            self.stop_button.configure(state="disabled")
            self.status_label.configure(text="Stopping client...")
            self.log_message("Stopping client...")
            
            # Stop the client
            self.client_running = False
            # Note: We should have a proper way to stop the client
            
            self.status_label.configure(text="Client stopped")
            self.connection_status.configure(text="Disconnected", foreground="red")
            self.log_message("Client stopped")
    
    def run_client(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Create and start client
            client = TODOforAIEdge(api_key=self.api_key)
            
            # Signal that client is connected (via queue)
            self.message_queue.put({'action': 'connected'})
            
            # Run the client
            loop.run_until_complete(client.start())
        except Exception as e:
            error_message = str(e)
            # Signal error via queue
            self.message_queue.put({'action': 'error', 'error': error_message})

    
    def client_connected(self):
        self.log_message("Client connected")
        self.status_label.configure(text="Client running")
        self.connection_status.configure(text="Connected", foreground="green")
    
    def client_error(self, error_msg):
        self.log_message(f"Error: {error_msg}")
        self.status_label.configure(text="Client error")
        self.connection_status.configure(text="Error", foreground="red")
        self.start_button.configure(state="normal")
        self.stop_button.configure(state="disabled")
        self.client_running = False
        
    def logout(self):
        """Logout and return to login screen"""
        if self.client_running:
            # Stop the client first
            self.stop_client()
        
        self.log_message("Logging out...")
        
        # Clear all widgets from the root window
        for widget in self.root.winfo_children():
            widget.destroy()
        
        # Resize the window back to login size
        self.root.geometry("400x600")
        self.root.title("TodoForAI Edge - Login")
        
        # Create auth window in the same root
        AuthWindow(self.root)


def run_ui(protocol_url=None, api_key=None):
    """
    Run the UI with optional protocol URL handling
    
    Args:
        protocol_url: Optional URL to handle (todoforai://...)
        api_key: Optional API key to use directly
    """
    try:
        print("Starting TodoForAI Edge UI...")
        
        # Parse command line arguments
        parser = argparse.ArgumentParser(description="TodoForAI Edge Client UI")
        parser.add_argument("--email", default="", help="Email for authentication")
        parser.add_argument("--password", default="", help="Password for authentication")
        args = parser.parse_args()
        
        # Create root window for UI
        root = tk.Tk()
        root.title("TodoForAI Edge")
        
        # Try to apply a modern theme
        theme_applied = setup_azure_theme(root)
        print(f"Azure theme applied: {theme_applied}")
        
        # Check if we can auto-login with environment variables or API key
        env_email = os.environ.get("TODO4AI_EMAIL", "")
        env_password = os.environ.get("TODO4AI_PASSWORD", "")
        env_api_key = os.environ.get("TODO4AI_API_KEY", "")
        
        # If API key is provided directly, start with client window
        if api_key:
            print("Using provided API key")
            client_window = ClientWindow(root, api_key)
            root.after(200, client_window.start_client)
        # If environment has API key, use it
        elif env_api_key:
            print("Using API key from environment")
            client_window = ClientWindow(root, env_api_key)
            root.after(200, client_window.start_client)
        # If environment has both email and password, auto-login
        elif env_email and env_password:
            print(f"Auto-logging in with email from environment: {env_email}")
            try:
                api_key = authenticate_and_get_api_key(env_email, env_password)
                client_window = ClientWindow(root, api_key)
                root.after(200, client_window.start_client)
            except Exception as e:
                print(f"Auto-login failed: {str(e)}")
                # Fall back to showing the login UI
                AuthWindow(root, email=args.email or env_email, password=args.password or env_password)
        else:
            # Create auth window
            AuthWindow(root, email=args.email or env_email, password=args.password or env_password)
        
        # Start main loop
        root.mainloop()
    except Exception as e:
        print(f"Error starting UI: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Show error in a standard dialog
        try:
            messagebox.showerror("Error Starting UI", str(e))
        except:
            pass


if __name__ == "__main__":
    run_ui()

