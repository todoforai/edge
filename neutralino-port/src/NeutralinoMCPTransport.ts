/**
 * Neutralino.js MCP Transport
 *
 * Custom transport implementation for the MCP SDK that uses
 * Neutralino's process spawning APIs instead of Node.js child_process.
 */

// JSON-RPC 2.0 message types (compatible with MCP SDK)
export interface JSONRPCMessage {
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

export interface TransportOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * MCP Transport using Neutralino.os.spawnProcess
 *
 * Implements the Transport interface expected by the MCP SDK Client.
 */
export class NeutralinoStdioTransport {
  private proc: { id: number; pid: number } | null = null;
  private buffer: string = "";
  private eventHandler: ((evt: CustomEvent) => void) | null = null;
  private started: boolean = false;

  // Transport callbacks (set by MCP Client)
  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  constructor(private options: TransportOptions) {}

  /**
   * Start the transport by spawning the MCP server process
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error("Transport already started");
    }

    const { command, args = [], cwd, env } = this.options;
    const fullCommand = [command, ...args].join(' ');

    try {
      // Spawn the MCP server process
      this.proc = await Neutralino.os.spawnProcess(fullCommand, {
        cwd,
        ...(env && { envs: env })
      });

      this.started = true;

      // Set up event listener for process output
      this.eventHandler = (evt: CustomEvent) => {
        this.handleProcessEvent(evt.detail);
      };
      Neutralino.events.on('spawnedProcess', this.eventHandler);

      console.log(`MCP server started: PID ${this.proc.pid}`);

    } catch (error) {
      const err = new Error(`Failed to spawn MCP server: ${error}`);
      this.onerror?.(err);
      throw err;
    }
  }

  /**
   * Handle events from the spawned process
   */
  private handleProcessEvent(detail: {
    id: number;
    action: string;
    data: string
  }): void {
    // Ignore events from other processes
    if (detail.id !== this.proc?.id) return;

    switch (detail.action) {
      case 'stdOut':
        this.handleStdout(detail.data);
        break;

      case 'stdErr':
        // MCP servers may log to stderr - not necessarily errors
        // Could forward to a debug handler or ignore
        console.debug('[MCP stderr]', detail.data);
        break;

      case 'exit':
        console.log(`MCP server exited with code: ${detail.data}`);
        this.cleanup();
        this.onclose?.();
        break;
    }
  }

  /**
   * Parse stdout data for JSON-RPC messages
   * MCP uses newline-delimited JSON
   */
  private handleStdout(data: string): void {
    this.buffer += data;

    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed) as JSONRPCMessage;

        // Validate it's a JSON-RPC message
        if (message.jsonrpc === "2.0") {
          this.onmessage?.(message);
        } else {
          console.debug('[MCP non-JSON-RPC output]', trimmed);
        }
      } catch (e) {
        // Not valid JSON - might be log output from the server
        console.debug('[MCP non-JSON output]', trimmed);
      }
    }
  }

  /**
   * Send a JSON-RPC message to the MCP server
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.proc || !this.started) {
      throw new Error("Transport not started");
    }

    const data = JSON.stringify(message) + '\n';

    try {
      await Neutralino.os.updateSpawnedProcess(this.proc.id, 'stdIn', data);
    } catch (error) {
      const err = new Error(`Failed to send MCP message: ${error}`);
      this.onerror?.(err);
      throw err;
    }
  }

  /**
   * Close the transport and terminate the MCP server
   */
  async close(): Promise<void> {
    if (this.proc) {
      try {
        // Send stdin end signal first (graceful shutdown)
        await Neutralino.os.updateSpawnedProcess(this.proc.id, 'stdInEnd');

        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 500));

        // Force terminate if still running
        await Neutralino.os.updateSpawnedProcess(this.proc.id, 'exit');
      } catch (e) {
        // Process may already be dead
        console.debug('Error closing MCP process:', e);
      }

      this.cleanup();
    }
  }

  /**
   * Clean up event handlers and state
   */
  private cleanup(): void {
    if (this.eventHandler) {
      Neutralino.events.off('spawnedProcess', this.eventHandler);
      this.eventHandler = null;
    }
    this.proc = null;
    this.started = false;
    this.buffer = "";
  }

  /**
   * Check if transport is connected
   */
  isConnected(): boolean {
    return this.started && this.proc !== null;
  }
}

/**
 * Factory function to create transport with common configurations
 */
export function createMCPTransport(config: {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}): NeutralinoStdioTransport {
  return new NeutralinoStdioTransport({
    command: config.command,
    args: config.args || [],
    env: config.env
  });
}

/**
 * Create transport for npx-based MCP servers
 */
export function createNpxMCPTransport(
  packageName: string,
  env?: Record<string, string>
): NeutralinoStdioTransport {
  return new NeutralinoStdioTransport({
    command: 'npx',
    args: ['-y', packageName],
    env
  });
}
