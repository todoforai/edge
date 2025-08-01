import os
from dotenv import load_dotenv

# Try to load .env file from current directory
load_dotenv()

# Default configuration values
DEFAULT_API_URL = "https://api.todofor.ai"

def get_env_var(name):
    """Get environment variable, checking both TODOFORAI_ and TODO4AI_ prefixes"""
    return os.environ.get(f"TODOFORAI_{name}") or os.environ.get(f"TODO4AI_{name}", "")

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
        # Default to secure WebSocket for unknown formats
        return f"wss://{url}/ws/v1/edge"
    
class Config:
    """Simple configuration class for TodoForAI Edge"""
    
    def __init__(self):
        # Core settings with environment variable fallbacks
        self.api_url  = get_env_var("API_URL") or DEFAULT_API_URL
        self.debug    = get_env_var("DEBUG").lower() in ("true", "1", "yes")
        self.log_level = "INFO"
        
        # Authentication settings
        self.email    = get_env_var("EMAIL")
        self.password = get_env_var("PASSWORD")
        self.api_key  = get_env_var("API_KEY")
    
    def __repr__(self):
        """Return a detailed string representation of the config"""
        api_key_display = f"{self.api_key[:8]}..." if self.api_key else "None"
        password_display = "***" if self.password else "None"
        
        return (f"Config(api_url='{self.api_url}', email='{self.email}', "
                f"api_key='{api_key_display}', password='{password_display}', "
                f"debug={self.debug}, log_level='{self.log_level}', "
                f"add_workspace_path={getattr(self, 'add_workspace_path', None)})")
            
    def update_from_args(self, args):
        """Update configuration from parsed arguments"""
        if args.debug:
            self.debug = args.debug
            self.log_level = "DEBUG" if self.debug else "INFO"
        
        self.api_url  = args.api_url  or self.api_url
        self.email    = args.email    or self.email
        self.password = args.password or self.password
        self.api_key  = args.api_key  or self.api_key
        
        # Store the add_workspace_path from args, resolving to absolute path
        if hasattr(args, 'add_workspace_path') and args.add_workspace_path:
            import os
            self.add_workspace_path = os.path.abspath(os.path.expanduser(args.add_workspace_path))
            
def default_config():
    """Factory function to create a new config instance"""
    return Config()
