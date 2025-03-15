#!/usr/bin/env python3
import os
import sys
import asyncio
import argparse
import traceback  # Add this import for stacktrace functionality

# Change from relative to absolute import
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from todoforai_edge.client import TODOforAIEdge
from todoforai_edge.apikey import authenticate_and_get_api_key
from todoforai_edge.protocol_handler import register_protocol_handler, handle_protocol_url

def parse_args():
    parser = argparse.ArgumentParser(description="Todo4AI Python Client")
    parser.add_argument("--url", default=os.environ.get("TODO4AI_API_URL", "http://localhost:4000"),
                        help="API URL (default: http://localhost:4000)")
    parser.add_argument("--email", default=os.environ.get("TODO4AI_EMAIL", ""),
                        help="Email for authentication")
    parser.add_argument("--password", default=os.environ.get("TODO4AI_PASSWORD", ""),
                        help="Password for authentication")
    parser.add_argument("--apikey", default=os.environ.get("TODO4AI_API_KEY", ""),
                        help="API key (if already authenticated)")
    parser.add_argument("--debug", action="store_true", default=True, help="Enable debug logging")
    parser.add_argument("--register-protocol", action="store_true", help="Register as protocol handler")
    parser.add_argument("protocol_url", nargs="?", help="Protocol URL to handle (todoforai://...)")
    return parser.parse_args()

async def async_main(args):
    try:
        # Handle protocol registration if requested
        if args.register_protocol:
            register_protocol_handler()
            return
            
        # Handle protocol URL if provided
        if args.protocol_url and args.protocol_url.startswith("todoforai://"):
            handle_protocol_url(args.protocol_url)
            return
        
        api_key = args.apikey
        
        # If no API key provided, authenticate to get one
        if not api_key:
            if not args.email or not args.password:
                print("Error: Email and password are required if no API key is provided")
                print("Please provide credentials with --email and --password or set TODO4AI_EMAIL and TODO4AI_PASSWORD environment variables")
                sys.exit(1)
                
            print(args.email, args.password)
            # Use the authenticate_and_get_api_key function from apikey.py
            api_key = authenticate_and_get_api_key(args.email, args.password, args.url)
            print(f"Successfully authenticated as {args.email}")
            print(f"API Key: {api_key}")
        else:
            print(f"Using provided API key: {api_key[:10]}...")
        
        # Create and start client
        client = TODOforAIEdge(api_url=args.url, api_key=api_key, debug=args.debug)
        await client.start()
    except Exception as e:
        stack_trace = traceback.format_exc()
        print(f"Error: {str(e)}\nStacktrace:\n{stack_trace}")
        if "Login failed" in str(e):
            print("\nPlease register or check your account at https://todofor.ai")
        sys.exit(1)

def main():
    args = parse_args()
    asyncio.run(async_main(args))

if __name__ == "__main__":
    main()
