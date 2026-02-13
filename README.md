# TODO for AI Python Client

This is a Python client for the TODO for AI service that runs as a background task. It connects to the server, authenticates, and handles file operations and shell script execution requests.

## Desktop App

The desktop app (Tauri) lives in a separate repo: [todoforai/edge-app](https://github.com/todoforai/edge-app)

## Features

- WebSocket connection to TODO for AI server
- Authentication with API key
- Automatic reconnection logic
- File system operations (directory listing)
- Shell script execution
- Heartbeat mechanism to maintain connection
- Command Line Interface (CLI)

## Installation

Recommended guide: [Connect PC](https://todofor.ai/connect-pc)

### From PyPI (Recommended)

```bash
pip install todoforai-edge-cli
```

### Download Prebuilt Executables

For desktop app downloads (Windows, macOS, Linux), see [todoforai/edge-app](https://github.com/todoforai/edge-app).

### From Source

```bash
git clone https://github.com/todoforai/edge.git
cd edge
pip install -e .
```

## Usage

```bash
# Using an API key
todoforai-edge-cli --api-key your-api-key
```

### Environment Variables

You can also set the following environment variable:

- `TODO4AI_API_KEY`: Your API key for authentication

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes and releases.

## Development

Set up your environment variables:

```bash
export TODOFORAI_API_KEY="your-production-api-key"
export TODOFORAI_API_KEY_DEV="your-local-dev-api-key"
```

Then run:
```bash
make run          # Production
make run-test     # Local development
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
