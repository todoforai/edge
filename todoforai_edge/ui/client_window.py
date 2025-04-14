import asyncio
import threading
import tkinter as tk
from tkinter import ttk, scrolledtext
import queue

class ClientWindow:
    def __init__(self, root, todo_client):
        self.root = root
        self.todo_client = todo_client  # Store the shared client
        self.api_key = todo_client.api_key
        self.client_running = False
        self.client_thread = None
        self.message_queue = queue.Queue()
        
        self.root.title("TodoForAI Edge - Client")
        self.root.geometry("800x600")
        self.create_widgets()
        
        # Log initial information
        self.log_message(f"TodoForAI Edge Client initialized")
        self.log_message(f"API Key: {self.api_key[:5]}...{self.api_key[-5:] if len(self.api_key) > 10 else ''}")
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
            # Use the existing client
            client = self.todo_client
            
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
        from .auth_window import AuthWindow
        AuthWindow(self.root)
