import WebSocket from "ws";
import { getWsUrl, normalizeApiUrl, loadSavedApiKey, saveApiKey, clearApiKey, type Config } from "./config.js";
import { SR, FE, AE, EF, S2E, msg, type WsMessage } from "./constants.js";
import { ApiClient } from "./api.js";
import { FrontendWebSocket } from "./frontend-ws.js";
import { BrowserExtensionBridge } from "./browser-extension-bridge.js";
import type { EdgeConfigData } from "./types.js";
import {
  handleBlockExecute,
  handleBlockSave,
  handleBlockSignal,
  handleBlockKeyboard,
  handleGetFolders,
  handleCreateFolder,
  handleDeletePath,
  handleWriteFile,
  handleCd,
  handleFileChunkRequest,
  handleTaskActionNew,
  handleCtxJuliaRequest,
  handleFunctionCall,
} from "./handlers.js";
import { scanCatalogTools, autoMountRcloneRemotes } from "./tool-registry.js";
import type { SendFn } from "./shell.js";

// ── Fingerprint ──

function generateFingerprint(): string {
  const os = require("os");
  const fs = require("fs");
  const identifiers: Record<string, string> = {};

  if (process.platform === "linux") {
    try {
      const mid = fs.readFileSync("/etc/machine-id", "utf-8").trim();
      if (mid) identifiers.machine_id = mid;
    } catch {}
  } else if (process.platform === "darwin") {
    try {
      const { execSync } = require("child_process");
      const out = execSync("ioreg -rd1 -c IOPlatformExpertDevice", { encoding: "utf-8", timeout: 5000 });
      const m = out.match(/IOPlatformUUID.*?=.*?"(.+?)"/);
      if (m) identifiers.hardware_uuid = m[1];
    } catch {}
  }

  if (Object.keys(identifiers).length === 0) {
    identifiers.platform = process.platform;
    identifiers.machine = os.machine?.() || os.arch();
    identifiers.node = os.hostname();
  }

  const keys = Object.keys(identifiers).sort();
  const json = "{" + keys.map(k => JSON.stringify(k) + ": " + JSON.stringify(identifiers[k])).join(", ") + "}";
  return Buffer.from(json).toString("base64");
}

// ── Forbidden workspace paths ──

const FORBIDDEN_PATHS = new Set(["/", "/tmp", "C:\\", "C:/"]);

// ── Main class ──

export class TODOforAIEdge {
  api: ApiClient;
  ws: WebSocket | null = null;
  connected = false;
  edgeId = "";
  userId = "";
  debug: boolean;
  private wsUrl: string;
  private fingerprint = "";
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private addWorkspacePath?: string;
  private frontendWs: FrontendWebSocket | null = null;
  private browserExtensionBridge: BrowserExtensionBridge;
  private stopping = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  edgeConfig: EdgeConfigData = {
    id: "",
    name: "Name uninitialized",
    workspacepaths: [],
    ownerId: "",
    status: "OFFLINE",
  };

  private configSyncableFields = ["workspacepaths", "name", "installedTools"];

  constructor(config: Config) {
    this.api = new ApiClient(normalizeApiUrl(config.apiUrl), config.apiKey);
    this.debug = config.debug;
    this.wsUrl = getWsUrl(this.api.apiUrl);
    this.addWorkspacePath = config.addWorkspacePath;
    this.browserExtensionBridge = new BrowserExtensionBridge(this.debug);
  }

  // Convenience accessors for functions that need client context
  get apiUrl() { return this.api.apiUrl; }
  get apiKey() { return this.api.apiKey; }

  // ── Send ──

  sendResponse: SendFn = async (message: WsMessage) => {
    if (!this.ws || !this.connected) {
      if (this.debug) console.log(`[warn] Cannot send ${message.type}: not connected`);
      return;
    }
    const json = JSON.stringify(message);
    if (this.debug && json.length > 100_000) console.log(`[warn] Large message: ${json.length} bytes`);
    this.ws.send(json);
  };

  // ── Auth ──

  /** Validate a key with retry on connection errors; clears key if invalid. */
  private async tryValidateKey(): Promise<boolean> {
    let delay = 5;
    while (true) {
      const result = await this.api.validateApiKey();
      if (result.valid) {
        if (result.userId) this.userId = result.userId;
        return true;
      }
      if (result.connectionError) {
        console.log(`\x1b[33mCannot reach server at ${this.api.apiUrl}, retrying in ${delay}s...\x1b[0m`);
        await new Promise(r => setTimeout(r, delay * 1000));
        delay = Math.min(delay * 2, 60);
        continue;
      }
      console.log(`\x1b[33mAPI key invalid: ${result.error}\x1b[0m`);
      this.api.apiKey = "";
      return false;
    }
  }

  async ensureApiKey(promptIfMissing = true): Promise<boolean> {
    // 1. --api-key / env var (don't persist — explicit keys are ephemeral)
    if (this.api.apiKey && await this.tryValidateKey()) return true;

    // 2. Saved credentials
    const saved = loadSavedApiKey(this.api.apiUrl);
    if (saved) {
      this.api.apiKey = saved;
      if (await this.tryValidateKey()) return true;
      console.log("\x1b[33mSaved API key is no longer valid, clearing...\x1b[0m");
      clearApiKey(this.api.apiUrl);
    }

    if (!promptIfMissing) return false;

    // 3. Device login flow
    try {
      console.log("\x1b[36mStarting device login...\x1b[0m");
      const { code, url, expiresIn } = await this.api.initDeviceLogin("edge");

      console.log(`\n\x1b[1m🔑 Open this URL to authorize:\x1b[0m`);
      console.log(`\x1b[36m${url}\x1b[0m\n`);

      // Best-effort open browser
      try {
        const { exec } = require("child_process");
        const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        exec(`${cmd} "${url}"`);
      } catch {}

      console.log(`Waiting for approval (expires in ${Math.round(expiresIn / 60)}min)...`);
      const deadline = Date.now() + expiresIn * 1000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const poll = await this.api.pollDeviceLogin(code);
          if (poll.status === "complete" && poll.apiKey) {
            this.api.apiKey = poll.apiKey;
            saveApiKey(this.api.apiUrl, poll.apiKey);
            console.log("\x1b[32m✅ Login successful! API key saved.\x1b[0m");
            // Trust the freshly-minted key — don't re-validate (code is already consumed)
            return true;
          }
          if (poll.status === "expired") {
            console.log("\x1b[31mDevice login expired.\x1b[0m");
            break;
          }
        } catch {
          // Transient network error — keep polling until deadline
        }
        // pending — keep polling
      }
    } catch (e: any) {
      console.error(`\x1b[31mDevice login failed: ${e.message}\x1b[0m`);
    }

    // 4. Fallback: manual API key entry (TTY only)
    if (!process.stdin.isTTY) {
      console.error("No API key provided and stdin is not interactive. Set TODOFORAI_API_KEY or pass --api-key.");
      process.exit(0);
    }

    const frontendUrl = this.api.apiUrl.replace("://api.", "://");
    console.log(`\x1b[33mOr enter your API key manually:\x1b[0m`);
    console.log(`\x1b[36mGet one at:\x1b[0m ${frontendUrl}/apikey`);

    const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      const ask = () => {
        rl.question("API Key: ", async (key: string) => {
          key = key.trim();
          if (!key) { console.log("No API key provided. Please try again."); return ask(); }
          this.api.apiKey = key;
          if (await this.tryValidateKey()) {
            saveApiKey(this.api.apiUrl, key);
            console.log("\x1b[32m✅ API key saved.\x1b[0m");
            rl.close();
            resolve(true);
            return;
          }
          console.log("\x1b[31mInvalid API key. Please try again.\x1b[0m");
          ask();
        });
      };
      ask();
    });
  }

  // ── Config sync ──

  public async updateConfig(updates: Partial<EdgeConfigData>) {
    Object.assign(this.edgeConfig, updates);
    await this.syncConfigToServer(updates);
  }

  private async syncConfigToServer(changes: Partial<EdgeConfigData>) {
    if (!this.edgeId || !this.connected) return;
    const syncable: Record<string, any> = {};
    for (const [k, v] of Object.entries(changes)) {
      if (this.configSyncableFields.includes(k)) syncable[k] = v;
    }
    if (Object.keys(syncable).length === 0) return;
    try {
      await this.api.patchEdgeConfig(this.edgeId, syncable);
    } catch (e: any) {
      console.error(`[error] Failed to sync config: ${e.message}`);
    }
  }

  private handleEdgeConfigUpdate(payload: Record<string, any>) {
    const edgeId = payload.edgeId;
    if (edgeId && edgeId !== this.edgeId) return;

    // Filter forbidden workspace paths
    if (payload.workspacepaths) {
      const path = require("path");
      payload.workspacepaths = payload.workspacepaths.filter(
        (p: string) => !FORBIDDEN_PATHS.has(path.normalize(p).replace(/\/+$/, "")),
      );
    }

    Object.assign(this.edgeConfig, payload);

    // Handle --add-path after initial config
    if (this.addWorkspacePath) {
      const p = this.addWorkspacePath;
      this.addWorkspacePath = undefined;
      const normalized = require("path").normalize(p).replace(/\/+$/, "");
      if (!FORBIDDEN_PATHS.has(normalized) && !this.edgeConfig.workspacepaths.includes(p)) {
        this.edgeConfig.workspacepaths.push(p);
        this.syncConfigToServer({ workspacepaths: this.edgeConfig.workspacepaths });
        console.log(`\x1b[32m✅ Added workspace path: ${p}\x1b[0m`);
      }
    }
  }

  // ── Pending binary frames (binaryId → Uint8Array) ──
  private pendingBinaries = new Map<string, Uint8Array>();

  private storeBinaryFrame(frame: Uint8Array) {
    if (frame.length < 36) return;
    let id = '';
    for (let i = 0; i < 36; i++) id += String.fromCharCode(frame[i]);
    const data = frame.slice(36);
    this.pendingBinaries.set(id, data);
    // Auto-expire after 60s
    setTimeout(() => this.pendingBinaries.delete(id), 60_000).unref();
  }

  // ── Message handling ──

  private async handleMessage(raw: string) {
    let data: any;
    try { data = JSON.parse(raw); } catch { return; }
    const msgType = data.type;
    const payload = data.payload || {};

    if (this.debug) console.log(`[recv] ${msgType}`);

    if (msgType === "ERROR") {
      const errMsg = payload.message || "Unknown error";
      console.error(`\x1b[31mServer error: ${errMsg}\x1b[0m`);
      if (errMsg.includes("API key") || errMsg.toLowerCase().includes("authentication")) {
        throw new AuthenticationError(errMsg);
      }
      throw new ServerError(errMsg);
    }

    // Fire-and-forget: run handler in background, don't await
    const run = (fn: () => Promise<void>) => {
      fn().catch(e => console.error(`[handler error]`, e));
    };
    const send = this.sendResponse;

    switch (msgType) {
      case SR.CONNECTED_EDGE:
        this.edgeId = payload.edgeId || "";
        this.userId = payload.userId || "";
        this.edgeConfig.id = this.edgeId;
        console.log(`\x1b[32m\x1b[1m🔗 Connected edge=${this.edgeId} user=${this.userId}\x1b[0m`);
        run(async () => {
          this.updateConfig({ installedTools: scanCatalogTools() });
          autoMountRcloneRemotes();
        });
        break;

      case S2E.EDGE_CONFIG_UPDATE:
        run(async () => this.handleEdgeConfigUpdate(payload));
        break;

      case FE.EDGE_CD:
        run(() => handleCd(payload, send, this.edgeConfig, (u) => this.updateConfig(u)));
        break;

      case FE.BLOCK_EXECUTE:
        run(() => handleBlockExecute(payload, send, this.edgeId));
        break;

      case FE.BLOCK_SAVE:
        run(() => handleBlockSave(payload, send));
        break;

      case FE.BLOCK_KEYBOARD:
        run(() => handleBlockKeyboard(payload));
        break;

      case FE.BLOCK_SIGNAL:
        run(async () => handleBlockSignal(payload));
        break;

      case FE.TASK_ACTION_NEW:
        run(() => handleTaskActionNew(payload, send));
        break;

      case AE.CTX_JULIA_REQUEST:
        run(() => handleCtxJuliaRequest(payload, send));
        break;

      case AE.FILE_CHUNK_REQUEST:
        run(() => handleFileChunkRequest(payload, send));
        break;

      case FE.FRONTEND_FILE_CHUNK_REQUEST:
        run(() => handleFileChunkRequest(payload, send, EF.FRONTEND_FILE_CHUNK_RESULT));
        break;

      case FE.GET_FOLDERS:
        run(() => handleGetFolders(payload, send));
        break;

      case FE.EDGE_CREATE_FOLDER:
        run(() => handleCreateFolder(payload, send));
        break;

      case FE.EDGE_DELETE_PATH:
        run(() => handleDeletePath(payload, send));
        break;

      case FE.EDGE_WRITE_FILE:
        run(() => handleWriteFile(payload, send, this.pendingBinaries));
        break;

      case AE.FUNCTION_CALL_REQUEST_AGENT:
      case FE.FUNCTION_CALL_REQUEST_FRONT:
        if (this.debug) console.log(`[edge] ← ${msgType} reqId=${payload.requestId} fn=${payload.functionName} cmd=${String(payload.args?.cmd || '').slice(0, 100)}`);
        run(() => handleFunctionCall(payload, send, this));
        break;

      default:
        if (this.debug) console.log(`[warn] Unknown message type: ${msgType}`);
    }
  }

  // ── Connection ──

  private startHeartbeat() {
    this.stopHeartbeat();
    let pongReceived = true;
    this.ws?.on("pong", () => { pongReceived = true; });
    this.heartbeatTimer = setInterval(() => {
      if (!pongReceived) {
        console.log("[warn] No pong received, terminating stale connection");
        this.ws?.terminate();
        return;
      }
      pongReceived = false;
      try { this.ws?.ping(); } catch {}
    }, 30_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.wsUrl}?fingerprint=${encodeURIComponent(this.fingerprint)}`;
      if (this.debug) console.log(`[info] Connecting to ${url}`);

      this.ws = new WebSocket(url, [this.api.apiKey], {
        maxPayload: 5 * 1024 * 1024,
        rejectUnauthorized: false,
      });

      this.ws.on("open", () => {
        this.connected = true;
        console.log("[info] WebSocket connected");
        this.startHeartbeat();
      });

      this.ws.on("message", (data, isBinary) => {
        if (isBinary) {
          const frame = data instanceof Buffer ? new Uint8Array(data) : new Uint8Array(data as ArrayBuffer);
          this.storeBinaryFrame(frame);
          return;
        }
        this.handleMessage(data.toString()).catch(e => {
          if (e instanceof AuthenticationError || e instanceof ServerError) {
            this.ws?.close();
            reject(e);
          } else {
            console.error("[handler error]", e);
          }
        });
      });

      this.ws.on("close", (code, reason) => {
        this.stopHeartbeat();
        this.connected = false;
        this.ws = null;
        const reasonText = reason?.toString() || "<empty>";
        const clean = code === 1000;
        console.log(`[info] WebSocket closed code=${code} clean=${clean} reason=${reasonText}`);
        if (code === 4001) {
          console.log(`\x1b[33m[info] ${reasonText}. Not reconnecting.\x1b[0m`);
          reject(new ServerError(reasonText));
        } else {
          resolve();
        }
      });

      this.ws.on("error", (err) => {
        this.stopHeartbeat();
        this.connected = false;
        this.ws = null;
        reject(err);
      });
    });
  }

  // ── Start with reconnect ──

  async start() {
    try { this.browserExtensionBridge.start(); } catch {}
    this.fingerprint = generateFingerprint();
    console.log(`\x1b[36m\x1b[1m👆 Fingerprint:\x1b[0m ${this.fingerprint}`);

    const maxAttempts = 20;
    let attempt = 0;

    while (attempt < maxAttempts && !this.stopping) {
      console.log(`[info] Connecting (attempt ${attempt + 1}/${maxAttempts})`);

      try {
        await this.connect();
        if (this.stopping) break;
        attempt = 0; // reset on clean close
      } catch (e: any) {
        if (e instanceof AuthenticationError) {
          console.error(`\x1b[31mAuthentication failed: ${e.message}\x1b[0m`);
          break;
        }
        if (e instanceof ServerError) {
          console.error(`\x1b[31mServer error: ${e.message}\x1b[0m`);
          break;
        }
        attempt++;
        console.error(`[error] Connection error: ${e.message}`);
      } finally {
        this.connected = false;
        this.ws = null;
      }

      if (attempt > 0 && attempt < maxAttempts && !this.stopping) {
        const delay = Math.min(4 + attempt, 20);
        console.log(`[info] Reconnecting in ${delay}s...`);
        await new Promise<void>(r => {
          this.reconnectTimer = setTimeout(r, delay * 1000);
        });
      }
    }

    if (attempt >= maxAttempts) {
      console.error("\x1b[31mMax reconnection attempts reached.\x1b[0m");
    }
  }

  // ── Shutdown ──

  stop() {
    this.stopping = true;
    clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.browserExtensionBridge.stop();
    this.frontendWs?.close();
    this.ws?.terminate();
  }

  // ── Frontend WS (for SDK use) ──

  async getFrontendWs(): Promise<FrontendWebSocket> {
    if (!this.frontendWs || !this.frontendWs.connected) {
      this.frontendWs = new FrontendWebSocket(this.api.apiUrl, this.api.apiKey);
      await this.frontendWs.connect();
    }
    return this.frontendWs;
  }

  async waitForTodoCompletion(todoId: string, timeout = 300, callback?: (msgType: string, payload: any) => void) {
    const ws = await this.getFrontendWs();
    return ws.waitForCompletion(todoId, callback, timeout);
  }
}

// ── Global edge instance reference for functions ──
let globalEdgeInstance: TODOforAIEdge | null = null;
export function setGlobalEdgeInstance(edge: TODOforAIEdge) {
  globalEdgeInstance = edge;
}
export function getGlobalEdgeInstance(): TODOforAIEdge | null {
  return globalEdgeInstance;
}

// ── Error types ──

class AuthenticationError extends Error {
  constructor(msg: string) { super(msg); this.name = "AuthenticationError"; }
}

class ServerError extends Error {
  constructor(msg: string) { super(msg); this.name = "ServerError"; }
}
