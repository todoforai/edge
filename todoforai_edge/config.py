import os

# Default configuration values
DEFAULT_API_URL = "https://api.todofor.ai"

class Config:
    """Simple configuration class for TodoForAI Edge"""
    
    def __init__(self):
        # Core settings with environment variable fallbacks
        self.api_url = os.environ.get("TODO4AI_API_URL", DEFAULT_API_URL)
        self.debug = os.environ.get("TODO4AI_DEBUG", "").lower() in ("true", "1", "yes")
        self.log_level = "INFO"
    
    def get_ws_url(self, api_url=None):
        """Convert HTTP URL to WebSocket URL"""
        url = api_url or self.api_url
        if url.startswith("https://"):
            return url.replace("https://", "wss://") + "/ws/v1/edge"
        else:
            return url.replace("http://", "ws://") + "/ws/v1/edge"

# Create a singleton instance
config = Config()
