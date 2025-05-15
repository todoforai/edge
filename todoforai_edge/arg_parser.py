#!/usr/bin/env python3
import os
import argparse
from .config import config

def apply_config_from_args(_config=config):
    """
    Create parser and parse command line arguments
    
    Returns:
        argparse.Namespace: Parsed arguments
    
    Raises:
        ValueError: If API key is required but not provided
    """
    parser = argparse.ArgumentParser(description="TodoForAI Edge Client")
    
    # Authentication arguments
    parser.add_argument("--email", default=_config.email, help="Email for authentication")
    parser.add_argument("--password", default=_config.password, help="Password for authentication")
    parser.add_argument("--api-key", default=_config.api_key, help="API key (if already authenticated)")
    
    # Configuration arguments
    parser.add_argument("--api-url", default=_config.api_url, help="API URL")
    parser.add_argument("--debug", action="store_true", default=_config.debug, help="Enable debug logging")
    
    args = parser.parse_args()
    _config.update_from_args(args)
    print('config:', _config.email, _config.password, _config.api_url)
    return _config