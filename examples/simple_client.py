#!/usr/bin/env python3
import asyncio
import os
import sys

from todoforai_edge import TODOforAIEdge, Config
from todoforai_edge.arg_parser import apply_config_from_args


async def main():
    config = Config()
    config = apply_config_from_args(_config=config)
    
    # Create the client
    client = TODOforAIEdge(config)
    
    # Authenticate if needed
    if not client.api_key and (client.email and client.password):
        print(f"Authenticating with email: {client.email}")
        auth_success = await client.authenticate()
        if not auth_success:
            print("Authentication failed. Exiting.")
            return 1
        print(f"Successfully authenticated. API Key: {client.api_key[:10]}...")
    
    # Start the client
    print("Starting client...")
    await client.start()
    
    return 0


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\nClient stopped by user")
        sys.exit(0)