# TODOforAI Edge - Neutralino.js Port Guide

This directory contains comprehensive documentation and reference implementations for porting the TODOforAI Edge client from Python to Neutralino.js.

## Why Neutralino.js?

| Aspect | Python (Current) | Neutralino.js (Target) |
|--------|------------------|------------------------|
| Binary Size | ~50-100MB (PyInstaller) | ~2-3MB |
| Startup Time | 2-5 seconds | <1 second |
| Memory Usage | 50-150MB | 20-50MB |
| Cross-platform | Yes (with bundling) | Yes (native) |
| Node.js Required | No | No |

## Current Architecture (Python)

```
┌─────────────────────────────────────────────────────────────┐
│                      Python Edge                             │
├─────────────────────────────────────────────────────────────┤
│  app.py (Entry) → edge.py (Core) → handlers/ (Operations)  │
│                                                              │
│  Components:                                                 │
│  ├─ WebSocket Client (websockets library)                   │
│  ├─ Shell Execution (subprocess + PTY)                      │
│  ├─ File Sync (watchfiles library)                          │
│  ├─ MCP Client (fastmcp library)                            │
│  └─ Config Management (observable pattern)                  │
└─────────────────────────────────────────────────────────────┘
```

## Target Architecture (Neutralino.js)

```
┌─────────────────────────────────────────────────────────────┐
│                    Neutralino.js Edge                        │
├─────────────────────────────────────────────────────────────┤
│  main.ts (Entry) → Edge.ts (Core) → handlers/ (Operations) │
│                                                              │
│  Components:                                                 │
│  ├─ WebSocket Client (native WebSocket API)                 │
│  ├─ Shell Execution (Neutralino.os.spawnProcess)            │
│  ├─ File Sync (Neutralino.filesystem.createWatcher)         │
│  ├─ MCP Client (@modelcontextprotocol/sdk + custom transport)│
│  └─ Config Management (reactive stores)                     │
└─────────────────────────────────────────────────────────────┘
```

## Documentation

| Document | Description |
|----------|-------------|
| [01-architecture-overview.md](docs/01-architecture-overview.md) | Detailed architecture comparison |
| [02-mcp-client-transport.md](docs/02-mcp-client-transport.md) | MCP SDK integration with Neutralino |
| [03-websocket-communication.md](docs/03-websocket-communication.md) | WebSocket layer implementation |
| [04-file-operations.md](docs/04-file-operations.md) | File system operations mapping |
| [05-shell-execution.md](docs/05-shell-execution.md) | Shell execution (with limitations) |
| [06-file-sync.md](docs/06-file-sync.md) | File watching and synchronization |
| [07-message-protocol.md](docs/07-message-protocol.md) | Complete message type reference |
| [08-config-management.md](docs/08-config-management.md) | Observable config pattern in JS |

## Reference Implementations

The `src/` directory contains TypeScript reference implementations:

```
src/
├── NeutralinoMCPTransport.ts   # MCP transport for Neutralino
├── WebSocketClient.ts          # WebSocket with reconnection
├── MessageRouter.ts            # Message type routing
├── FileOperations.ts           # File system operations
├── ShellHandler.ts             # Shell command execution
├── FileSyncManager.ts          # File watching/sync
├── ConfigManager.ts            # Observable configuration
└── types/
    └── protocol.ts             # TypeScript type definitions
```

## Feature Parity Matrix

| Feature | Python | Neutralino | Notes |
|---------|--------|------------|-------|
| WebSocket Connection | Full | Full | Native API sufficient |
| API Key Auth | Full | Full | Subprotocol support |
| File Read/Write | Full | Full | Neutralino.filesystem |
| Directory Listing | Full | Full | Neutralino.filesystem |
| MCP Tool Calls | Full | Full | Custom transport needed |
| Shell Execution | Full | Partial | No PTY support |
| Interactive Shell | Full | None | Cannot implement |
| Sudo Prompts | Full | None | No PTY for password masking |
| File Watching | Full | Partial | Simpler event model |
| Process Signals | Full | Limited | No SIGINT/SIGTERM to group |
| Config Sync | Full | Full | Observable pattern ports well |

## Known Limitations

### Cannot Be Implemented

1. **PTY (Pseudo-Terminal)** - Neutralino runs in webview, no kernel PTY access
2. **Interactive Programs** - vim, less, git interactive rebase won't work
3. **Password Prompts** - No secure password masking without PTY
4. **Process Groups** - Cannot send signals to child process trees

### Degraded Functionality

1. **Shell Execution** - Basic command execution works, but:
   - No real-time streaming for some programs
   - Interrupt may not stop child processes
   - Long-running processes may zombie

2. **File Watching** - Works but:
   - Less granular control over poll intervals
   - May miss rapid successive changes

## Getting Started

### Prerequisites

```bash
# Install Neutralino CLI
npm install -g @neutralinojs/neu

# Create new project
neu create edge-neutralino
cd edge-neutralino
```

### Project Setup

```bash
# Install MCP SDK (for types, not runtime)
npm install @modelcontextprotocol/sdk

# Install dev dependencies
npm install -D typescript @types/node
```

### Configuration

Update `neutralino.config.json`:

```json
{
  "applicationId": "com.todoforai.edge",
  "version": "1.0.0",
  "defaultMode": "window",
  "port": 0,
  "enableServer": true,
  "enableNativeAPI": true,
  "nativeAllowList": [
    "app.*",
    "os.*",
    "filesystem.*",
    "events.*",
    "storage.*",
    "debug.*",
    "clipboard.*"
  ],
  "modes": {
    "window": {
      "title": "TODOforAI Edge",
      "width": 800,
      "height": 600,
      "minWidth": 400,
      "minHeight": 300
    }
  }
}
```

## Implementation Order

Recommended order for porting:

1. **Types & Protocol** - Define all message types
2. **Config Manager** - Settings and observable pattern
3. **WebSocket Client** - Connection with auth
4. **Message Router** - Dispatch messages to handlers
5. **File Operations** - Read, write, list files
6. **MCP Transport** - Custom transport for MCP SDK
7. **Shell Handler** - Basic command execution
8. **File Sync** - Workspace file watching

## Testing

Each component should be tested independently:

```bash
# Build
neu build

# Run in development
neu run

# Package for distribution
neu build --release
```

## Contributing

When adding new features:

1. Check if Python edge has equivalent functionality
2. Document any limitations in the appropriate guide
3. Add TypeScript types to `src/types/protocol.ts`
4. Update feature parity matrix in this README

## Resources

- [Neutralino.js Documentation](https://neutralino.js.org/docs/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Python Edge Source](../edge/todoforai_edge/)
