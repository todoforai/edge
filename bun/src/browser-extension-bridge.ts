import http from "http";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";

export const BRIDGE_HOST = process.env.TODOFORAI_BROWSER_BRIDGE_HOST || "127.0.0.1";
export const BRIDGE_PORT = parseInt(process.env.TODOFORAI_BROWSER_BRIDGE_PORT || "43127", 10);
const BRIDGE_EDGE_ID = "local-browser-bridge";
const REQUEST_TIMEOUT_MS = 30_000;

type PendingRequest = {
  ws: WebSocket;
  timeout: ReturnType<typeof setTimeout>;
};

const isOpen = (ws: WebSocket | null | undefined) => !!ws && ws.readyState === WebSocket.OPEN;

export class BrowserExtensionBridge {
  private server?: http.Server;
  private wss?: WebSocketServer;
  private extensionWs: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();

  constructor(private debug = false) {}

  get url() {
    return `ws://${BRIDGE_HOST}:${BRIDGE_PORT}`;
  }

  start() {
    if (this.server) return;

    this.server = http.createServer();
    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on("connection", (ws) => {
      ws.on("message", (raw) => this.handleMessage(ws, raw.toString()));
      ws.on("close", () => this.handleClose(ws));
      ws.on("error", () => this.handleClose(ws));
    });

    this.server.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
      console.log(`[browser-bridge] listening on ${this.url}`);
    });
  }

  stop() {
    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timeout);
      if (isOpen(pending.ws)) pending.ws.send(JSON.stringify({ type: "browser.command.result", requestId, error: "Browser bridge stopped" }));
    }
    this.pending.clear();
    this.extensionWs = null;
    this.wss?.close();
    this.server?.close();
    this.wss = undefined;
    this.server = undefined;
  }

  private handleMessage(ws: WebSocket, raw: string) {
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      if (isOpen(ws)) ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      return;
    }

    if (this.debug) console.log("[browser-bridge:recv]", data.type);

    if (data.type === "hello") {
      if (data.role === "extension") {
        this.extensionWs = ws;
        if (isOpen(ws)) ws.send(JSON.stringify({ type: "connected_edge", payload: { edgeId: BRIDGE_EDGE_ID } }));
        return;
      }
      return;
    }

    if (data.type === "browser.command") {
      if (!isOpen(this.extensionWs)) {
        if (isOpen(ws)) ws.send(JSON.stringify({ type: "browser.command.result", error: "No browser extension connected" }));
        return;
      }

      const requestId = crypto.randomUUID();
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        if (isOpen(ws)) ws.send(JSON.stringify({ type: "browser.command.result", requestId, error: `Timed out after ${REQUEST_TIMEOUT_MS}ms` }));
        try { ws.close(); } catch {}
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, { ws, timeout });
      this.extensionWs.send(JSON.stringify({ type: "browser.command.request", requestId, cmd: String(data.cmd || "") }));
      return;
    }

    if (data.type === "browser.command.result") {
      const requestId = data.requestId;
      if (!requestId || !this.pending.has(requestId)) return;
      const pending = this.pending.get(requestId)!;
      clearTimeout(pending.timeout);
      this.pending.delete(requestId);
      if (isOpen(pending.ws)) {
        pending.ws.send(JSON.stringify({
          type: "browser.command.result",
          requestId,
          result: data.result,
          error: data.error,
        }));
        try { pending.ws.close(); } catch {}
      }
    }
  }

  private handleClose(ws: WebSocket) {
    if (this.extensionWs === ws) this.extensionWs = null;
    for (const [requestId, pending] of this.pending) {
      if (pending.ws !== ws) continue;
      clearTimeout(pending.timeout);
      this.pending.delete(requestId);
    }
  }
}
