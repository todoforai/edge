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

/** Ports registered by the live_preview tool for this process's lifetime. */
export const allowedPreviewPorts = new Set<number>();

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
