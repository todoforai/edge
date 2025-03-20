#!/usr/bin/env python3
import os
import sys
import asyncio
import argparse
import traceback
import time  # Add this for the pause functionality

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
    parser.add_argument("--stay-open", action="store_true", help="Keep console window open after errors (for double-click)")
    parser.add_argument("protocol_url", nargs="?", help="Protocol URL to handle (todoforai://...)")
    return parser.parse_args()

async def async_main(args):
    try:
        # Auto-register protocol handler on first run
        if not args.register_protocol and not os.environ.get("TODO4AI_PROTOCOL_REGISTERED"):
            print("First run detected. Registering protocol handler...")
            register_protocol_handler()
            os.environ["TODO4AI_PROTOCOL_REGISTERED"] = "1"
            
        # Handle protocol registration if requested
        if args.register_protocol:
            register_protocol_handler()
            print("Protocol handler registered successfully!")
            if args.stay_open:
                input("Press Enter to exit...")
            return
            
        # Handle protocol URL if provided
        if args.protocol_url and args.protocol_url.startswith("todoforai://"):
            handle_protocol_url(args.protocol_url)
            if args.stay_open:
                input("Press Enter to exit...")
            return
        
        api_key = args.apikey
        
        # If no API key provided, authenticate to get one
        if not api_key:
            if not args.email or not args.password:
                print("Error: Email and password are required if no API key is provided")
                print("Please provide credentials with --email and --password or set TODO4AI_EMAIL and TODO4AI_PASSWORD environment variables")
                if args.stay_open:
                    input("Press Enter to exit...")
                sys.exit(1)
                
            print(f"Authenticating with email: {args.email}")
            # Use the authenticate_and_get_api_key function from apikey.py
            api_key = authenticate_and_get_api_key(args.email, args.password, args.url)
            print(f"Successfully authenticated as {args.email}")
            print(f"API Key: {api_key}")
        else:
            print(f"Using provided API key: {api_key[:10]}...")
        
        # Create and start client
        print("Starting Todo4AI client. Press Ctrl+C to exit.")
        client = TODOforAIEdge(api_url=args.url, api_key=api_key, debug=args.debug)
        await client.start()
    except Exception as e:
        stack_trace = traceback.format_exc()
        print(f"Error: {str(e)}\nStacktrace:\n{stack_trace}")
        if "Login failed" in str(e):
            print("\nPlease register or check your account at https://todofor.ai")
        
        # Keep console window open if launched via double-click
        if args.stay_open:
            input("\nPress Enter to exit...")
        sys.exit(1)

def main():
    # Detect if the script is being run by double-clicking
    # In that case, we should keep the console window open
    is_double_click = len(sys.argv) == 1 and not sys.stdin.isatty()
    
    if is_double_click:
        print("Todo4AI Client started via double-click")
        sys.argv.append("--stay-open")
    
    args = parse_args()
    
    # If no arguments provided and it's not a double-click, show interactive prompt
    if len(sys.argv) == 1 and not is_double_click:
        print("Todo4AI Client - Interactive Mode")
        print("--------------------------------")
        
        # Ask for credentials if not provided
        if not args.apikey and (not args.email or not args.password):
            args.email = input("Email: ")
            args.password = input("Password: ")
        
    try:
        asyncio.run(async_main(args))
    except KeyboardInterrupt:
        print("\nTodo4AI Client stopped by user")
    except Exception as e:
        print(f"Fatal error: {str(e)}")
        if args.stay_open or is_double_click:
            input("\nPress Enter to exit...")

if __name__ == "__main__":
    main()
