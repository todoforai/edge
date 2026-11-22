/**
 * live_preview relay, edge side: the server forwards HTTP requests from
 * https://<session>.preview.todofor.ai; we fetch them from 127.0.0.1:<port>
 * and send the response back over the main WS (correlated by requestId).
 *
 * Only ports explicitly registered via the live_preview tool are served —
 * a leaked session URL can never browse arbitrary local ports.
 */

import { EF, type WsMessage } from "./constants.js";

// Body cap keeps the response JSON under the WS maxPayload (5MB): 3.5MB raw
// → ~4.7MB base64. Dev-server assets above this are rare (video/huge bundles).
const MAX_RESPONSE_BODY = 3.5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000; // < backend's 30s relay timeout

/** Ports registered by the live_preview tool → expiry timestamp (ms). Matches
 *  the backend session TTL so a stale registration can't outlive its sessions
 *  and expose whatever service later reuses the port. */
const PORT_TTL_MS = 24 * 60 * 60 * 1000;
const registeredPorts = new Map<number, number>();

export const allowedPreviewPorts = {
  add(port: number) { registeredPorts.set(port, Date.now() + PORT_TTL_MS); },
  has(port: number) {
    const expiry = registeredPorts.get(port);
    if (expiry === undefined) return false;
    if (Date.now() > expiry) { registeredPorts.delete(port); return false; }
    return true;
  },
};

// Hop-by-hop / re-framing headers that must not be echoed back through the relay.
const STRIP_RESPONSE_HEADERS = new Set([
  "connection", "keep-alive", "transfer-encoding", "content-length",
  "content-encoding", // fetch already decompressed the body
  "set-cookie", // rides separately (array-valued)
]);

type PreviewHttpPayload = {
  requestId: string;
  port: number;
  method: string;
  path: string;
  headers: Record<string, string>;
  bodyB64?: string;
};

const response = (requestId: string, extra: Record<string, any>): WsMessage => ({
  type: EF.PREVIEW_HTTP_RESPONSE,
  payload: { requestId, ...extra },
});

export async function handlePreviewHttpRequest(
  payload: PreviewHttpPayload,
  send: (msg: WsMessage) => Promise<void>,
) {
  const { requestId, port, method, path, headers, bodyB64 } = payload;

  if (!allowedPreviewPorts.has(port)) {
    await send(response(requestId, { error: `Port ${port} is not registered for preview on this device` }));
    return;
  }

  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body: bodyB64 ? Buffer.from(bodyB64, "base64") : undefined,
      redirect: "manual", // pass 3xx through so the browser follows relative Locations via the tunnel
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const outHeaders: Record<string, string> = {};
    const setCookie: string[] = res.headers.getSetCookie?.() ?? [];
    res.headers.forEach((v, k) => {
      if (!STRIP_RESPONSE_HEADERS.has(k.toLowerCase())) outHeaders[k] = v;
    });

    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_RESPONSE_BODY) {
      await send(response(requestId, { error: `Response too large for preview relay (${body.length} bytes)` }));
      return;
    }

    await send(response(requestId, {
      status: res.status,
      headers: outHeaders,
      ...(setCookie.length ? { setCookie } : {}),
      ...(body.length ? { bodyB64: body.toString("base64") } : {}),
    }));
  } catch (e: any) {
    const code = e.code ?? e.cause?.code;
    const hint = code === "ECONNREFUSED" || code === "ConnectionRefused" // node | Bun
      ? `Nothing is listening on 127.0.0.1:${port}`
      : e.message;
    await send(response(requestId, { error: hint }));
  }
}


// ── WebSocket relay (browser ↔ backend ↔ edge ↔ ws://127.0.0.1:<port>) ──

const MAX_WS_STREAMS = 32;
const activeWs = new Map<string, WebSocket>();

export async function handlePreviewWsOpen(
  payload: { streamId: string; port: number; path: string; protocols?: string[] },
  send: (msg: WsMessage) => Promise<void>,
) {
  const { streamId, port, path, protocols } = payload;
  if (!allowedPreviewPorts.has(port)) {
    await send({ type: EF.PREVIEW_WS_OPENED, payload: { streamId, error: `Port ${port} is not registered for preview on this device` } });
    return;
  }
  if (activeWs.size >= MAX_WS_STREAMS) {
    await send({ type: EF.PREVIEW_WS_OPENED, payload: { streamId, error: "Too many open preview WebSocket streams" } });
    return;
  }
  try {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const ws = protocols?.length
      ? new WebSocket(`ws://127.0.0.1:${port}${cleanPath}`, protocols)
      : new WebSocket(`ws://127.0.0.1:${port}${cleanPath}`);
    ws.binaryType = "arraybuffer";
    activeWs.set(streamId, ws);

    let opened = false;
    let settled = false;
    ws.addEventListener("open", () => {
      opened = true;
      settled = true;
      void send({ type: EF.PREVIEW_WS_OPENED, payload: { streamId } });
    });
    ws.addEventListener("message", (ev) => {
      if (typeof ev.data === "string") {
        if (Buffer.byteLength(ev.data, "utf8") > MAX_RESPONSE_BODY) {
          ws.close(1009, "Message too large");
          return;
        }
        void send({ type: EF.PREVIEW_WS_DATA, payload: { streamId, binary: false, text: ev.data } });
      } else if (ev.data instanceof ArrayBuffer) {
        if (ev.data.byteLength > MAX_RESPONSE_BODY) {
          ws.close(1009, "Message too large");
          return;
        }
        void send({ type: EF.PREVIEW_WS_DATA, payload: { streamId, binary: true, dataB64: Buffer.from(ev.data).toString("base64") } });
      }
    });
    ws.addEventListener("error", () => {
      if (!settled) {
        settled = true;
        activeWs.delete(streamId);
        void send({ type: EF.PREVIEW_WS_OPENED, payload: { streamId, error: `Could not connect WebSocket to 127.0.0.1:${port}` } });
      }
    });
    ws.addEventListener("close", (ev) => {
      activeWs.delete(streamId);
      if (!settled) {
        settled = true;
        void send({ type: EF.PREVIEW_WS_OPENED, payload: { streamId, error: ev.reason || `Upstream closed (${ev.code})` } });
      } else if (opened) {
        void send({ type: EF.PREVIEW_WS_CLOSE, payload: { streamId, code: ev.code, reason: ev.reason } });
      }
    });
  } catch (e: any) {
    activeWs.delete(streamId);
    await send({ type: EF.PREVIEW_WS_OPENED, payload: { streamId, error: e?.message || "WebSocket open failed" } });
  }
}

export function handlePreviewWsData(payload: { streamId: string; binary?: boolean; dataB64?: string; text?: string }) {
  const ws = activeWs.get(payload.streamId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    if (payload.binary && payload.dataB64 !== undefined) ws.send(Buffer.from(payload.dataB64, "base64"));
    else if (payload.text !== undefined) ws.send(payload.text);
  } catch { /* close listener cleans up */ }
}

export function handlePreviewWsClose(payload: { streamId: string; code?: number; reason?: string }) {
  const ws = activeWs.get(payload.streamId);
  if (!ws) return;
  activeWs.delete(payload.streamId);
  try { ws.close(payload.code && payload.code >= 1000 && payload.code < 5000 ? payload.code : 1000, payload.reason); } catch {}
}

export function closeAllPreviewWs() {
  for (const ws of activeWs.values()) {
    try { ws.close(1001, "Edge disconnected"); } catch {}
  }
  activeWs.clear();
}
