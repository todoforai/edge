# Todo4AI Python Client

This is a Python client for the Todo4AI service that runs as a background task. It connects to the server, authenticates, and handles file operations and shell script execution requests.

## Features

- WebSocket connection to Todo4AI server
- Authentication with email/password
- Automatic reconnection logic
- File system operations (directory listing)
- Shell script execution
- Heartbeat mechanism to maintain connection

## Installation

### Download Prebuilt Executables (Recommended)

Download the appropriate file for your system:
- Windows: [todoforai-edge.exe](https://todoforai-edge.r2.cloudflarestorage.com/edge/latest/todoforai-edge.exe)
- macOS: [todoforai-edge-mac](https://todoforai-edge.r2.cloudflarestorage.com/edge/latest/todoforai-edge-mac)
- Linux: [todoforai-edge-linux](https://todoforai-edge.r2.cloudflarestorage.com/edge/latest/todoforai-edge-linux)

For more information, visit our [download page](https://todoforai.com/downloads).

### From PyPI

```bash
pip install todo4ai-client
```

### From Source

```bash
git clone https://github.com/todo4ai/todo4ai-client.git
cd todo4ai-client/python
pip install -e .
```

## Usage

### Graphical User Interface (Default)

By default, Todo4AI Edge starts with a graphical user interface for easy authentication and monitoring:

```bash
# Simply run the client to start the UI
todo4ai-client
```

The UI provides:
- Authentication via email/password or API key
- Client status monitoring
- Start/stop controls for the client

### Command Line

For automation or headless environments, you can run the client from the command line:

```bash
# Using email/password authentication
todo4ai-client --no-ui --email your@email.com --password yourpassword

# Using an existing API key
todo4ai-client --no-ui --apikey your-api-key

# Additional options
todo4ai-client --no-ui --url https://api.todofor.ai --debug
```

### As a Library

```python
import asyncio
from todo4ai_client import TODOforAIEdge, authenticate_and_get_api_key

async def main():
    # Get API key through authentication
    api_key = authenticate_and_get_api_key("your@email.com", "yourpassword")
    
    # Or use an existing API key
    # api_key = "your-api-key"
    
    # Create client
    client = TODOforAIEdge(api_key=api_key)
    
    # Start client (this will run until interrupted)
    await client.start()

if __name__ == "__main__":
    asyncio.run(main())
```

### Environment Variables

You can also set the following environment variables:

- `TODO4AI_API_URL`: The URL of the Todo4AI API server
- `TODO4AI_EMAIL`: Your email for authentication
- `TODO4AI_PASSWORD`: Your password for authentication
- `TODO4AI_API_KEY`: If you already have an API key, you can provide it directly

## Running as a Background Service

### Systemd (Linux)

Create a systemd service file at `/etc/systemd/system/todo4ai-client.service`:

```ini
[Unit]
Description=Todo4AI Python Client
After=network.target

[Service]
Type=simple
User=yourusername
ExecStart=/usr/bin/todo4ai-client --api-key your-api-key
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then enable and start the service:

```bash
sudo systemctl enable todo4ai-client
sudo systemctl start todo4ai-client
```

### Launchd (macOS)

Create a plist file at `~/Library/LaunchAgents/ai.todofor.client.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.todofor.client</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/todo4ai-client</string>
        <string>--api-key</string>
        <string>your-api-key</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

Then load the service:

```bash
launchctl load ~/Library/LaunchAgents/ai.todofor.client.plist
```

### Windows Service

You can use NSSM (Non-Sucking Service Manager) to create a Windows service:

```bash
nssm install TODOforAIEdge "C:\path\to\python.exe" "-m todo4ai_client --api-key your-api-key"
nssm start TODOforAIEdge
```

## Development

### Setup Development Environment

```bash
git clone https://github.com/todo4ai/todo4ai-client.git
cd todo4ai-client/python
pip install -e ".[dev]"
```

### Running Tests

```bash
pytest
```

## URL Protocol Handler

Todo4AI supports a custom URL protocol that allows you to start the client directly from a web browser. This is useful for authentication and quick access to the application.

### Installation

First, register the protocol handler:

```bash
todo4ai-client --register-protocol
```

This only needs to be done once per machine.

### Usage

You can use the following URL formats:

1. Authenticate with an API key:
   ```
   todoforai://auth/apikey/YOUR_API_KEY_HERE
   ```

2. Start the client with saved credentials:
   ```
   todoforai://start
   ```

3. Open a specific file:
   ```
   todoforai://open/path/to/file
   ```

### Web Integration

You can add links to your website that will launch the Todo4AI client:

```html
<a href="todoforai://auth/apikey/YOUR_API_KEY_HERE">Start Todo4AI Client</a>
```

For security reasons, you might want to generate these links dynamically with user-specific API keys.

## Graphical User Interface

Todo4AI Edge includes a simple graphical user interface for authentication and monitoring the client:

```bash
# Launch the client with the UI
todo4ai-client --ui
```

The UI provides:
- Authentication via email/password or API key
- Client status monitoring
- Start/stop controls for the client

This is especially useful for users who prefer not to use the command line.

## License

MIT
