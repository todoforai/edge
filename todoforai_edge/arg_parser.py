#!/usr/bin/env python3
import os
import argparse
from .config import config

def create_parser(description="TodoForAI Edge Client"):
    """
    Create a common argument parser for both CLI and UI applications
    
    Args:
        description: Description for the argument parser
        
    Returns:
        argparse.ArgumentParser: Configured argument parser
    """
    parser = argparse.ArgumentParser(description=description)
    
    # Authentication arguments
    parser.add_argument("--email", default=config.email,
                        help="Email for authentication")
    parser.add_argument("--password", default=config.password,
                        help="Password for authentication")
    parser.add_argument("--apikey", default=config.api_key,
                        help="API key (if already authenticated)")
    
    # Configuration arguments
    parser.add_argument("--apiurl", default=config.api_url,
                        help="API URL")
    parser.add_argument("--debug", action="store_true", default=config.debug, 
                        help="Enable debug logging")
    
    # Protocol handling
    parser.add_argument("--register-protocol", action="store_true", 
                        help="Register as protocol handler")
    parser.add_argument("--no-ui", action="store_true", 
                        help="Run in command-line mode without UI")
    parser.add_argument("protocol_url", nargs="?", 
                        help="Protocol URL to handle (todoforai://...)")
    
    return parser

def parse_args(description=None):
    """
    Parse command line arguments
    
    Args:
        description: Optional custom description
        
    Returns:
        argparse.Namespace: Parsed arguments
    """
    parser = create_parser(description=description or "TodoForAI Edge Client")
    return parser.parse_args()
