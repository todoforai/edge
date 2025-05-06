import os
from dotenv import load_dotenv

# Try to load .env file from current directory
load_dotenv()

# Default configuration values
DEFAULT_API_URL = "https://api.todofor.ai"

class Config:
    """Simple configuration class for TodoForAI Edge"""
    
    def __init__(self):
        # Core settings with environment variable fallbacks
        self.api_url = os.environ.get("TODO4AI_API_URL", DEFAULT_API_URL)
        self.debug = os.environ.get("TODO4AI_DEBUG", "").lower() in ("true", "1", "yes")
        self.log_level = "INFO"
        
        # Authentication settings
        self.email = os.environ.get("TODO4AI_EMAIL", "")
        self.password = os.environ.get("TODO4AI_PASSWORD", "")
        self.api_key = os.environ.get("TODO4AI_API_KEY", "")
        
        # Protocol handling
        self.register_protocol = False
        self.protocol_url = None
        self.no_ui = False
    
    def get_ws_url(self, api_url=None):
        """Convert HTTP URL to WebSocket URL"""
        url = api_url or self.api_url
        if url.startswith("https://"):
            return url.replace("https://", "wss://") + "/ws/v1/edge"
        else:
            return url.replace("http://", "ws://") + "/ws/v1/edge"
            
    def update_from_args(self, args):
        """Update configuration from parsed arguments"""
        if args.api_url:
            self.api_url = args.api_url
        if args.debug:
            self.debug = args.debug
            self.log_level = "DEBUG" if self.debug else "INFO"
        
        # Update authentication settings
        if args.email:
            self.email = args.email
        if args.password:
            self.password = args.password
        if args.apikey:
            self.api_key = args.apikey
            
        # Update protocol handling
        if args.register_protocol:
            self.register_protocol = True
        if args.no_ui:
            self.no_ui = True
        if args.protocol_url:
            self.protocol_url = args.protocol_url

# Create a singleton instance
config = Config()
