import logging
import requests

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("todoforai-auth")


def authenticate_and_get_api_key(email, password, api_url):
    """Authenticate with the server and get an API key"""
    # Login only, no registration
    login_url = f"{api_url}/token/v1/auth/login"
    logger.info(f"Attempting to login at: {login_url}")
    response = requests.post(login_url, json={"email": email, "password": password}, timeout=30)
    
    if response.status_code != 200:
        error_msg = f"Login failed: {response.text}"
        registration_msg = "Please register or check your account at https://todofor.ai"
        raise Exception(f"{error_msg}\n{registration_msg}")
        
    data = response.json()
    # print(f"Login response: {data}")
    token = data.get("token")
    logger.info("Successfully authenticated, received token")
    
    # Get or create API key
    headers = {"Authorization": f"Bearer {token}"}
    api_key_name = "python-client"
    
    # Try to get existing API key
    get_key_url = f"{api_url}/token/v1/users/apikeys/{api_key_name}"
    logger.info(f"Checking for existing API key at: {get_key_url}")
    response = requests.get(get_key_url, headers=headers, timeout=30)
    
    if response.status_code == 404:
        # Create new API key
        create_key_url = f"{api_url}/token/v1/users/apikeys"
        logger.info(f"Creating new API key at: {create_key_url}")
        response2 = requests.post(create_key_url, headers=headers, json={"name": api_key_name}, timeout=30)
        
        if response2.status_code != 200:
            raise Exception(f"Failed to create API key: {response2.text}")
            
        data = response2.json()
        api_key = data.get("id")
        if not api_key:
            raise ValueError(f"Server returned invalid API key response: {data}")
            
        logger.info(f"Created new API key (first 8 chars): {api_key[:8] if api_key else 'None'}...")
        return api_key
    else:
        if response.status_code != 200:
            raise Exception(f"Failed to get API key: {response.text}")
            
        data = response.json()
        api_key = data.get("id")
            
        logger.info(f"Retrieved existing API key (first 8 chars): {api_key[:8] if api_key else 'None'}...")
        
        return api_key

