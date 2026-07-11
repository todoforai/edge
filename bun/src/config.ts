import { parseArgs } from "util";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import os from "os";

const DEFAULT_API_URL = "https://api.todofor.ai";

function getEnv(name: string): string {
  return process.env[`TODOFORAI_${name}`] || process.env[`TODO4AI_${name}`] || "";
}

// Read at runtime (not a bundled JSON import): CI bumps package.json *after* the
// build, so only a runtime read reflects the published version.
// NOTE: null ⇒ standalone binary (no package.json next to us) — update logic relies on this.
export function readOwnPackage(): { name: string; version: string } | null {
  try {
    const pkgPath = path.resolve(fileURLToPath(import.meta.url), "../../package.json");
    return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  } catch { return null; }
}

// Burned in via `bun build --compile --define BUILD_VERSION='"x.y.z"'` for standalone binaries.
declare const BUILD_VERSION: string;
export function ownVersion(): string {
  return readOwnPackage()?.version ?? (typeof BUILD_VERSION === "string" ? BUILD_VERSION : "unknown");
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
  /** Floor for shell execution timeout (seconds). Effective timeout = max(requested, maxTimeout). */
  maxTimeout?: number;
  /** Skip the startup self-update check (env: TODOFORAI_NO_AUTO_UPDATE=1) */
  noAutoUpdate: boolean;
  /** Report file changes (original/modified content) after each shell command.
   *  On by default; opt out with --no-track-file-changes or TODOFORAI_TRACK_FILE_CHANGES=0. */
  trackFileChanges: boolean;
  subcommand?: "login" | "logout" | "update";
}

const SUBCOMMANDS = new Set(["login", "logout", "update"]);

const HELP_TEXT = `\
todoforai-edge — connect this machine to TODOforAI

Usage:
  todoforai-edge [options]
  todoforai-edge <command> [options]

Commands:
  login                Force device-login flow (clears saved key for --api-url)
  logout               Clear saved key for --api-url
  update               Update to the latest npm release and exit

Options:
  --api-key <key>      Explicit API key (overrides saved login; e.g. --api-key=$MY_API_KEY)
  --api-url <url>      API URL (env: TODOFORAI_API_URL, default: https://api.todofor.ai)
  --add-path <path>    Add workspace path to this edge
  --max-timeout <sec>  Floor for shell execution timeout
  --kill               Replace any existing edge instance for this user+server
  --no-track-file-changes  Stop reporting file changes after shell commands (env: TODOFORAI_TRACK_FILE_CHANGES=0)
  --no-auto-update     Skip the startup update check (env: TODOFORAI_NO_AUTO_UPDATE=1)
  --debug              Verbose logging (env: TODOFORAI_DEBUG=1)
  -v, --version        Print version and exit
  -h, --help           Show this help and exit`;

export function loadConfig(): Config {
  const argv = process.argv.slice(2);
  let subcommand: Config["subcommand"];
  if (argv[0] && SUBCOMMANDS.has(argv[0])) {
    subcommand = argv.shift() as Config["subcommand"];
  }

  const { values } = parseArgs({
    args: argv,
    options: {
      "api-key": { type: "string" },
      "api-url": { type: "string" },
      debug: { type: "boolean", default: false },
      kill: { type: "boolean", default: false },
      "no-auto-update": { type: "boolean", default: false },
      "no-track-file-changes": { type: "boolean", default: false },
      "add-path": { type: "string" },
      "max-timeout": { type: "string" },
      version: { type: "boolean", short: "v", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
    strict: false,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (values.version) {
    console.log(ownVersion());
    process.exit(0);
  }

  const apiUrl = normalizeApiUrl((values["api-url"] as string) || getEnv("API_URL") || DEFAULT_API_URL);
  // Explicit key only via --api-key flag; managed credentials.json is the normal path.
  const apiKey = (values["api-key"] as string) || "";
  const debug = !!(values.debug || getEnv("DEBUG").toLowerCase().match(/^(true|1|yes)$/));
  const kill = !!values.kill;
  const noAutoUpdate = !!(values["no-auto-update"] || getEnv("NO_AUTO_UPDATE").toLowerCase().match(/^(true|1|yes)$/));
  const trackFileChanges = !(values["no-track-file-changes"] || getEnv("TRACK_FILE_CHANGES").toLowerCase().match(/^(false|0|no)$/));

  let addWorkspacePath: string | undefined;
  if (values["add-path"]) {
    const p = values["add-path"] as string;
    addWorkspacePath = path.resolve(p.replace(/^~/, process.env.HOME || "~"));
  }

  const maxTimeout = values["max-timeout"] ? Math.max(0, parseInt(values["max-timeout"] as string, 10) || 0) : undefined;

  return { apiUrl, apiKey, debug, kill, noAutoUpdate, trackFileChanges, addWorkspacePath, maxTimeout, subcommand };
}

// ── Credential persistence ──
// Path matches todoforai-c-core / bridge:
//   Windows: %APPDATA%\todoforai\credentials.json
//   macOS:   ~/Library/Application Support/todoforai/credentials.json
//   Linux:   $XDG_CONFIG_HOME/todoforai/credentials.json (default ~/.config)
// Reads fall back to the legacy ~/.todoforai/credentials.json; writes go to the new path.
// JSON map: { "https://api.todofor.ai": "sk_xxx", "http://localhost:3000": "sk_yyy" }

function credentialsPath(): string {
  const sys = os.platform();
  if (sys === "win32") {
    // Match todoforai-c-core: %HOME%\AppData\Roaming (not %APPDATA%).
    return path.join(os.homedir(), "AppData", "Roaming", "todoforai", "credentials.json");
  }
  if (sys === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "todoforai", "credentials.json");
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(xdg, "todoforai", "credentials.json");
}

const CREDENTIALS_PATH = credentialsPath();

function readFileMap(p: string): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return {}; }
}

function writeNewFile(creds: Record<string, string>) {
  const dir = path.dirname(CREDENTIALS_PATH);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
  try { fs.chmodSync(CREDENTIALS_PATH, 0o600); } catch {}
}

export function loadSavedApiKey(apiUrl: string): string | null {
  return readFileMap(CREDENTIALS_PATH)[apiUrl] || null;
}

export function saveApiKey(apiUrl: string, apiKey: string): void {
  const creds = readFileMap(CREDENTIALS_PATH);
  creds[apiUrl] = apiKey;
  writeNewFile(creds);
}

export function clearApiKey(apiUrl: string): void {
  const creds = readFileMap(CREDENTIALS_PATH);
  if (apiUrl in creds) {
    delete creds[apiUrl];
    writeNewFile(creds);
  }
}
