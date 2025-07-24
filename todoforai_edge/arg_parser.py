#!/usr/bin/env python3
import argparse
from .config import default_config

def create_argparse_apply_config():
    config = default_config()
    parser = argparse.ArgumentParser(description="TodoForAI Edge Client")
    
    # Authentication arguments
    parser.add_argument("--email", default=config.email, help="Email for authentication")
    parser.add_argument("--password", default=config.password, help="Password for authentication")
    parser.add_argument("--api-key", default=config.api_key, help="API key (if already authenticated)")
    
    # Configuration arguments
    parser.add_argument("--api-url", default=config.api_url, help="API URL")
    parser.add_argument("--debug", action="store_true", default=config.debug, help="Enable debug logging")
    
    args = parser.parse_args()
    config.update_from_args(args)
    print('config:', config.email, config.password, config.api_url)
    return config
