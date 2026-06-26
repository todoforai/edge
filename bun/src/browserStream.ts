// OAuth/remote browser stream — stream the host's headless Chrome to the
// frontend over CDP and inject the user's mouse/keyboard, so a consent flow
// (Google, etc.) can be completed in a popup. The OAuth redirect lands on the
// host's own localhost:<callbackPort>, so the flow finishes on the host with no
// paste-back.
//
// Proven mechanism (see frontend/docs/browser-stream.md): Page.startScreencast
// emits JPEG frames; Input.dispatch{Mouse,Key}Event injects real input.
//
// IMPORTANT bun gotcha: bun's fetch("http://localhost…") can hang/refuse on the
// CDP port; we discover the ws URL via `curl 127.0.0.1:<port>/json/version`.

import { spawn, execFile, type ChildProcess } from "child_process";
import { promisify } from "util";
import net from "net";
import os from "os";
import fs from "fs";
import path from "path";
import { msg, type WsMessage } from "./constants.js";
import { TOOL_CATALOG } from "./tool-catalog.js";
import { buildEnvWithTools } from "./tool-registry.js";

const execFileP = promisify(execFile);

type SendFn = (m: WsMessage) => void | Promise<void>;

interface Session {
  sessionId: string;
  send: SendFn;
  port: number;
  profileDir?: string;
  chrome?: ChildProcess;
  login?: ChildProcess;
  ws?: WebSocket;
  cdpSessionId?: string;
  cdpId: number;
  pending: Map<number, { resolve: (m: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>;
  frameCount: number;
  stopped: boolean;            // set the instant stop is requested (cancellation)
  forceTimer?: ReturnType<typeof setInterval>;
}

const SESSIONS = new Map<string, Session>();

/** OAuth URL patterns per tool (host only needs to find the printed consent URL). */
const OAUTH_URL_PATTERN: Record<string, RegExp> = {
  zele: /(https:\/\/accounts\.google\.com\S+)/,
};

function findChromeBinary(): string | null {
  const candidates = [
    "/opt/agent-browser/chrome/chrome",
    process.env.AGENT_BROWSER_EXECUTABLE_PATH || "",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  return candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) ?? null;
}

/** Bind a server to :0 to obtain a real free port, then release it for Chrome. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

async function cdpWsUrl(port: number): Promise<string | null> {
  // curl, not bun fetch (localhost bug). Returns webSocketDebuggerUrl.
  try {
    const { stdout } = await execFileP("curl", ["-s", `http://127.0.0.1:${port}/json/version`], { timeout: 4000 });
    const m = stdout.match(/"webSocketDebuggerUrl":\s*"([^"]+)"/);
    return m ? m[1].replace("localhost", "127.0.0.1") : null;
  } catch { return null; }
}

/** Kill a detached child and its process group (renderers/utility procs). */
function killTree(child: ChildProcess | undefined) {
  if (!child?.pid) return;
  try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
}

/** Idempotent, non-hanging teardown for a session. */
function cleanup(s: Session) {
  if (s.forceTimer) { clearInterval(s.forceTimer); s.forceTimer = undefined; }
  for (const p of s.pending.values()) { clearTimeout(p.timer); p.reject(new Error("session closed")); }
  s.pending.clear();
  try { s.ws?.close(); } catch {}
  killTree(s.chrome);
  killTree(s.login);
  if (s.profileDir) { try { fs.rmSync(s.profileDir, { recursive: true, force: true }); } catch {} }
  SESSIONS.delete(s.sessionId);
}

/** CDP request with timeout + rejection on WS close. */
function cdpSend(s: Session, method: string, params: Record<string, any> = {}, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    if (s.stopped || !s.ws || s.ws.readyState !== WebSocket.OPEN) { reject(new Error("cdp not open")); return; }
    const id = ++s.cdpId;
    const timer = setTimeout(() => { s.pending.delete(id); reject(new Error(`cdp ${method} timeout`)); }, timeoutMs);
    s.pending.set(id, { resolve, reject, timer });
    s.ws.send(JSON.stringify({ id, method, params, ...(s.cdpSessionId ? { sessionId: s.cdpSessionId } : {}) }));
  });
}

/** Launch a dedicated CDP Chrome on `port`; resolve once /json/version answers. */
async function launchChrome(s: Session): Promise<string> {
  const bin = findChromeBinary();
  if (!bin) throw new Error("no chrome binary found for screencast");
  s.profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-stream-"));
  s.chrome = spawn(bin, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    `--remote-debugging-port=${s.port}`, `--user-data-dir=${s.profileDir}`,
    "--window-size=1280,720", "--no-first-run", "--no-default-browser-check",
  ], { detached: true, stdio: "ignore", env: buildEnvWithTools() });

  for (let i = 0; i < 30; i++) {
    if (s.stopped) throw new Error("cancelled");
    await new Promise((r) => setTimeout(r, 400));
    const ws = await cdpWsUrl(s.port);
    if (ws) return ws;
  }
  throw new Error("chrome CDP did not come up");
}

/** Run the tool's loginCmd detached (xdg-open shim) and capture the OAuth URL it
 *  prints. Tracks the child so stop can kill its callback server. */
async function captureOAuthUrl(s: Session, toolKey: string): Promise<string | null> {
  const tool = (TOOL_CATALOG as any)[toolKey];
  const pattern = OAUTH_URL_PATTERN[toolKey];
  if (!tool?.loginCmd || !pattern) return null;
  const logFile = path.join(s.profileDir ?? os.tmpdir(), "login.out");
  try { fs.rmSync(logFile, { force: true }); } catch {}
  s.login = spawn("bash", ["-c",
    `tmpd=$(mktemp -d); ln -s /usr/bin/true "$tmpd/xdg-open"; ` +
    `export PATH="$tmpd:$PATH"; { ${tool.loginCmd}; } >${logFile} 2>&1`,
  ], { detached: true, stdio: "ignore", env: buildEnvWithTools() });

  for (let i = 0; i < 20; i++) {
    if (s.stopped) return null;
    await new Promise((r) => setTimeout(r, 1000));
    let out = "";
    try { out = fs.readFileSync(logFile, "utf-8"); } catch {}
    const m = out.match(pattern);
    if (m) return m[1] ?? m[0];
  }
  return null;
}

export async function startScreencast(args: Record<string, any>, send: SendFn): Promise<any> {
  const { toolKey, sessionId } = args as { toolKey: string; sessionId: string };
  if (!toolKey || !sessionId) throw new Error("startScreencast requires toolKey + sessionId");
  if (SESSIONS.has(sessionId)) return { ok: true, already: true };

  // Insert the session BEFORE any await so a racing stop can cancel it.
  const s: Session = { sessionId, send, port: 0, cdpId: 0, pending: new Map(), frameCount: 0, stopped: false };
  SESSIONS.set(sessionId, s);

  try {
    s.port = await freePort();
    const wsUrl = await launchChrome(s);
    if (s.stopped) throw new Error("cancelled");

    const ws = new WebSocket(wsUrl);
    s.ws = ws;
    await new Promise<void>((res, rej) => {
      ws.addEventListener("open", () => res());
      ws.addEventListener("error", () => rej(new Error("cdp ws error")));
    });

    ws.addEventListener("close", () => { for (const p of s.pending.values()) { clearTimeout(p.timer); p.reject(new Error("cdp ws closed")); } s.pending.clear(); });
    ws.addEventListener("message", async (ev: MessageEvent) => {
      const m = JSON.parse(ev.data as string);
      if (m.id && s.pending.has(m.id)) { const p = s.pending.get(m.id)!; clearTimeout(p.timer); s.pending.delete(m.id); p.resolve(m); return; }
      if (m.method === "Page.screencastFrame" && m.params?.sessionId === s.cdpSessionId) {
        s.frameCount++;
        await s.send(msg.browserFrame(sessionId, m.params.data, m.params.metadata?.deviceWidth ?? 1280, m.params.metadata?.deviceHeight ?? 720, s.frameCount));
        try { await cdpSend(s, "Page.screencastFrameAck", { sessionId: m.params.sessionId }); } catch {}
      }
    });

    const created = await cdpSend(s, "Target.createTarget", { url: "about:blank" });
    const attached = await cdpSend(s, "Target.attachToTarget", { targetId: created.result.targetId, flatten: true });
    s.cdpSessionId = attached.result.sessionId;
    await cdpSend(s, "Page.enable");
    await cdpSend(s, "Runtime.enable");

    const oauthUrl = await captureOAuthUrl(s, toolKey);
    if (!oauthUrl) throw new Error("could not capture OAuth URL from loginCmd");
    if (s.stopped) throw new Error("cancelled");
    await cdpSend(s, "Page.navigate", { url: oauthUrl });
    await cdpSend(s, "Page.startScreencast", { format: "jpeg", quality: 60, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });

    // Force a frame periodically so a static screen still paints.
    s.forceTimer = setInterval(async () => {
      if (s.stopped) return;
      try {
        const shot = await cdpSend(s, "Page.captureScreenshot", { format: "jpeg", quality: 50 });
        if (shot.result?.data) { s.frameCount++; await s.send(msg.browserFrame(sessionId, shot.result.data, 1280, 720, s.frameCount)); }
      } catch {}
    }, 2000);

    return { ok: true, width: 1280, height: 720 };
  } catch (e: any) {
    cleanup(s);
    throw new Error(`browser stream start failed: ${e?.message ?? e}`);
  }
}

export async function stopScreencast(args: Record<string, any>): Promise<any> {
  const { sessionId } = args as { sessionId: string };
  const s = SESSIONS.get(sessionId);
  if (!s) return { ok: true, missing: true };
  s.stopped = true; // cancels any in-flight start after its next await
  // Best-effort, time-boxed stopScreencast — never block teardown on it.
  try { await Promise.race([cdpSend(s, "Page.stopScreencast", {}, 1500), new Promise((r) => setTimeout(r, 1500))]); } catch {}
  cleanup(s);
  return { ok: true };
}

/** Fire-and-forget input from the frontend → CDP Input.dispatch*. */
export async function handleBrowserInput(payload: Record<string, any>): Promise<void> {
  const { sessionId, kind } = payload;
  const s = SESSIONS.get(sessionId);
  if (!s || s.stopped) return;
  try {
    if (kind === "mouse") {
      await cdpSend(s, "Input.dispatchMouseEvent", { type: payload.type, x: payload.x, y: payload.y, button: payload.button ?? "left", clickCount: payload.clickCount ?? 1, buttons: payload.buttons ?? 0 });
    } else if (kind === "wheel") {
      await cdpSend(s, "Input.dispatchMouseEvent", { type: "mouseWheel", x: payload.x, y: payload.y, deltaX: payload.deltaX ?? 0, deltaY: payload.deltaY ?? 0 });
    } else if (kind === "key") {
      await cdpSend(s, "Input.dispatchKeyEvent", { type: payload.type, key: payload.key, code: payload.code, text: payload.text, windowsVirtualKeyCode: payload.keyCode });
    }
  } catch { /* best-effort */ }
}
