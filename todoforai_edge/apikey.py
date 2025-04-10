import requests
import logging
import sys
from .config import config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("todoforai-auth")


def authenticate_and_get_api_key(email, password):
    """Authenticate with the server and get an API key"""
    # Login only, no registration
    login_url = f"{config.api_url}/token/v1/auth/login"
    print(f"Attempting to login weweat: {login_url}")
    response = requests.post(login_url, json={"email": email, "password": password})
    
    if response.status_code != 200:
        error_msg = f"Login failed: {response.text}"
        registration_msg = "Please register or check your account at https://todofor.ai"
        raise Exception(f"{error_msg}\n{registration_msg}")
        
    data = response.json()
    print(f"Login response: {data}")
    token = data.get("token")
    print(f"Successfully authenticated, received token")
    
    # Get or create API key
    headers = {"Authorization": f"Bearer {token}"}
    api_key_name = "python-client"
    
    # Try to get existing API key
    get_key_url = f"{config.api_url}/token/v1/users/apikeys/{api_key_name}"
    print(f"Checking for existing API key at: {get_key_url}")
    response = requests.get(get_key_url, headers=headers)
    
    if response.status_code == 404:
        # Create new API key
        create_key_url = f"{config.api_url}/token/v1/users/apikeys"
        print(f"Creating new API key at: {create_key_url}")
        response = requests.post(create_key_url, headers=headers, json={"name": api_key_name})
        
        if response.status_code != 200:
            raise Exception(f"Failed to create API key: {response.text}")
            
        data = response.json()
        api_key = data.get("id")
        print(f"API Key: {api_key}")
        return api_key
    else:
        if response.status_code != 200:
            raise Exception(f"Failed to get API key: {response.text}")
            
        data = response.json()
        api_key = data.get("id")
        print(f"API Key: {api_key}")
        return api_key


