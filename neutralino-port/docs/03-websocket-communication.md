# WebSocket Communication

## Overview

The Python edge uses the `websockets` library with custom subprotocol authentication. Neutralino.js can use the native WebSocket API which supports subprotocols.

## Python Implementation

Location: `/edge/todoforai_edge/edge.py` lines 521-627

```python
async def connect(self):
    ws_url = f"{self.ws_url}/ws/v1/edge?fingerprint={self.fingerprint}"

    # API key as subprotocol (not in URL for security)
    subprotocols = [self.api_key]

    ssl_context = self._create_ssl_context()

    self.ws = await websockets.connect(
        ws_url,
        subprotocols=subprotocols,
        max_size=5 * 1024 * 1024,  # 5MB max message
        ssl=ssl_context
    )

    self.connected = True

    # Message processing loop
    async for message in self.ws:
        await self._handle_message(message)
```

## Neutralino.js Implementation

### WebSocket Client Class

```typescript
// src/WebSocketClient.ts

interface WebSocketClientOptions {
  url: string;
  apiKey: string;
  fingerprint: string;
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
}

type MessageHandler = (data: unknown) => void | Promise<void>;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Error) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketClientOptions>;
  private reconnectAttempt = 0;
  private isConnecting = false;
  private shouldReconnect = true;

  // Event handlers
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();

  // Connection state
  public connected = false;
  public edgeId: string | null = null;
  public userId: string | null = null;

  constructor(options: WebSocketClientOptions) {
    this.options = {
      maxReconnectAttempts: 10,
      reconnectBaseDelay: 4000,
      ...options
    };
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.connected) return;

    this.isConnecting = true;
    this.shouldReconnect = true;

    const url = this.buildUrl();

    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket with API key as subprotocol
        this.ws = new WebSocket(url, [this.options.apiKey]);

        this.ws.onopen = () => {
          this.connected = true;
          this.isConnecting = false;
          this.reconnectAttempt = 0;
          console.log("WebSocket connected");
          this.connectHandlers.forEach(h => h());
          resolve();
        };

        this.ws.onclose = (event) => {
          this.connected = false;
          this.isConnecting = false;
          console.log(`WebSocket closed: ${event.code} ${event.reason}`);
          this.disconnectHandlers.forEach(h => h());

          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (event) => {
          const error = new Error("WebSocket error");
          this.errorHandlers.forEach(h => h(error));

          if (this.isConnecting) {
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private buildUrl(): string {
    const { url, fingerprint } = this.options;
    const wsUrl = url.replace(/^http/, 'ws');
    return `${wsUrl}/ws/v1/edge?fingerprint=${encodeURIComponent(fingerprint)}`;
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle special messages
      if (message.type === 'connected_edge') {
        this.edgeId = message.payload?.edgeId;
        this.userId = message.payload?.userId;
        console.log(`Connected as edge: ${this.edgeId}`);
      }

      // Check for authentication errors
      if (message.type === 'error') {
        const errorMsg = message.payload?.message || '';
        if (errorMsg.includes('API key') || errorMsg.includes('authentication')) {
          console.error("Authentication error - stopping reconnection");
          this.shouldReconnect = false;
          this.disconnect();
          return;
        }
      }

      // Dispatch to handlers
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (e) {
          console.error("Message handler error:", e);
        }
      });
    } catch (e) {
      console.error("Failed to parse message:", data);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.options.maxReconnectAttempts) {
      console.error("Maximum reconnection attempts reached");
      return;
    }

    this.reconnectAttempt++;
    const delay = Math.min(
      this.options.reconnectBaseDelay + (this.reconnectAttempt * 1000),
      20000
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);

    setTimeout(() => {
      if (this.shouldReconnect && !this.connected) {
        this.connect().catch(e => {
          console.error("Reconnection failed:", e);
        });
      }
    }, delay);
  }

  async send(message: unknown): Promise<void> {
    if (!this.ws || !this.connected) {
      throw new Error("WebSocket not connected");
    }

    const data = JSON.stringify(message);
    this.ws.send(data);
  }

  disconnect(): void {
    this.shouldReconnect = false;

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.connected = false;
  }

  // Event subscription methods
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }
}
```

### Machine Fingerprint Generation

The Python edge generates a machine fingerprint for device identification:

```typescript
// src/utils/fingerprint.ts

export async function generateFingerprint(): Promise<string> {
  try {
    // Get system information
    const info = await Neutralino.computer.getMemoryInfo();
    const os = await Neutralino.os.getEnv('OS') || NL_OS;

    // Combine available identifiers
    const data = [
      NL_APPID,
      os,
      info.physical?.total || 0,
      // Add more stable identifiers if available
    ].join('-');

    // Hash the data
    return await hashString(data);
  } catch (error) {
    // Fallback: generate random ID and persist it
    const stored = await Neutralino.storage.getData('fingerprint').catch(() => null);
    if (stored) return stored;

    const newFingerprint = crypto.randomUUID();
    await Neutralino.storage.setData('fingerprint', newFingerprint);
    return newFingerprint;
  }
}

async function hashString(str: string): Promise<string> {
  // Use Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### API Key Validation

Before connecting via WebSocket, validate the API key:

```typescript
// src/utils/auth.ts

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export async function validateApiKey(apiUrl: string, apiKey: string): Promise<ValidationResult> {
  const url = `${apiUrl}/noauth/v1/users/apikeys/validate`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { valid: data.valid === true, error: data.error };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}
```

## Message Response Helper

```typescript
// src/messages/send.ts

export interface EdgeMessage {
  type: string;
  payload: Record<string, unknown>;
}

export function createEdgeResponse(type: string, payload: Record<string, unknown>): EdgeMessage {
  return { type, payload };
}

// Specific message builders
export const messages = {
  edgeStatus(edgeId: string, status: string): EdgeMessage {
    return createEdgeResponse('edge:status', { edgeId, status });
  },

  shellBlockStart(blockId: string): EdgeMessage {
    return createEdgeResponse('block:sh_msg_start', { blockId });
  },

  shellBlockMessage(blockId: string, output: string): EdgeMessage {
    return createEdgeResponse('block:sh_msg_result', { blockId, output });
  },

  shellBlockDone(blockId: string, returnCode: number): EdgeMessage {
    return createEdgeResponse('block:sh_done', { blockId, returnCode });
  },

  fileChunkResult(requestId: string, path: string, content: string, error?: string): EdgeMessage {
    return createEdgeResponse('file:chunk_result', {
      requestId,
      path,
      content,
      error
    });
  },

  functionCallResult(requestId: string, result: unknown, error?: string): EdgeMessage {
    return createEdgeResponse('FUNCTION_CALL_RESULT_AGENT', {
      requestId,
      result,
      error
    });
  }
};
```

## Complete Integration

```typescript
// src/Edge.ts
import { WebSocketClient } from "./WebSocketClient";
import { generateFingerprint } from "./utils/fingerprint";
import { validateApiKey } from "./utils/auth";
import { MessageRouter } from "./MessageRouter";

interface EdgeConfig {
  apiUrl: string;
  apiKey: string;
}

export class Edge {
  private wsClient: WebSocketClient | null = null;
  private messageRouter: MessageRouter;
  private config: EdgeConfig;

  constructor(config: EdgeConfig) {
    this.config = config;
    this.messageRouter = new MessageRouter(this);
  }

  async start(): Promise<void> {
    // Validate API key first
    const validation = await validateApiKey(this.config.apiUrl, this.config.apiKey);
    if (!validation.valid) {
      throw new Error(`Invalid API key: ${validation.error}`);
    }

    // Generate fingerprint
    const fingerprint = await generateFingerprint();

    // Create WebSocket client
    this.wsClient = new WebSocketClient({
      url: this.config.apiUrl,
      apiKey: this.config.apiKey,
      fingerprint
    });

    // Set up message handling
    this.wsClient.onMessage((msg) => this.messageRouter.route(msg));
    this.wsClient.onConnect(() => console.log("Edge connected"));
    this.wsClient.onDisconnect(() => console.log("Edge disconnected"));

    // Connect
    await this.wsClient.connect();
  }

  async sendResponse(message: EdgeMessage): Promise<void> {
    if (!this.wsClient) {
      throw new Error("Not connected");
    }
    await this.wsClient.send(message);
  }

  get edgeId(): string | null {
    return this.wsClient?.edgeId || null;
  }

  get userId(): string | null {
    return this.wsClient?.userId || null;
  }

  disconnect(): void {
    this.wsClient?.disconnect();
  }
}
```

## Comparison with Python

| Aspect | Python | Neutralino.js |
|--------|--------|---------------|
| WebSocket library | websockets | Native WebSocket API |
| Subprotocol auth | Supported | Supported |
| SSL handling | Custom context | Browser handles it |
| Max message size | 5MB configured | Browser default |
| Reconnection | Manual loop | Manual implementation |
| Async model | asyncio | Promises/async-await |

## Error Handling

```typescript
// Handle different error types
wsClient.onError((error) => {
  if (error.message.includes('authentication')) {
    // Don't reconnect on auth errors
    wsClient.disconnect();
    showAuthError();
  } else {
    // Let automatic reconnection handle it
    console.error("Connection error:", error);
  }
});

// Handle connection state changes
wsClient.onDisconnect(() => {
  // Update UI to show offline state
  updateConnectionStatus('offline');
});

wsClient.onConnect(() => {
  updateConnectionStatus('online');
});
```

## Testing

```typescript
// Test WebSocket connection
async function testConnection() {
  const client = new WebSocketClient({
    url: 'https://api.todofor.ai',
    apiKey: 'test-key',
    fingerprint: 'test-fingerprint'
  });

  client.onMessage((msg) => console.log('Received:', msg));
  client.onConnect(() => console.log('Connected!'));
  client.onError((err) => console.error('Error:', err));

  try {
    await client.connect();
    console.log('Connection successful');

    // Send a test message
    await client.send({ type: 'test', payload: {} });

    // Wait then disconnect
    setTimeout(() => client.disconnect(), 5000);
  } catch (error) {
    console.error('Connection failed:', error);
  }
}
```
