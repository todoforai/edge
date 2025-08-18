import { isTauri, desktopApi } from '@/lib/tauri-api';
import { createLogger } from '../utils/logger';

const log = createLogger('python-service');

export interface PythonEvent {
  type: string;
  payload: any;
}

type EventCallback = (event: PythonEvent) => void;

// WebSocket client for development or alternative mode
export const wsClient = {
  ws: null as WebSocket | null,
  connected: false,
  connecting: false,
  pendingRequests: new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timeout: any;
    }
  >(),
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectTimer: null as ReturnType<typeof setTimeout> | null,
  reconnectDelay: 1000, // Start with 1 second delay
  lastUrl: 'ws://localhost:9528', // Store the last URL used

  async connect(url = 'ws://localhost:9528'): Promise<boolean> {
    if (this.connected) return true;
    if (this.connecting) {
      // Wait for existing connection attempt
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.connected) {
            clearInterval(checkInterval);
            resolve(true);
          } else if (!this.connecting) {
            clearInterval(checkInterval);
            resolve(false);
          }
        }, 100);
      });
    }

    this.connecting = true;
    this.lastUrl = url; // Store the URL for reconnection

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          log.info('Connected to WebSocket sidecar');
          this.connected = true;
          this.connecting = false;
          this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          this.reconnectDelay = 1000; // Reset reconnect delay
          resolve(true);
        };

        this.ws.onclose = (event) => {
          log.info(`Disconnected from WebSocket sidecar (code: ${event.code})`);
          this.connected = false;
          this.connecting = false;

          // Clear pending requests
          this.pendingRequests.forEach(({ reject, timeout }) => {
            clearTimeout(timeout);
            reject(new Error('WebSocket connection closed'));
          });
          this.pendingRequests.clear();

          // Attempt to reconnect unless this was a normal closure
          if (event.code !== 1000) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          log.error('WebSocket error:', error);
          this.connecting = false;
          resolve(false);
          // Error will trigger onclose, which will handle reconnection
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle JSON-RPC response
            if (data.id) {
              const pending = this.pendingRequests.get(data.id);
              if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(data.id);

                if (data.error) {
                  pending.reject(data.error);
                } else {
                  pending.resolve(data.result);
                }
              }
            }
            // Handle events
            else if (data.method === '_event') {
              // Forward the event to the Python service
              pythonService.handlePythonEvent(data.params);
            }
          } catch (error) {
            // Log the raw message (truncated if too long) to help with debugging
            const rawData =
              typeof event.data === 'string'
                ? event.data.length > 400
                  ? event.data.substring(0, 400) + '...'
                  : event.data
                : '[binary data]';
            log.error(`Error processing WebSocket message: ${error}. Raw message: ${rawData}`);

            // Log the first and last 100 characters to see if it's truncation
            if (typeof event.data === 'string' && event.data.length > 200) {
              log.error(`Message start: ${event.data.substring(0, 100)}`);
              log.error(`Message end: ${event.data.substring(event.data.length - 100)}`);
            }
          }
        };
      } catch (error) {
        log.error('Failed to connect to WebSocket sidecar:', error);
        this.connecting = false;
        resolve(false);
        this.scheduleReconnect();
      }
    });
  },

  scheduleReconnect() {
    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Check if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.warn(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }

    // Calculate delay with exponential backoff (capped at 30 seconds)
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    log.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay / 1000} seconds...`);

    this.reconnectTimer = setTimeout(async () => {
      log.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      try {
        const connected = await this.connect(this.lastUrl);
        if (connected) {
          // If reconnection successful, reinitialize the service
          await pythonService.reinitialize();
        }
      } catch (err) {
        log.error('Reconnection attempt failed:', err);
        // The onclose handler will schedule the next attempt
      }
    }, delay);
  },

  async callPython<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.connected) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Failed to connect to WebSocket sidecar');
      }
    }

    return new Promise<T>((resolve, reject) => {
      try {
        const requestId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

        // Create JSON-RPC request
        const request = {
          jsonrpc: '2.0',
          id: requestId,
          method,
          params,
        };

        // Set timeout for request
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request timed out: ${method}`));
        }, 30000);

        // Store the promise callbacks
        this.pendingRequests.set(requestId, { resolve, reject, timeout });

        // Send the request
        this.ws?.send(JSON.stringify(request));
      } catch (error) {
        reject(error);
      }
    });
  },

  disconnect() {
    // Cancel any pending reconnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close the connection if it exists
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    this.connected = false;
    this.connecting = false;
    this.reconnectAttempts = 0;
  },
};

class PythonService {
  private initialized = false;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private credentials: any = null;
  private nonverbose_types = new Set(['file_sync']);

  constructor() {}

  // This method is called by wsClient when it receives an event
  handlePythonEvent(event: any): void {
    try {
      // Log non-verbose events
      if (!this.nonverbose_types.has(event.type)) {
        log.info(`PE: ${event.type}`, event.payload);
      }

      // Notify all listeners for this event type
      if (this.eventListeners.has(event.type)) {
        // Create a copy of the listeners to avoid modification during iteration
        const listeners = new Set(this.eventListeners.get(event.type)!);
        listeners.forEach((callback) => {
          try {
            callback(event);
          } catch (error) {
            log.error(`Error in event listener for ${event.type}:`, error);
          }
        });
      }

      // Also notify wildcard listeners
      if (this.eventListeners.has('*')) {
        const wildcardListeners = new Set(this.eventListeners.get('*')!);
        wildcardListeners.forEach((callback) => {
          try {
            callback(event);
          } catch (error) {
            log.error(`Error in wildcard event listener:`, error);
          }
        });
      }
    } catch (error) {
      log.error('Error processing python event:', error, event);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (isTauri()) {
        // In Tauri mode, start the WebSocket sidecar through Rust
        await desktopApi.startWebSocketSidecar();
      }
      // Try to connect to the started websocket sidecar server
      const connected = await wsClient.connect();
      log.info('WebSocket connection result:', connected);
      
      if (!connected) {
        log.warn('Could not connect to WebSocket sidecar. Make sure it is running.');
      }

      // No need to register hooks here since they're registered automatically after login

      this.initialized = true;
      log.info('Python service initialized successfully');
    } catch (error) {
      log.error('Failed to initialize Python service:', error);
      throw error;
    }
  }

  // Method to reinitialize after reconnection
  async reinitialize(): Promise<void> {
    if (!this.initialized) {
      return this.initialize();
    }

    try {
      // If we have stored credentials, relogin (which will automatically register hooks)
      if (this.credentials) {
        await this.login(this.credentials);
      }

      log.info('Python service reinitialized after reconnection');
    } catch (error) {
      log.error('Failed to reinitialize Python service:', error);
      throw error;
    }
  }

  async callPython<T = any>(method: string, params: any = {}): Promise<T> {
    if (!this.initialized) {
      throw new Error('Python service not initialized');
    }

    try {
      return await wsClient.callPython<T>(method, params);
    } catch (error) {
      log.error(`Error calling Python function ${method}:`, error);
      throw error;
    }
  }

  async ping(message: string): Promise<any> {
    return this.callPython('ping', message);
  }

  async login(credentials: any): Promise<any> {
    // Store credentials for potential reconnection
    this.credentials = credentials;
    return this.callPython('login', credentials);
  }

  addEventListener(type: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }

    this.eventListeners.get(type)!.add(callback);

    // Return a function to remove the listener
    return () => {
      const listeners = this.eventListeners.get(type);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(type);
        }
      }
    };
  }

  // Sugar for wildcard listener
  onAny(callback: EventCallback): () => void {
    return this.addEventListener('*', callback);
  }

  // Cleanup method for component unmounting
  cleanup() {
    // If in browser mode, disconnect WebSocket
    if (!isTauri()) {
      wsClient.disconnect();
    }
  }

  // Add this method to the PythonService class
  async toggleWorkspaceSync(path: string): Promise<any> {
    return this.callPython('toggle_workspace_sync', { path });
  }

  async removeWorkspacePath(path: string): Promise<any> {
    console.log('🗑️ [PythonService] Calling remove_workspace_path with path:', path);
    const result = await this.callPython('remove_workspace_path', { path });
    console.log('🗑️ [PythonService] Result from remove_workspace_path:', result);
    return result;
  }

  // New method from patch
  async refreshMCPConfig(configPath?: string): Promise<{ status: string; message: string }> {
    return this.callPython('refresh_mcp_config', { configPath });
  }
}

// Singleton instance
const pythonService = new PythonService();
export default pythonService;
