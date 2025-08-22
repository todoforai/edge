import logging
import requests
from .colors import Colors

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("todoforai-auth")


def authenticate_and_get_api_key(email, password, api_url):
    """Authenticate with the server and get an API key"""
    # Login only, no registration
    login_url = f"{api_url}/token/v1/auth/login"
    print(f"{Colors.CYAN}🔐 Authenticating with email: {Colors.YELLOW}{Colors.BOLD}{email}{Colors.END}{Colors.CYAN} on {Colors.GREEN}{Colors.BOLD}{api_url}{Colors.END}{Colors.CYAN}...{Colors.END}")
    
    try:
        response = requests.post(login_url, json={"email": email, "password": password}, timeout=30)
    except requests.exceptions.RequestException as e:
        raise Exception(f"Connection failed: {str(e)}") from e
    
    if response.status_code != 200:
        error_msg = f"Login failed: {response.text}"
        registration_msg = "Please register or check your account at https://todofor.ai"
        raise Exception(f"{error_msg}\n{registration_msg}")
        
    data = response.json()
    token = data.get("token")
    
    # Add validation
    if not token:
        raise Exception("Server returned no authentication token")

    # Get or create API key
    headers = {"Authorization": f"Bearer {token}"}
    api_key_name = "todoforai-edge"
    
    # Try to get existing API key
    get_key_url = f"{api_url}/token/v1/users/apikeys/{api_key_name}"
    print(f"{Colors.CYAN}🔑 Retrieving API key...{Colors.END}")
    
    try:
        response = requests.get(get_key_url, headers=headers, timeout=30)
    except requests.exceptions.RequestException as e:
        raise Exception(f"Failed to retrieve API key: {str(e)}") from e
    
    if response.status_code == 404:
        # Create new API key
        create_key_url = f"{api_url}/token/v1/users/apikeys"
        print(f"{Colors.YELLOW}📝 Creating new API key...{Colors.END}")
        
        try:
            response2 = requests.post(create_key_url, headers=headers, json={"name": api_key_name}, timeout=30)
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to create API key: {str(e)}") from e
        
        if response2.status_code != 200:
            raise Exception(f"Failed to create API key: {response2.text}")
            
        data = response2.json()
        api_key = data.get("id")
        if not api_key:
            raise ValueError(f"Server returned invalid API key response: {data}")
            
        print(f"{Colors.GREEN}✅ Created new API key{Colors.END}")
        return api_key
    else:
        if response.status_code != 200:
            raise Exception(f"Failed to get API key: {response.text}")
            
        data = response.json()
        api_key = data.get("id")
            
        print(f"{Colors.GREEN}✅ Retrieved existing API key{Colors.END}")
        
        return api_key

