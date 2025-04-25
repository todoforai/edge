#!/usr/bin/env python3
import os
import argparse
from .config import config

def parse_args():
    """
    Create parser and parse command line arguments
    
    Returns:
        argparse.Namespace: Parsed arguments
    
    Raises:
        ValueError: If API key is required but not provided
    """
    parser = argparse.ArgumentParser(description="TodoForAI Edge Client")
    
    # Authentication arguments
    parser.add_argument("--email", default=config.email, help="Email for authentication")
    parser.add_argument("--password", default=config.password, help="Password for authentication")
    parser.add_argument("--apikey", default=config.api_key, help="API key (if already authenticated)")
    
    # Configuration arguments
    parser.add_argument("--apiurl", default=config.api_url, help="API URL")
    parser.add_argument("--debug", action="store_true", default=config.debug, help="Enable debug logging")
    
    # Protocol handling
    parser.add_argument("--register-protocol", action="store_true", default=config.register_protocol,
                        help="Register as protocol handler")
    parser.add_argument("--no-ui", action="store_true", default=config.no_ui,
                        help="Run in command-line mode without UI")
    parser.add_argument("protocol_url", nargs="?", default=config.protocol_url,
                        help="Protocol URL to handle (todoforai://...)")
    
    args = parser.parse_args()
    config.update_from_args(args)
    return config