import os
from dotenv import load_dotenv
from .utils import normalize_api_url

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
    """Simple configuration class for TODOforAI Edge"""
    
    def __init__(self):
        # Core settings with environment variable fallbacks
        self.api_url  = get_env_var("API_URL") or DEFAULT_API_URL
        self.debug    = get_env_var("DEBUG").lower() in ("true", "1", "yes")
        self.log_level = "INFO"
        self.add_workspace_path = None
        
        # Authentication settings
        self.api_key  = get_env_var("API_KEY")
    
    def __repr__(self):
        """Return a detailed string representation of the config"""
        api_key_display = f"{self.api_key[:8]}..." if self.api_key else "None"
        
        return (f"Config(api_url='{self.api_url}', "
                f"api_key='{api_key_display}', "
                f"debug={self.debug}, log_level='{self.log_level}', "
                f"add_workspace_path={getattr(self, 'add_workspace_path', None)})")
            
    def update_from_args(self, args):
        """Update configuration from parsed arguments"""
        if args.debug:
            self.debug = args.debug
            self.log_level = "DEBUG" if self.debug else "INFO"
        
        self.api_url  = args.api_url  or self.api_url
        self.api_key  = args.api_key  or self.api_key
        
        # Store the add_workspace_path from args, resolving to absolute path
        if hasattr(args, 'add_workspace_path') and args.add_workspace_path:
            import os
            self.add_workspace_path = os.path.abspath(os.path.expanduser(args.add_workspace_path))

    def apply_overrides(self, overrides):
        """Apply overrides from a dict (e.g., credentials)"""
        if not overrides: return
        
        # Apply the credentials as provided
        if "apiKey" in overrides:
            self.api_key = overrides["apiKey"] or ""
        
        # Handle other fields
        if "apiUrl" in overrides:
            self.api_url = normalize_api_url(overrides.get("apiUrl")) if overrides.get("apiUrl") else self.api_url
        if "debug" in overrides:
            self.debug = bool(overrides["debug"])
            self.log_level = "DEBUG" if self.debug else "INFO"
        if "add_workspace_path" in overrides:
            self.add_workspace_path = os.path.abspath(os.path.expanduser(overrides["add_workspace_path"]))
    
    def has_same_credentials(self, credentials) -> bool:
        """Check if this config has the same credentials as another config or edge"""
        if not credentials: return False
            
        # Check if API key matches
        if self.api_key and credentials.api_key and self.api_key == credentials.api_key: return True
            
        return False


def default_config():
    """Factory function to create a new config instance"""
    return Config()