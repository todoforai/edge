# Architecture Overview

## Python Edge Architecture

### Entry Point Flow

```
run_edge.py
    └── app.py::main()
        └── app.py::run_app()
            ├── Load configuration (arg_parser.py, config.py)
            ├── Setup logging
            ├── Create TODOforAIEdge instance
            ├── Validate API key
            └── edge.start() - Main event loop
```

### Core Class: TODOforAIEdge

Location: `/edge/todoforai_edge/edge.py`

```python
class TODOforAIEdge:
    def __init__(self, config, debug=False):
        self.config = config
        self.api_url = config.api_url
        self.api_key = config.api_key
        self.ws_url = get_ws_url(self.api_url)
        self.edge_config = EdgeConfig()
        self.mcp_collector = MCPCollector(self.edge_config)

    async def start(self):
        # Main reconnection loop (max 10 attempts)
        # Calls connect() which establishes WebSocket

    async def connect(self):
        # WebSocket connection with SSL handling
        # Message processing loop

    async def _handle_message(self, message):
        # Routes messages to appropriate handlers
```

### Neutralino.js Equivalent

```typescript
// src/Edge.ts
class Edge {
    private config: EdgeConfig;
    private wsClient: WebSocketClient;
    private mcpCollector: MCPCollector;
    private messageRouter: MessageRouter;

    constructor(config: Config) {
        this.config = new EdgeConfig();
        this.wsClient = new WebSocketClient(config.wsUrl, config.apiKey);
        this.mcpCollector = new MCPCollector(this.config);
        this.messageRouter = new MessageRouter(this);
    }

    async start(): Promise<void> {
        await this.wsClient.connect();
        this.wsClient.onMessage((msg) => this.messageRouter.route(msg));
    }
}
```

## Module Mapping

### Python to Neutralino.js

| Python Module | Purpose | Neutralino Equivalent |
|---------------|---------|----------------------|
| `edge.py` | Core edge logic | `Edge.ts` |
| `config.py` | App configuration | `Config.ts` |
| `edge_config.py` | Runtime config | `EdgeConfig.ts` |
| `handlers/handlers.py` | Request handlers | `handlers/*.ts` |
| `handlers/shell_handler.py` | Shell execution | `ShellHandler.ts` |
| `handlers/file_sync.py` | File watching | `FileSyncManager.ts` |
| `mcp_collector.py` | MCP management | `MCPCollector.ts` |
| `observable.py` | Reactive pattern | `Observable.ts` |
| `constants/constants.py` | Message types | `types/protocol.ts` |
| `constants/messages.py` | Message builders | `messages.ts` |
| `utils.py` | Utilities | `utils.ts` |

## Communication Flow

### Python

```
WebSocket Message
    ↓
edge._handle_message()
    ↓
Match message type
    ↓
asyncio.create_task(handler(payload, self))
    ↓
Handler executes
    ↓
self.send_response(result)
```

### Neutralino.js

```
WebSocket Message
    ↓
wsClient.onMessage callback
    ↓
messageRouter.route(message)
    ↓
Match message type
    ↓
await handler(payload, edge)
    ↓
edge.sendResponse(result)
```

## Dependency Comparison

### Python Dependencies

```
websockets>=15              → Native WebSocket API
requests>=2.25.0           → Neutralino.os.execCommand('curl') or fetch
python-dotenv>=0.19.0      → Neutralino.storage or JSON config
watchdog>=4.0.0            → Neutralino.filesystem.createWatcher
fastmcp>=2.12.1            → @modelcontextprotocol/sdk + custom transport
watchfiles                 → Neutralino.filesystem.createWatcher
aiofiles                   → Neutralino.filesystem (async by default)
aiohttp>=3.8.0            → fetch API
```

### Neutralino.js Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^latest"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

Note: Most functionality comes from Neutralino's native APIs, not npm packages.

## State Management

### Python Observable Pattern

```python
# observable.py
class Observable:
    def subscribe(self, callback): ...
    def subscribe_async(self, callback): ...
    def update_value(self, value): ...

# Usage in edge_config.py
self.config = ObservableDictionary(initial_data)
self.config.subscribe_async(self._on_change)
```

### Neutralino.js Equivalent

```typescript
// Observable.ts
class Observable<T> {
    private value: T;
    private subscribers: Set<(value: T) => void> = new Set();

    subscribe(callback: (value: T) => void): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    setValue(newValue: T): void {
        this.value = newValue;
        this.subscribers.forEach(cb => cb(newValue));
    }

    getValue(): T {
        return this.value;
    }
}
```

## Async Patterns

### Python asyncio

```python
# Concurrent tasks
asyncio.create_task(handler1(payload))
asyncio.create_task(handler2(payload))

# Gather with error handling
results = await asyncio.gather(*tasks, return_exceptions=True)

# Sleep
await asyncio.sleep(1.0)

# Run blocking code
await loop.run_in_executor(None, blocking_function)
```

### JavaScript/TypeScript

```typescript
// Concurrent tasks
Promise.all([
    handler1(payload),
    handler2(payload)
]);

// Gather with error handling (allSettled)
const results = await Promise.allSettled([task1, task2]);

// Sleep
await new Promise(resolve => setTimeout(resolve, 1000));

// Run "blocking" code (not really blocking in JS)
// Just use async/await - JS is non-blocking by default
```

## Error Handling Patterns

### Python

```python
try:
    await self.connect()
except AuthenticationError:
    logger.error("Auth failed")
    break  # Stop reconnection
except ConnectionClosedError:
    attempt += 1
    await asyncio.sleep(delay)
```

### Neutralino.js

```typescript
try {
    await this.connect();
} catch (error) {
    if (error instanceof AuthenticationError) {
        console.error("Auth failed");
        return;  // Stop reconnection
    }
    if (error instanceof ConnectionClosedError) {
        attempt++;
        await sleep(delay);
    }
}
```

## File Structure Comparison

### Python

```
edge/
├── todoforai_edge/
│   ├── __init__.py
│   ├── app.py              # Entry point
│   ├── edge.py             # Core logic
│   ├── config.py           # Configuration
│   ├── edge_config.py      # Runtime config
│   ├── observable.py       # Reactive pattern
│   ├── utils.py            # Utilities
│   ├── mcp_collector.py    # MCP management
│   ├── edge_functions.py   # Function registry
│   ├── constants/
│   │   ├── constants.py    # Message types
│   │   ├── messages.py     # Message builders
│   │   └── workspace_handler.py
│   └── handlers/
│       ├── handlers.py     # Request handlers
│       ├── shell_handler.py
│       ├── file_sync.py
│       └── path_utils.py
└── requirements.txt
```

### Neutralino.js

```
edge-neutralino/
├── neutralino.config.json
├── package.json
├── tsconfig.json
├── resources/
│   ├── index.html
│   ├── styles.css
│   └── js/
│       └── main.js         # Compiled output
└── src/
    ├── main.ts             # Entry point
    ├── Edge.ts             # Core logic
    ├── Config.ts           # Configuration
    ├── EdgeConfig.ts       # Runtime config
    ├── Observable.ts       # Reactive pattern
    ├── utils.ts            # Utilities
    ├── MCPCollector.ts     # MCP management
    ├── EdgeFunctions.ts    # Function registry
    ├── WebSocketClient.ts  # WebSocket wrapper
    ├── MessageRouter.ts    # Message routing
    ├── types/
    │   └── protocol.ts     # Message types
    ├── messages/
    │   └── builders.ts     # Message builders
    └── handlers/
        ├── index.ts
        ├── FileHandler.ts
        ├── ShellHandler.ts
        ├── FileSyncHandler.ts
        └── FunctionHandler.ts
```

## Key Architectural Differences

### 1. Event Loop

- **Python**: Explicit `asyncio` event loop, `async/await` everywhere
- **Neutralino**: Browser event loop, `async/await` or callbacks

### 2. Process Model

- **Python**: Single process, can spawn subprocesses with full control
- **Neutralino**: Webview + native binary, subprocess control via API

### 3. File System Access

- **Python**: Direct `os`, `pathlib` access
- **Neutralino**: Via `Neutralino.filesystem` API (async)

### 4. Native Features

- **Python**: Full OS access (signals, PTY, etc.)
- **Neutralino**: Sandboxed with allowlist-based API access

### 5. Bundling

- **Python**: PyInstaller bundles interpreter + deps (~50-100MB)
- **Neutralino**: Native binary + resources (~2-3MB)
