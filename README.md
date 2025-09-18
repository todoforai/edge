# TODO for AI Python Client

This is a Python client for the TODO for AI service that runs as a background task. It connects to the server, authenticates, and handles file operations and shell script execution requests.

## Features

- WebSocket connection to TODO for AI server
- Authentication with API key
- Automatic reconnection logic
- File system operations (directory listing)
- Shell script execution
- Heartbeat mechanism to maintain connection
- Graphical User Interface (GUI) and Command Line Interface (CLI) modes
- Custom URL protocol handler for web integration

## Installation

Recommended guide: [Connect PC](https://todofor.ai/connect-pc)

### From PyPI (Recommended)

```bash
pip install todoforai-edge-cli
```

### Download Prebuilt Executables

Download the appropriate file for your system:
- Windows: [todoforai-edge-windows-x64.msi](https://todoforai-edge.r2.cloudflarestorage.com/edge/latest/todoforai-edge-windows-x64.msi)
- macOS: [todoforai-edge-macos-arm64.dmg](https://todoforai-edge.r2.cloudflarestorage.com/edge/latest/todoforai-edge-macos-arm64.dmg) (Apple Silicon) / [todoforai-edge-macos-x64.dmg](https://todoforai-edge.r2.cloudflarestorage.com/edge/latest/todoforai-edge-macos-x64.dmg) (Intel)
- Linux: [todoforai-edge-linux-x64.AppImage](https://todoforai-edge.r2.cloudflarestorage.com/edge/latest/todoforai-edge-linux-x64.AppImage) / [todoforai-edge-linux-x64.deb](https://todoforai-edge.r2.cloudflarestorage.com/edge/latest/todoforai-edge-linux-x64.deb)

For more information, visit our [download page](https://todoforai.com/downloads).

### From Source

```bash
git clone https://github.com/todoforai/edge.git
cd edge
pip install -e .
```

### From Snap (Linux)

```bash
sudo snap install todoforai-edge
```

## Usage

### Graphical User Interface (Default)

By default, TODO for AI Edge starts with a graphical user interface for easy authentication and monitoring:

```bash
# Simply run the client to start the CLI
todoforai-edge-cli
```

The UI provides:
- Authentication via API key
- Client status monitoring
- Start/stop controls for the client

### Command Line Interface (No UI Mode)

For automation, headless environments, or server deployments:

```bash
# Using an API key
todoforai-edge-cli --no-ui --api-key your-api-key
```

### Environment Variables

You can also set the following environment variable:

- `TODO4AI_API_KEY`: Your API key for authentication

## URL Protocol Handler

TODO for AI supports a custom URL protocol (`todoforaiedge://`) that allows you to start the client directly from a web browser. This is useful for authentication and quick access to the application.

### Usage

You can use the following URL format:

```text
todoforaiedge://auth/apikey/YOUR_API_KEY_HERE
```

## Graphical User Interface

TODO for AI Edge includes a simple graphical user interface for authentication and monitoring the client:

```bash
# Launch the client with the UI
todoforai-edge
```

The UI provides:
- Authentication via API key
- Client status monitoring
- Start/stop controls for the client

This is especially useful for users who prefer not to use the command line.

## TO build

```sh
sudo apt update && sudo apt install -y \
  build-essential pkg-config libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev libssl-dev curl wget
	
cd edge_frontend
yarn tauri build
```


## Let Us Know You're Using TODOforAI!

We'd love to hear from you! If you're using TODOforAI in your projects or organization, please consider dropping us a quick note at marcellhavlik@todofor.ai. 

Hearing about your use cases helps us:
- Improve the product based on real-world usage
- Prioritize features that matter to our community
- Connect with users who might benefit from upcoming features

This is completely optional and not required by our license, but your feedback is incredibly valuable to our small team!

## License

MIT License with Notification Request - see the [LICENSE](LICENSE) file for details.
