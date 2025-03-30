# TODO for AI Python Client

This is a Python client for the TODO for AI service that runs as a background task. It connects to the server, authenticates, and handles file operations and shell script execution requests.

## Features

- WebSocket connection to TODO for AI server
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
pip install todoforai-edge
```

### From Source

```bash
git clone https://github.com/todoforai/edge.git
cd edge
pip install -e .
```

## Usage

### Graphical User Interface (Default)

By default, TODO for AI Edge starts with a graphical user interface for easy authentication and monitoring:

```bash
# Simply run the client to start the UI
todoforai-edge
```

The UI provides:
- Authentication via email/password or API key
- Client status monitoring
- Start/stop controls for the client

### Command Line

For automation or headless environments, you can run the client from the command line:

```bash
# Using email/password authentication
todoforai-edge --no-ui --email your@email.com --password yourpassword

# Using an existing API key
todoforai-edge --no-ui --apikey your-api-key
```

### Environment Variables

You can also set the following environment variables:

- `TODO4AI_EMAIL` & `TODO4AI_PASSWORD`: Your email & password for default authentication
- `TODO4AI_API_KEY`: If you already have an API key, you can provide it directly

## URL Protocol Handler

TODO for AI supports a custom URL protocol that allows you to start the client directly from a web browser. This is useful for authentication and quick access to the application.
Use:

### Installation

First, register the protocol handler:

```bash
todoforai-edge --register-protocol
```

This only needs to be done once per machine.

### Usage

You can use the following URL formats:

1. Authenticate with an API key:
   ```
   todoforai://auth/apikey/YOUR_API_KEY_HERE
   ```

### Web Integration

You can add links to your website that will launch the TODO for AI client:

```html
<a href="todoforai://auth/apikey/YOUR_API_KEY_HERE">Start TODOforAI Client</a>
```

For security reasons, you might want to generate these links dynamically with user-specific API keys.

## Graphical User Interface

TODO for AI Edge includes a simple graphical user interface for authentication and monitoring the client:

```bash
# Launch the client with the UI
todoforai-edge
```

The UI provides:
- Authentication via email/password or API key
- Client status monitoring
- Start/stop controls for the client

This is especially useful for users who prefer not to use the command line.

## License

MIT
