# MCP Client Transport for Neutralino.js

## Overview

The Model Context Protocol (MCP) SDK provides an official TypeScript implementation, but its `StdioClientTransport` relies on Node.js `child_process`. This guide shows how to create a custom transport using Neutralino.js process APIs.

## MCP SDK Architecture

The MCP SDK uses a **Transport abstraction**:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MCP Client    │────▶│    Transport    │────▶│   MCP Server    │
│  (SDK Client)   │◀────│   (Abstract)    │◀────│ (stdio process) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

Transports implement the `Transport` interface:

```typescript
interface Transport {
  start(): Promise<void>;
  send(message: JSONRPCMessage): Promise<void>;
  close(): Promise<void>;

  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
}
```

## Neutralino.js Process API

Neutralino provides process management via `Neutralino.os`:

```typescript
// Spawn a process
const proc = await Neutralino.os.spawnProcess(command);
// Returns: { id: number, pid: number }

// Listen for process events
Neutralino.events.on('spawnedProcess', (evt) => {
    const { id, action, data } = evt.detail;
    // action: 'stdOut' | 'stdErr' | 'exit'
});

// Send stdin
await Neutralino.os.updateSpawnedProcess(procId, 'stdIn', data);

// Close stdin
await Neutralino.os.updateSpawnedProcess(procId, 'stdInEnd');

// Terminate process
await Neutralino.os.updateSpawnedProcess(procId, 'exit');
```

## Implementation: NeutralinoStdioTransport

```typescript
// src/NeutralinoMCPTransport.ts

// MCP uses JSON-RPC 2.0 messages
interface JSONRPCMessage {
  jsonrpc: "2.0";
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface TransportOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export class NeutralinoStdioTransport {
  private proc: { id: number; pid: number } | null = null;
  private buffer: string = "";
  private eventHandler: ((evt: CustomEvent) => void) | null = null;

  // Transport callbacks
  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  constructor(private options: TransportOptions) {}

  async start(): Promise<void> {
    const { command, args = [], cwd, env } = this.options;
    const fullCommand = [command, ...args].join(' ');

    try {
      this.proc = await Neutralino.os.spawnProcess(fullCommand, {
        cwd,
        ...(env && { envs: env })
      });

      // Set up event listener
      this.eventHandler = (evt: CustomEvent) => {
        this.handleProcessEvent(evt.detail);
      };
      Neutralino.events.on('spawnedProcess', this.eventHandler);

    } catch (error) {
      this.onerror?.(new Error(`Failed to spawn MCP server: ${error}`));
      throw error;
    }
  }

  private handleProcessEvent(detail: { id: number; action: string; data: string }): void {
    if (detail.id !== this.proc?.id) return;

    switch (detail.action) {
      case 'stdOut':
        this.handleStdout(detail.data);
        break;

      case 'stdErr':
        // MCP servers may log to stderr - not necessarily errors
        console.debug('[MCP stderr]', detail.data);
        break;

      case 'exit':
        this.cleanup();
        this.onclose?.();
        break;
    }
  }

  private handleStdout(data: string): void {
    // MCP protocol uses newline-delimited JSON
    this.buffer += data;

    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ""; // Keep incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed) as JSONRPCMessage;
        this.onmessage?.(message);
      } catch (e) {
        // Not valid JSON - might be log output, ignore
        console.debug('[MCP non-JSON output]', trimmed);
      }
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.proc) {
      throw new Error("Transport not started");
    }

    const data = JSON.stringify(message) + '\n';

    try {
      await Neutralino.os.updateSpawnedProcess(this.proc.id, 'stdIn', data);
    } catch (error) {
      this.onerror?.(new Error(`Failed to send MCP message: ${error}`));
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.proc) {
      try {
        await Neutralino.os.updateSpawnedProcess(this.proc.id, 'exit');
      } catch (e) {
        // Process may already be dead
      }
      this.cleanup();
    }
  }

  private cleanup(): void {
    if (this.eventHandler) {
      Neutralino.events.off('spawnedProcess', this.eventHandler);
      this.eventHandler = null;
    }
    this.proc = null;
    this.buffer = "";
  }
}
```

## Using with MCP Client

```typescript
// src/MCPCollector.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { NeutralinoStdioTransport } from "./NeutralinoMCPTransport";

interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export class MCPCollector {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, NeutralinoStdioTransport> = new Map();

  async loadServer(serverId: string, config: MCPServerConfig): Promise<void> {
    // Create transport
    const transport = new NeutralinoStdioTransport({
      command: config.command,
      args: config.args,
      env: config.env
    });

    // Create client
    const client = new Client({
      name: "todoforai-edge",
      version: "1.0.0"
    });

    // Connect
    await client.connect(transport);

    // Store references
    this.clients.set(serverId, client);
    this.transports.set(serverId, transport);
  }

  async listTools(): Promise<MCPTool[]> {
    const allTools: MCPTool[] = [];

    for (const [serverId, client] of this.clients) {
      try {
        const result = await client.listTools();
        const tools = result.tools.map(tool => ({
          name: `${serverId}_${tool.name}`,
          description: tool.description || "",
          inputSchema: tool.inputSchema || {}
        }));
        allTools.push(...tools);
      } catch (error) {
        console.error(`Failed to list tools from ${serverId}:`, error);
      }
    }

    return allTools;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    // Extract server ID from tool name (format: serverId_toolName)
    const underscoreIndex = toolName.indexOf('_');
    if (underscoreIndex === -1) {
      throw new Error(`Invalid tool name format: ${toolName}`);
    }

    const serverId = toolName.substring(0, underscoreIndex);
    const actualToolName = toolName.substring(underscoreIndex + 1);

    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    const result = await client.callTool({
      name: actualToolName,
      arguments: args
    });

    return result;
  }

  async unloadServer(serverId: string): Promise<void> {
    const transport = this.transports.get(serverId);
    if (transport) {
      await transport.close();
      this.transports.delete(serverId);
    }
    this.clients.delete(serverId);
  }

  async unloadAll(): Promise<void> {
    for (const serverId of this.clients.keys()) {
      await this.unloadServer(serverId);
    }
  }
}
```

## Loading MCP Configuration

The Python edge reads MCP configuration from a JSON file. Here's the equivalent:

```typescript
// src/mcpConfig.ts

interface MCPConfig {
  mcpServers?: Record<string, MCPServerConfig>;
  mcp?: {
    servers?: Record<string, MCPServerConfig>;
  };
}

export async function loadMCPConfig(configPath: string): Promise<Record<string, MCPServerConfig>> {
  try {
    const content = await Neutralino.filesystem.readFile(configPath);
    const config: MCPConfig = JSON.parse(content);

    // Support both formats
    return config.mcpServers || config.mcp?.servers || {};
  } catch (error) {
    console.error(`Failed to load MCP config from ${configPath}:`, error);
    return {};
  }
}

export function findMCPConfigPath(): string | null {
  // Check common locations
  const locations = [
    `${NL_PATH}/.mcp.json`,
    `${NL_PATH}/mcp.json`,
    // Add platform-specific paths
  ];

  for (const path of locations) {
    try {
      // Sync check not available, would need to try/catch read
      return path;
    } catch {
      continue;
    }
  }

  return null;
}
```

## Complete Integration Example

```typescript
// src/main.ts
import { MCPCollector } from "./MCPCollector";
import { loadMCPConfig } from "./mcpConfig";

async function initializeMCP(): Promise<MCPCollector> {
  const collector = new MCPCollector();

  // Load config
  const configPath = `${NL_PATH}/mcp.json`;
  const servers = await loadMCPConfig(configPath);

  // Load each server
  for (const [serverId, config] of Object.entries(servers)) {
    try {
      console.log(`Loading MCP server: ${serverId}`);
      await collector.loadServer(serverId, config);
      console.log(`MCP server loaded: ${serverId}`);
    } catch (error) {
      console.error(`Failed to load MCP server ${serverId}:`, error);
    }
  }

  // List all available tools
  const tools = await collector.listTools();
  console.log(`Loaded ${tools.length} MCP tools`);

  return collector;
}

// Usage
Neutralino.init();

Neutralino.events.on("ready", async () => {
  const mcp = await initializeMCP();

  // Call a tool
  const result = await mcp.callTool("gmail_send_email", {
    to: "user@example.com",
    subject: "Test",
    body: "Hello from Neutralino!"
  });

  console.log("Tool result:", result);
});
```

## Differences from Python Implementation

| Aspect | Python (fastmcp) | Neutralino |
|--------|------------------|------------|
| Transport | Built-in stdio | Custom implementation |
| Process spawn | subprocess.Popen | Neutralino.os.spawnProcess |
| Event handling | asyncio streams | Event listener pattern |
| Buffering | Handled by library | Manual newline parsing |
| Error handling | Exceptions | Callbacks + try/catch |

## Testing MCP Integration

```typescript
// Test script
async function testMCP() {
  const transport = new NeutralinoStdioTransport({
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everything"]
  });

  transport.onmessage = (msg) => console.log("Received:", msg);
  transport.onerror = (err) => console.error("Error:", err);
  transport.onclose = () => console.log("Closed");

  await transport.start();

  // Send initialize request
  await transport.send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" }
    }
  });

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // List tools
  await transport.send({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  });

  await new Promise(resolve => setTimeout(resolve, 2000));
  await transport.close();
}
```

## Limitations

1. **No stdin streaming** - Neutralino sends stdin as discrete writes, not a stream
2. **Process environment** - Limited env var control compared to Python
3. **Working directory** - Must be specified at spawn time
4. **Signal handling** - Cannot send SIGINT/SIGTERM to gracefully stop servers

## Troubleshooting

### Server doesn't start
- Check command path is correct
- Verify npx/node is in PATH
- Check Neutralino permissions in config

### No messages received
- Verify server outputs to stdout (not stderr)
- Check newline-delimited JSON format
- Add debug logging to `handleStdout`

### Connection drops
- Server may have crashed - check stderr output
- Implement reconnection logic if needed
