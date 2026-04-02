import http from "http";
import crypto from "crypto";
import type { AddressInfo } from "net";
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

    const server = http.createServer();
    const disableOnPortConflict = (err: NodeJS.ErrnoException) => {
      if (err.code !== "EADDRINUSE" && !String(err.message || "").includes(`port ${BRIDGE_PORT} in use`)) return false;
      console.warn(`[browser-bridge] ${this.url} in use; browser tools disabled. Set TODOFORAI_BROWSER_BRIDGE_PORT to override.`);
      try { this.wss?.close(); } catch {}
      try { server.close(); } catch {}
      return true;
    };

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (!disableOnPortConflict(err)) throw err;
    });

    try {
      server.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
        this.server = server;
        this.wss = new WebSocketServer({ server });
        this.wss.on("connection", (ws) => {
          ws.on("message", (raw) => this.handleMessage(ws, raw.toString()));
          ws.on("close", () => this.handleClose(ws));
          ws.on("error", () => this.handleClose(ws));
        });
        const address = server.address() as AddressInfo | null;
        console.log(`[browser-bridge] listening on ws://${BRIDGE_HOST}:${address?.port || BRIDGE_PORT}`);
      });
    } catch (err) {
      if (!disableOnPortConflict(err as NodeJS.ErrnoException)) throw err;
    }
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
      if (data.role === "extension" || data.role === "extension-control") {
        this.extensionWs = ws;
        if (isOpen(ws)) ws.send(JSON.stringify({ type: "connected_edge", payload: { edgeId: BRIDGE_EDGE_ID } }));
        return;
      }
      return;
    }

    if (data.type === "browser.command") {
      if (!isOpen(this.extensionWs)) {
        const msg = [
          "No browser extension connected.",
          "Install the TODO for AI browser extension, open its side panel, and confirm it shows 'Connected' to this edge.",
          "Chrome/Edge: https://chromewebstore.google.com/detail/todo-for-ai/oemlbhbggllbelfemliboclfagbchcoj",
        ].join("\n");
        if (isOpen(ws)) ws.send(JSON.stringify({ type: "browser.command.result", error: msg }));
        return;
      }

      const requestId = crypto.randomUUID();
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        if (isOpen(ws)) ws.send(JSON.stringify({ type: "browser.command.result", requestId, error: `Timed out after ${REQUEST_TIMEOUT_MS}ms` }));
        try { ws.close(); } catch {}
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, { ws, timeout });
      this.extensionWs.send(JSON.stringify({ type: "browser.command.request", requestId, cmd: String(data.cmd || ""), args: data.args, ...(data.tabId !== undefined && { tabId: data.tabId }) }));
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
