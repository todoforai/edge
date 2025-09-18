# TODOforAI Edge - Node.js Implementation

A Node.js implementation of the TODOforAI Edge service that provides local AI agent capabilities.

## Features

- ✅ **Authentication**: API key authentication
- ✅ **Configuration**: Environment variables and CLI arguments
- ✅ **Argument Parsing**: Interactive prompts for missing credentials
- 🚧 **WebSocket Server**: Real-time communication with AI agents (coming next)
- 🚧 **File Operations**: Local file system access for AI agents
- 🚧 **Shell Execution**: Execute shell commands with streaming output
- 🚧 **MCP Integration**: Model Context Protocol server management

## Installation

```bash
npm install
```

## Usage

### With API Key
```bash
node src/index.js --api-key your-api-key-here
```

### Interactive Mode
```bash
node src/index.js
# Will prompt for API key
```

### Environment Variables
Create a `.env` file:
```env
TODOFORAI_API_KEY=your-api-key
TODOFORAI_API_URL=https://api.todofor.ai
TODOFORAI_DEBUG=true
```

## CLI Options

- `--api-key <key>` - API key for authentication
- `--api-url <url>` - API URL (default: https://api.todofor.ai)
- `--debug` - Enable debug logging
- `--add-path <path>` - Add a workspace path to configuration
- `-V, --version` - Show version

## Development

```bash
# Run with auto-reload
npm run dev

# Run normally
npm start
```

## Next Steps

1. **WebSocket Server** - Implement real-time communication
2. **File Operations** - Add file reading/writing capabilities
3. **Shell Execution** - Add command execution with streaming
4. **MCP Integration** - Add Model Context Protocol support
5. **Workspace Management** - Add file watching and synchronization