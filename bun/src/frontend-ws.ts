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
  private pendingBlocks = new Map<string, Set<string>>(); // todoId → active blockIds
  private lastReadyPayload = new Map<string, any>(); // todoId → last READY payload

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
      this.ws = new WebSocket(wsUrl, [this.apiKey], { maxPayload: 5 * 1024 * 1024 });

      this.ws.on("open", () => {
        this.connected = true;
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
    this.pendingBlocks.clear();
    this.lastReadyPayload.clear();
  }

  private handleMessage(data: Record<string, any>) {
    const msgType = data.type || "";
    const payload = data.payload || {};
    const todoId = payload.todoId || payload.todo_id;

    if (msgType === "ServerResponse.CONNECTED_FRONTEND") return;

    if (todoId && this.callbacks.has(todoId)) {
      try { this.callbacks.get(todoId)!(msgType, payload); } catch {}
    }

    // Track pending blocks: only real tool blocks (those needing approval) → add on AWAITING_APPROVAL, remove on terminal status
    if (msgType === "BLOCK_UPDATE" && todoId && payload.blockId && payload.updates?.status === "AWAITING_APPROVAL") {
      if (!this.pendingBlocks.has(todoId)) this.pendingBlocks.set(todoId, new Set());
      this.pendingBlocks.get(todoId)!.add(payload.blockId);
    }
    if (msgType === "BLOCK_UPDATE" && todoId && payload.blockId) {
      const status = payload.updates?.status;
      if (["COMPLETED", "DENIED", "FAILED", "ERROR"].includes(status)) {
        this.pendingBlocks.get(todoId)?.delete(payload.blockId);
        // If READY fired while this block was pending, that READY was intermediate
        // (the AI's tool-call turn). Clear it — a new RUNNING→READY cycle will follow.
        const pending = this.pendingBlocks.get(todoId);
        if (!pending || pending.size === 0) {
          this.lastReadyPayload.delete(todoId);
        }
      }
    }

    if (msgType === "todo:status" && todoId) {
      const status = payload.status;
      if (status === "RUNNING") {
        this.lastReadyPayload.delete(todoId);
      } else if (status === "READY" || status === "READY_CHECKED") {
        const pending = this.pendingBlocks.get(todoId);
        if (!pending || pending.size === 0) {
          this.completionResults.set(todoId, { type: msgType, payload, success: true });
          this.completionEvents.get(todoId)?.resolve(this.completionResults.get(todoId));
        } else {
          // Blocks still pending — remember this READY for when they complete
          this.lastReadyPayload.set(todoId, payload);
        }
      } else if (["DONE", "CANCELLED", "CANCELLED_CHECKED", "ERROR", "ERROR_CHECKED"].includes(status)) {
        const success = status === "DONE";
        this.completionResults.set(todoId, { type: msgType, payload, success });
        this.completionEvents.get(todoId)?.resolve(this.completionResults.get(todoId));
      }
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

    return new Promise((resolve) => {
      this.completionEvents.set(todoId, {
        resolve: (v: any) => {
          this.completionEvents.delete(todoId);
          this.completionResults.delete(todoId);
          this.callbacks.delete(todoId);
          resolve(v);
        },
      });
    });
  }
}
