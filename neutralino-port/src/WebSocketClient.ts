/**
 * WebSocket Client for TODOforAI Edge
 *
 * Handles WebSocket connection with authentication via subprotocol,
 * automatic reconnection, and message routing.
 */

import { Message, ConnectedEdgePayload, MessageTypes } from './types/protocol';

export interface WebSocketClientOptions {
  url: string;
  apiKey: string;
  fingerprint: string;
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
}

type MessageHandler = (data: Message) => void | Promise<void>;
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

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnecting || this.connected) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    const url = this.buildUrl();

    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket with API key as subprotocol
        // This is the authentication mechanism used by the server
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
          this.handleClose(event);
        };

        this.ws.onerror = (event) => {
          const error = new Error("WebSocket error");
          this.errorHandlers.forEach(h => h(error));

          if (this.isConnecting) {
            this.isConnecting = false;
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

  /**
   * Build the WebSocket URL with fingerprint
   */
  private buildUrl(): string {
    const { url, fingerprint } = this.options;
    // Convert http(s) to ws(s)
    const wsUrl = url.replace(/^http/, 'ws');
    return `${wsUrl}/ws/v1/edge?fingerprint=${encodeURIComponent(fingerprint)}`;
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    let message: Message;

    try {
      message = JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse WebSocket message:", data);
      return;
    }

    // Handle connection confirmation
    if (message.type === MessageTypes.CONNECTED_EDGE) {
      const payload = message.payload as ConnectedEdgePayload;
      this.edgeId = payload.edgeId;
      this.userId = payload.userId;
      console.log(`Connected as edge: ${this.edgeId}`);
    }

    // Check for authentication errors
    if (message.type === MessageTypes.ERROR) {
      const errorMsg = (message.payload as { message?: string })?.message || '';
      if (errorMsg.toLowerCase().includes('api key') ||
          errorMsg.toLowerCase().includes('authentication') ||
          errorMsg.toLowerCase().includes('unauthorized')) {
        console.error("Authentication error - stopping reconnection");
        this.shouldReconnect = false;
        this.disconnect();
        return;
      }
    }

    // Dispatch to handlers
    this.messageHandlers.forEach(handler => {
      try {
        const result = handler(message);
        if (result instanceof Promise) {
          result.catch(e => console.error("Message handler error:", e));
        }
      } catch (e) {
        console.error("Message handler error:", e);
      }
    });
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    const wasConnected = this.connected;

    this.connected = false;
    this.isConnecting = false;
    this.edgeId = null;
    this.userId = null;

    console.log(`WebSocket closed: code=${event.code} reason=${event.reason}`);

    if (wasConnected) {
      this.disconnectHandlers.forEach(h => h());
    }

    // Attempt reconnection if appropriate
    if (this.shouldReconnect && event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.options.maxReconnectAttempts) {
      console.error("Maximum reconnection attempts reached");
      return;
    }

    this.reconnectAttempt++;

    // Exponential backoff: min(baseDelay + attempt * 1000, 20000)
    const delay = Math.min(
      this.options.reconnectBaseDelay + (this.reconnectAttempt * 1000),
      20000
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}/${this.options.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.shouldReconnect && !this.connected && !this.isConnecting) {
        this.connect().catch(e => {
          console.error("Reconnection failed:", e);
        });
      }
    }, delay);
  }

  /**
   * Send a message through the WebSocket
   */
  async send(message: Message | object): Promise<void> {
    if (!this.ws || !this.connected) {
      throw new Error("WebSocket not connected");
    }

    const data = JSON.stringify(message);
    this.ws.send(data);
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.connected = false;
    this.edgeId = null;
    this.userId = null;
  }

  // ============================================================================
  // Event subscription methods
  // ============================================================================

  /**
   * Subscribe to incoming messages
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Subscribe to connection events
   */
  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  /**
   * Subscribe to disconnection events
   */
  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  /**
   * Subscribe to error events
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  // ============================================================================
  // Utility methods
  // ============================================================================

  /**
   * Get current connection state
   */
  getState(): {
    connected: boolean;
    edgeId: string | null;
    userId: string | null;
    reconnectAttempt: number;
  } {
    return {
      connected: this.connected,
      edgeId: this.edgeId,
      userId: this.userId,
      reconnectAttempt: this.reconnectAttempt
    };
  }

  /**
   * Reset reconnection counter (useful after successful operations)
   */
  resetReconnectCounter(): void {
    this.reconnectAttempt = 0;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a machine fingerprint for device identification
 */
export async function generateFingerprint(): Promise<string> {
  try {
    // Try to get system information for fingerprinting
    const memInfo = await Neutralino.computer.getMemoryInfo();

    // Combine available identifiers
    const components = [
      NL_APPID || 'todoforai-edge',
      NL_OS || 'unknown',
      memInfo.physical?.total || 0,
      // Add more stable identifiers as available
    ];

    const data = components.join('-');
    return await hashString(data);

  } catch (error) {
    console.warn('Could not generate system fingerprint, using stored/random:', error);

    // Try to load from storage
    try {
      const stored = await Neutralino.storage.getData('device_fingerprint');
      if (stored) return stored;
    } catch {
      // No stored fingerprint
    }

    // Generate and store a random fingerprint
    const randomFingerprint = crypto.randomUUID();
    try {
      await Neutralino.storage.setData('device_fingerprint', randomFingerprint);
    } catch {
      // Couldn't store, that's okay
    }

    return randomFingerprint;
  }
}

/**
 * Hash a string using SHA-256
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate an API key against the server
 */
export async function validateApiKey(
  apiUrl: string,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
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
    return {
      valid: data.valid === true,
      error: data.error
    };

  } catch (error) {
    return {
      valid: false,
      error: String(error)
    };
  }
}
