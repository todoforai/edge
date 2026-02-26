import { parseArgs } from "util";
import path from "path";

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
  addWorkspacePath?: string;
}

export function loadConfig(): Config {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "api-key": { type: "string" },
      "api-url": { type: "string" },
      debug: { type: "boolean", default: false },
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

  let addWorkspacePath: string | undefined;
  if (values["add-path"]) {
    const p = values["add-path"] as string;
    addWorkspacePath = path.resolve(p.replace(/^~/, process.env.HOME || "~"));
  }

  return { apiUrl, apiKey, debug, addWorkspacePath };
}
