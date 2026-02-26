import WebSocket from "ws";
import { normalizeApiUrl } from "./config.js";

const log = (level: string, ...args: any[]) => console.log(`[frontend-ws:${level}]`, ...args);

export class FrontendWebSocket {
  private ws: WebSocket | null = null;
  private tabId = crypto.randomUUID();
  connected = false;

  private callbacks = new Map<string, (msgType: string, payload: any) => void>();
  private completionEvents = new Map<string, { resolve: (v: any) => void }>();
  private completionResults = new Map<string, any>();

  constructor(
    private apiUrl: string,
    private apiKey: string,
  ) {
    this.apiUrl = normalizeApiUrl(apiUrl);
  }

  private getWsUrl(): string {
    const url = this.apiUrl;
    let wsUrl: string;
    if (url.startsWith("https://")) wsUrl = url.replace("https://", "wss://");
    else if (url.startsWith("http://")) wsUrl = url.replace("http://", "ws://");
    else wsUrl = `wss://${url}`;
    return `${wsUrl}/ws/v1/frontend?tabId=${this.tabId}`;
  }

  async connect(): Promise<boolean> {
    if (this.connected && this.ws) return true;
    return new Promise((resolve) => {
      const wsUrl = this.getWsUrl();
      log("info", `Connecting to ${wsUrl}`);
      this.ws = new WebSocket(wsUrl, [this.apiKey], { maxPayload: 5 * 1024 * 1024 });

      this.ws.on("open", () => {
        this.connected = true;
        log("info", "Connected");
        resolve(true);
      });

      this.ws.on("message", (data) => {
        try {
          this.handleMessage(JSON.parse(data.toString()));
        } catch {}
      });

      this.ws.on("close", () => {
        this.connected = false;
      });

      this.ws.on("error", (err) => {
        log("error", "WS error:", err.message);
        this.connected = false;
        resolve(false);
      });
    });
  }

  async close() {
    this.connected = false;
    this.ws?.close();
    this.ws = null;
    this.callbacks.clear();
    this.completionEvents.clear();
    this.completionResults.clear();
  }

  private handleMessage(data: Record<string, any>) {
    const msgType = data.type || "";
    const payload = data.payload || {};
    const todoId = payload.todoId || payload.todo_id;

    if (msgType === "ServerResponse.CONNECTED_FRONTEND") return;

    if (todoId && this.callbacks.has(todoId)) {
      try { this.callbacks.get(todoId)!(msgType, payload); } catch {}
    }

    if (msgType === "todo:msg_done" && todoId) {
      this.completionResults.set(todoId, { type: msgType, payload, success: true });
      this.completionEvents.get(todoId)?.resolve(this.completionResults.get(todoId));
    }
  }

  private async subscribe(todoId: string, callback?: (msgType: string, payload: any) => void): Promise<boolean> {
    if (!this.connected && !(await this.connect())) return false;
    if (callback) this.callbacks.set(todoId, callback);

    const res = await fetch(`${this.apiUrl}/api/v1/todos/${todoId}/subscribe`, {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "x-tab-id": this.tabId, "Content-Type": "application/json" },
      body: JSON.stringify({ todoId }),
    });
    return res.ok;
  }

  /** Register (or remove) a raw message callback for a todoId without
   *  setting up completion tracking.  Useful for lightweight activity detection. */
  setCallback(todoId: string, callback?: (msgType: string, payload: any) => void): void {
    if (callback) this.callbacks.set(todoId, callback);
    else this.callbacks.delete(todoId);
  }

  async sendInterrupt(projectId: string, todoId: string): Promise<boolean> {
    if (!this.connected || !this.ws) return false;
    try {
      this.ws.send(JSON.stringify({
        type: "todo:interrupt_signal",
        payload: { projectId, todoId },
      }));
      return true;
    } catch { return false; }
  }

  async sendBlockExecute(todoId: string, messageId: string, blockId: string, edgeId: string, content: string, rootPath: string): Promise<boolean> {
    if (!this.connected || !this.ws) return false;
    try {
      this.ws.send(JSON.stringify({
        type: "block:execute",
        payload: { todoId, messageId, blockId, edgeId, content, rootPath },
      }));
      return true;
    } catch { return false; }
  }

  async sendBlockDeny(todoId: string, messageId: string, blockId: string): Promise<boolean> {
    if (!this.connected || !this.ws) return false;
    try {
      this.ws.send(JSON.stringify({
        type: "BLOCK_UPDATE",
        payload: { todoId, messageId, blockId, updates: { status: "DENIED" } },
      }));
      return true;
    } catch { return false; }
  }

  async waitForCompletion(
    todoId: string,
    callback?: (msgType: string, payload: any) => void,
    timeout = 300,
  ): Promise<any> {
    if (!(await this.subscribe(todoId, callback))) {
      throw new Error(`Failed to subscribe to todo ${todoId}`);
    }

    // If todo:msg_done arrived during subscribe (before we set up the
    // completion listener), consume the stored result immediately.
    const early = this.completionResults.get(todoId);
    if (early) {
      this.completionResults.delete(todoId);
      this.callbacks.delete(todoId);
      return early;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.completionEvents.delete(todoId);
        this.callbacks.delete(todoId);
        reject(new Error(`Timeout waiting for todo ${todoId}`));
      }, timeout * 1000);

      this.completionEvents.set(todoId, {
        resolve: (v: any) => {
          clearTimeout(timer);
          this.completionEvents.delete(todoId);
          this.completionResults.delete(todoId);
          this.callbacks.delete(todoId);
          resolve(v);
        },
      });
    });
  }
}
