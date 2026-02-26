import WebSocket from "ws";
import { getWsUrl, normalizeApiUrl, type Config } from "./config.js";
import { SR, FE, AE, EF, S2E, msg, type WsMessage } from "./constants.js";
import { ApiClient } from "./api.js";
import { FrontendWebSocket } from "./frontend-ws.js";
import type { EdgeConfigData } from "./types.js";
import {
  handleBlockExecute,
  handleBlockSave,
  handleBlockSignal,
  handleBlockKeyboard,
  handleGetFolders,
  handleCd,
  handleFileChunkRequest,
  handleTaskActionNew,
  handleCtxJuliaRequest,
  handleFunctionCall,
} from "./handlers.js";
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

  return Buffer.from(JSON.stringify(identifiers, Object.keys(identifiers).sort())).toString("base64");
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

  edgeConfig: EdgeConfigData = {
    id: "",
    name: "Name uninitialized",
    workspacepaths: [],
    ownerId: "",
    status: "OFFLINE",
    isShellEnabled: false,
    isFileSystemEnabled: false,
  };

  private configSyncableFields = ["workspacepaths", "name", "isShellEnabled", "isFileSystemEnabled"];

  constructor(config: Config) {
    this.api = new ApiClient(normalizeApiUrl(config.apiUrl), config.apiKey);
    this.debug = config.debug;
    this.wsUrl = getWsUrl(this.api.apiUrl);
    this.addWorkspacePath = config.addWorkspacePath;
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

  async ensureApiKey(promptIfMissing = true): Promise<boolean> {
    if (this.api.apiKey) {
      let delay = 5;
      while (true) {
        const result = await this.api.validateApiKey();
        if (result.valid) {
          if (result.userId) this.userId = result.userId;
          return true;
        }
        if (result.connectionError) {
          console.log(`\x1b[33mCannot reach server at ${this.api.apiUrl}, retrying in ${delay}s...\x1b[0m`);
          await Bun.sleep(delay * 1000);
          delay = Math.min(delay * 2, 60);
          continue;
        }
        console.log(`\x1b[33mAPI key invalid: ${result.error}\x1b[0m`);
        this.api.apiKey = "";
        break;
      }
    }

    if (!promptIfMissing) return false;

    console.log("\x1b[33mPlease provide your API key\x1b[0m");
    const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      const ask = () => {
        rl.question("API Key: ", async (key: string) => {
          key = key.trim();
          if (!key) { console.log("No API key provided. Please try again."); return ask(); }
          this.api.apiKey = key;
          const result = await this.api.validateApiKey();
          if (result.valid) { rl.close(); resolve(true); return; }
          console.log("\x1b[31mInvalid API key. Please try again.\x1b[0m");
          ask();
        });
      };
      ask();
    });
  }

  // ── Config sync ──

  private updateConfig(updates: Partial<EdgeConfigData>) {
    Object.assign(this.edgeConfig, updates);
    this.syncConfigToServer(updates);
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
        break;

      case S2E.EDGE_CONFIG_UPDATE:
        run(async () => this.handleEdgeConfigUpdate(payload));
        break;

      case FE.EDGE_CD:
        run(() => handleCd(payload, send, this.edgeConfig, (u) => this.updateConfig(u)));
        break;

      case FE.BLOCK_EXECUTE:
        run(() => handleBlockExecute(payload, send));
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

      case AE.FUNCTION_CALL_REQUEST_AGENT:
      case FE.FUNCTION_CALL_REQUEST_FRONT:
        run(() => handleFunctionCall(payload, send, this));
        break;

      default:
        if (this.debug) console.log(`[warn] Unknown message type: ${msgType}`);
    }
  }

  // ── Connection ──

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
      });

      this.ws.on("message", (data) => {
        this.handleMessage(data.toString()).catch(e => {
          if (e instanceof AuthenticationError || e instanceof ServerError) {
            this.ws?.close();
            reject(e);
          } else {
            console.error("[handler error]", e);
          }
        });
      });

      this.ws.on("close", () => {
        this.connected = false;
        this.ws = null;
        resolve();
      });

      this.ws.on("error", (err) => {
        this.connected = false;
        this.ws = null;
        reject(err);
      });
    });
  }

  // ── Start with reconnect ──

  async start() {
    this.fingerprint = generateFingerprint();
    console.log(`\x1b[36m\x1b[1m👆 Fingerprint:\x1b[0m ${this.fingerprint}`);

    const maxAttempts = 10;
    let attempt = 0;

    while (attempt < maxAttempts) {
      console.log(`[info] Connecting (attempt ${attempt + 1}/${maxAttempts})`);

      try {
        await this.connect();
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

      if (attempt > 0 && attempt < maxAttempts) {
        const delay = Math.min(4 + attempt, 20);
        console.log(`[info] Reconnecting in ${delay}s...`);
        await Bun.sleep(delay * 1000);
      }
    }

    if (attempt >= maxAttempts) {
      console.error("\x1b[31mMax reconnection attempts reached.\x1b[0m");
    }
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

// ── Error types ──

class AuthenticationError extends Error {
  constructor(msg: string) { super(msg); this.name = "AuthenticationError"; }
}

class ServerError extends Error {
  constructor(msg: string) { super(msg); this.name = "ServerError"; }
}
