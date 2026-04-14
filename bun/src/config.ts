import { parseArgs } from "util";
import path from "path";
import fs from "fs";
import os from "os";

const DEFAULT_API_URL = "https://api.todofor.ai";

function getEnv(name: string): string {
  return process.env[`TODOFORAI_${name}`] || process.env[`TODO4AI_${name}`] || "";
}

export function getWsUrl(apiUrl: string): string {
  if (apiUrl.startsWith("https://")) return apiUrl.replace("https://", "wss://") + "/ws/v1/edge";
  if (apiUrl.startsWith("http://")) return apiUrl.replace("http://", "ws://") + "/ws/v1/edge";
  if (apiUrl.startsWith("localhost")) return "ws://" + apiUrl + "/ws/v1/edge";
  return `wss://${apiUrl}/ws/v1/edge`;
}

export function normalizeApiUrl(url: string): string {
  if (url.startsWith("localhost")) return `http://${url}`;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return `https://${url}`;
  return url;
}

export interface Config {
  apiUrl: string;
  apiKey: string;
  debug: boolean;
  kill: boolean;
  addWorkspacePath?: string;
}

export function loadConfig(): Config {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "api-key": { type: "string" },
      "api-url": { type: "string" },
      debug: { type: "boolean", default: false },
      kill: { type: "boolean", default: false },
      "add-path": { type: "string" },
      version: { type: "boolean", short: "v", default: false },
    },
    allowPositionals: false,
    strict: false,
  });

  if (values.version) {
    console.log("todoforai-edge-bun 0.1.0");
    process.exit(0);
  }

  const apiUrl = normalizeApiUrl((values["api-url"] as string) || getEnv("API_URL") || DEFAULT_API_URL);
  const apiKey = (values["api-key"] as string) || getEnv("API_KEY") || "";
  const debug = !!(values.debug || getEnv("DEBUG").toLowerCase().match(/^(true|1|yes)$/));
  const kill = !!values.kill;

  let addWorkspacePath: string | undefined;
  if (values["add-path"]) {
    const p = values["add-path"] as string;
    addWorkspacePath = path.resolve(p.replace(/^~/, process.env.HOME || "~"));
  }

  return { apiUrl, apiKey, debug, kill, addWorkspacePath };
}

// ── Credential persistence (~/.todoforai/credentials.json) ──
// JSON map: { "https://api.todofor.ai": "sk_xxx", "http://localhost:3000": "sk_yyy" }

const CREDENTIALS_PATH = path.join(os.homedir(), ".todoforai", "credentials.json");

function readCredentials(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8")); } catch { return {}; }
}

function writeCredentials(creds: Record<string, string>) {
  const dir = path.dirname(CREDENTIALS_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export function loadSavedApiKey(apiUrl: string): string | null {
  return readCredentials()[apiUrl] || null;
}

export function saveApiKey(apiUrl: string, apiKey: string): void {
  const creds = readCredentials();
  creds[apiUrl] = apiKey;
  writeCredentials(creds);
}

export function clearApiKey(apiUrl: string): void {
  const creds = readCredentials();
  delete creds[apiUrl];
  writeCredentials(creds);
}
