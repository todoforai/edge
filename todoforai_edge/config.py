import os
from dotenv import load_dotenv

# Try to load .env file from current directory
load_dotenv()

# Default configuration values
DEFAULT_API_URL = "https://api.todofor.ai"

def get_ws_url(api_url=DEFAULT_API_URL):
    """Convert HTTP URL to WebSocket URL"""
    url = api_url
    if url.startswith("https://"):
        return url.replace("https://", "wss://") + "/ws/v1/edge"
    elif url.startswith("http://"):
        return url.replace("http://", "ws://") + "/ws/v1/edge"
    elif url.startswith("localhost"):
        return "ws://" + url + "/ws/v1/edge"
    else:
        raise ValueError('WHUT? url:', url)
    
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
        if args.api_key:
            self.api_key = args.api_key
            
def default_config():
    """Factory function to create a new config instance"""
    return Config()
