#!/usr/bin/env python3
import os
import sys
import asyncio
import argparse
from .client import Todo4AIClient, authenticate_and_get_api_key

def parse_args():
    parser = argparse.ArgumentParser(description="Todo4AI Python Client")
    parser.add_argument("--url", default=os.environ.get("TODO4AI_API_URL", "http://localhost:4000"),
                        help="API URL (default: http://localhost:4000)")
    parser.add_argument("--email", default=os.environ.get("TODO4AI_EMAIL", ""),
                        help="Email for authentication")
    parser.add_argument("--password", default=os.environ.get("TODO4AI_PASSWORD", ""),
                        help="Password for authentication")
    parser.add_argument("--api-key", default=os.environ.get("TODO4AI_API_KEY", ""),
                        help="API key (if already authenticated)")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    return parser.parse_args()

async def async_main(args):
    try:
        api_key = args.api_key
        
        # If no API key provided, authenticate to get one
        if not api_key:
            if not args.email or not args.password:
                print("Error: Email and password are required if no API key is provided")
                print("Please provide credentials with --email and --password or set TODO4AI_EMAIL and TODO4AI_PASSWORD environment variables")
                sys.exit(1)
                
            api_key = authenticate_and_get_api_key(args.email, args.password, args.url)
            print(f"Successfully authenticated as {args.email}")
        
        # Create and start client
        client = Todo4AIClient(api_url=args.url, api_key=api_key, debug=args.debug)
        await client.start()
    except Exception as e:
        print(f"Error: {str(e)}")
        if "Login failed" in str(e):
            print("\nPlease register or check your account at https://todofor.ai")
        sys.exit(1)

def main():
    args = parse_args()
    asyncio.run(async_main(args))

if __name__ == "__main__":
    main()
