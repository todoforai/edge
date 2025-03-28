import os
import sys
import threading
import asyncio
import customtkinter as ctk

from .apikey import authenticate_and_get_api_key
from .client import TODOforAIEdge

from .apikey import authenticate_and_get_api_key
from .client import TODOforAIEdge

# Default API URL
# DEFAULT_API_URL = "https://api.todofor.ai"
DEFAULT_API_URL = "http://localhost:4000"

# Set appearance mode and default color theme
ctk.set_appearance_mode("System")  # Modes: "System" (standard), "Dark", "Light"
ctk.set_default_color_theme("blue")  # Themes: "blue" (standard), "green", "dark-blue"

class CustomMessageBox:
    def __init__(self, master, title, message, icon="info"):
        self.master = master
        self.dialog = ctk.CTkToplevel(master)
        self.dialog.title(title)
        self.dialog.geometry("600x500")
        self.dialog.transient(master)
        
        # Create content
        frame = ctk.CTkFrame(self.dialog, corner_radius=0)
        frame.pack(fill="both", expand=True, padx=0, pady=0)
        
        # Icon and title
        if icon == "error":
            title_color = "#FF5555"  # Red for error
        else:
            title_color = None  # Default color
            
        ctk.CTkLabel(
            frame, 
            text=title, 
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color=title_color
        ).pack(pady=(20, 15))
        
        # Message
        message_label = ctk.CTkLabel(
            frame, 
            text=message,
        )
        message_label.pack(pady=(0, 20), padx=20, fill="both", expand=True)
        
        # OK button
        ok_button = ctk.CTkButton(
            frame, 
            text="OK", 
            command=self.dialog.destroy,
            width=100,
            corner_radius=8
        )
        ok_button.pack(pady=(0, 10))
        
        # Wait for the dialog to be visible before grabbing focus
        self.dialog.update_idletasks()
        
        # Schedule grab_set after the window is visible
        self.dialog.after(100, self._set_grab)
        
        # Print error to console as well
        if icon == "error":
            print(f"ERROR: {title} - {message}")
    
    def _set_grab(self):
        try:
            # Make dialog modal
            self.dialog.focus_set()
            self.dialog.grab_set()
        except Exception as e:
            print(f"Warning: Could not set dialog grab: {e}")

class AuthWindow:
    def __init__(self, root):
        self.root = root
        self.root.title("TodoForAI Edge - Login")
        self.root.geometry("400x600")
        self.create_widgets()
        
        # Pre-fill from environment variables if available
        if os.environ.get("TODO4AI_EMAIL"):
            self.email_entry.insert(0, os.environ.get("TODO4AI_EMAIL"))
        if os.environ.get("TODO4AI_API_KEY"):
            self.apikey_entry.insert(0, os.environ.get("TODO4AI_API_KEY"))
            
        # Hardwired password for testing
        self.password_entry.insert(0, "Test123")
    
    def create_widgets(self):
        # Main frame - set fg_color to "transparent" to match parent background
        main_frame = ctk.CTkFrame(self.root, fg_color="transparent", corner_radius=15)
        main_frame.pack(fill="both", expand=True, padx=40, pady=40)
        
        label = ctk.CTkLabel(
            main_frame,
            text="Connect your PC\n to TodoForAI",
            font=ctk.CTkFont(size=16, weight="bold"),
            wraplength=300
        )
        label.pack(pady=(20, 20))
        
        # Email login section
        ctk.CTkLabel(main_frame, text="Login with Email", font=ctk.CTkFont(size=16, weight="bold")).pack(anchor="w", pady=(10, 5))
        self.email_entry = ctk.CTkEntry(main_frame, width=260, placeholder_text="Enter your email", corner_radius=16,
                                       border_width=1, border_color="#555555")
        self.email_entry.pack(fill="x", pady=(0, 10))
        
        ctk.CTkLabel(main_frame, text="Password").pack(anchor="w")
        self.password_entry = ctk.CTkEntry(main_frame, width=260, show="•", placeholder_text="Enter your password", 
                                          corner_radius=16, border_width=1, border_color="#555555")
        self.password_entry.pack(fill="x", pady=(0, 10))
        
        self.login_button = ctk.CTkButton(main_frame, text="Login", command=self.login, height=40, corner_radius=8)
        self.login_button.pack(pady=10)
        
        # Separator
        separator = ctk.CTkFrame(main_frame, height=2)
        separator.pack(fill="x", pady=15)
        
        # API Key section
        ctk.CTkLabel(main_frame, text="Connect with API Key", font=ctk.CTkFont(size=16, weight="bold")).pack(anchor="w", pady=(10, 5))
        self.apikey_entry = ctk.CTkEntry(main_frame, width=260, placeholder_text="Enter your API key", 
                                        corner_radius=16, border_width=1, border_color="#555555")
        self.apikey_entry.pack(fill="x", pady=(0, 10))
        
        self.connect_button = ctk.CTkButton(main_frame, text="Connect", command=self.connect_with_key, height=40, corner_radius=8)
        self.connect_button.pack(pady=10)
        
    
    def show_error(self, title, message):
        CustomMessageBox(self.root, title, message, icon="error")
    
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
            api_key = authenticate_and_get_api_key(email, password, DEFAULT_API_URL)
            self.root.after(0, lambda: self._auth_success(api_key))
        except Exception as exc:
            error_message = str(exc)
            self.root.after(0, lambda: self._auth_failed(error_message))
    
    def _auth_success(self, api_key):
        self.login_button.configure(state="normal", text="Login")
        self.root.destroy()
        self.open_client_window(api_key)
    
    def _auth_failed(self, error):
        self.login_button.configure(state="normal", text="Login")
        self.show_error("Authentication Error", error)
    
    def connect_with_key(self):
        api_key = self.apikey_entry.get()
        
        if not api_key:
            self.show_error("Error", "API Key is required")
            return
        
        self.root.destroy()
        self.open_client_window(api_key)
    
    def open_client_window(self, api_key):
        client_root = ctk.CTk()
        ClientWindow(client_root, api_key, DEFAULT_API_URL)
        client_root.mainloop()


class ClientWindow:
    def __init__(self, root, api_key, api_url):
        self.root = root
        self.api_key = api_key
        self.api_url = api_url
        self.client_running = False
        self.client_thread = None
        
        self.root.title("TodoForAI Edge - Client")
        self.root.geometry("700x500")
        self.create_widgets()
        
        # Log initial information
        self.log_message(f"TodoForAI Edge Client initialized")
        self.log_message(f"API URL: {api_url}")
        self.log_message(f"API Key: {api_key[:5]}...{api_key[-5:] if len(api_key) > 10 else ''}")
        self.log_message("Click 'Start Client' to connect to the server")
    
    def create_widgets(self):
        # Main frame
        main_frame = ctk.CTkFrame(self.root, corner_radius=15)
        main_frame.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Header - centered title with status on right
        header_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        header_frame.pack(fill="x", pady=(0, 10))
        
        # Title in center
        title_frame = ctk.CTkFrame(header_frame, fg_color="transparent")
        title_frame.pack(fill="x")
        ctk.CTkLabel(title_frame, text="TodoForAI Edge", font=ctk.CTkFont(size=24, weight="bold"), 
                    anchor="center").pack(pady=(0, 10))
        
        # Status on right
        status_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        status_frame.pack(fill="x", pady=(0, 10))
        
        ctk.CTkLabel(status_frame, text="Status:", anchor="e").pack(side="left", padx=(0, 5))
        self.connection_status = ctk.CTkLabel(status_frame, text="Disconnected", text_color="red")
        self.connection_status.pack(side="left")
        
        # Log area with centered header
        log_frame = ctk.CTkFrame(main_frame, corner_radius=12)
        log_frame.pack(fill="both", expand=True, pady=10)
        
        ctk.CTkLabel(log_frame, text="Client Log", font=ctk.CTkFont(weight="bold"), 
                    anchor="center").pack(pady=5)
        
        # Create textbox with lighter border
        self.log_area = ctk.CTkTextbox(
            log_frame, 
            height=300, 
            font=ctk.CTkFont(family="Courier", size=12), 
            corner_radius=10,
            border_width=1,
            border_color="#CCCCCC"  # Light gray border color
        )
        self.log_area.pack(fill="both", expand=True, padx=10, pady=5)
        
        # Control buttons - centered
        button_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        button_frame.pack(fill="x", pady=10)
        
        # Center the buttons
        button_center_frame = ctk.CTkFrame(button_frame, fg_color="transparent")
        button_center_frame.pack(anchor="center")
        
        self.start_button = ctk.CTkButton(button_center_frame, text="Start Client", command=self.start_client, 
                                         width=150, height=40, corner_radius=10)
        self.start_button.pack(side="left", padx=5)
        
        self.stop_button = ctk.CTkButton(button_center_frame, text="Stop Client", command=self.stop_client, 
                                        state="disabled", width=150, height=40, corner_radius=10)
        self.stop_button.pack(side="left", padx=5)
        
        # Status bar - centered
        self.status_label = ctk.CTkLabel(main_frame, text="Ready", anchor="center")
        self.status_label.pack(pady=10)
    
    def log_message(self, message):
        self.log_area.insert("end", f"{message}\n")
        self.log_area.see("end")
    
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
            self.connection_status.configure(text="Disconnected", text_color="red")
            self.log_message("Client stopped")
    
    def run_client(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Create and start client
            client = TODOforAIEdge(api_url=self.api_url, api_key=self.api_key, debug=True)
            
            # Update UI
            self.root.after(0, self.client_connected)
            
            # Run the client
            loop.run_until_complete(client.start())
        except Exception as e:
            self.root.after(0, lambda: self.client_error(str(e)))
    
    def client_connected(self):
        self.log_message("Client connected")
        self.status_label.configure(text="Client running")
        self.connection_status.configure(text="Connected", text_color="green")
    
    def client_error(self, error_msg):
        self.log_message(f"Error: {error_msg}")
        self.status_label.configure(text="Client error")
        self.connection_status.configure(text="Error", text_color="red")
        self.start_button.configure(state="normal")
        self.stop_button.configure(state="disabled")
        self.client_running = False


def run_ui():
    try:
        root = ctk.CTk()
        auth_window = AuthWindow(root)
        root.mainloop()
    except Exception as e:
        print(f"Error starting UI: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_ui()

