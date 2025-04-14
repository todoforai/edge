import os
import tkinter as tk
from tkinter import ttk, messagebox
import threading

from ..apikey import authenticate_and_get_api_key
from ..client import TODOforAIEdge
from ..protocol_handler import register_protocol_handler
from ..config import config  # Import the config module

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
            api_key_id = authenticate_and_get_api_key(email, password)
            self.config.api_key = api_key_id
            self.root.after(0, lambda: self._auth_success())
        except Exception as exc:
            error_message = str(exc)
            self.root.after(0, lambda: self._auth_failed(error_message))
    
    def _auth_success(self):
        self.login_button.configure(state="normal", text="Login")
        # Transform this window into client window instead of creating a new one
        self.transform_to_client_window()
    
    def _auth_failed(self, error_message):
        self.login_button.configure(state="normal", text="Login")
        self.show_error("Authentication Failed", error_message)

    def connect_with_key(self):
        self.config.api_key = self.apikey_entry.get()

        if not self.config.api_key:
            self.show_error("Error", "API Key is required")
            return

        # Transform this window into client window
        self.transform_to_client_window()

    def transform_to_client_window(self,):
        """Transform the login window into a client window"""
        # Clear all widgets from the root window
        for widget in self.root.winfo_children():
            widget.destroy()

        # Resize the window
        self.root.geometry("800x600")
        self.root.title("TodoForAI Edge - Client")

        # Create TODOforAIEdge client with the API key and config
        todo_client = TODOforAIEdge(client_config=config)

        # Import here to avoid circular imports
        from .client_window import ClientWindow
        
        # Create client window in the same root
        client_window = ClientWindow(root=self.root, todo_client=todo_client)
        
        # Start client after a short delay
        self.root.after(200, client_window.start_client)
