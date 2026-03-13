import { loadConfig } from "./config.js";
import { TODOforAIEdge, setGlobalEdgeInstance } from "./edge.js";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

// ── Single-instance lock (per user+url) ──

function lockPath(apiUrl: string, userId: string): string {
  const dir = path.join(os.homedir(), ".todoforai");
  fs.mkdirSync(dir, { recursive: true });
  const hash = crypto.createHash("sha256").update(`${apiUrl}\n${userId}`).digest("hex").slice(0, 12);
  return path.join(dir, `edge-${hash}.lock`);
}

function acquireLock(lp: string): boolean {
  try {
    const pid = parseInt(fs.readFileSync(lp, "utf-8").trim(), 10);
    if (!isNaN(pid)) { process.kill(pid, 0); return false; } // alive
  } catch {}
  fs.writeFileSync(lp, String(process.pid));
  return true;
}

function releaseLock(lp: string) {
  try { if (fs.readFileSync(lp, "utf-8").trim() === String(process.pid)) fs.unlinkSync(lp); } catch {}
}

async function main() {
  const config = await loadConfig();

  if (config.debug) {
    console.log("[config]", { apiUrl: config.apiUrl, debug: config.debug, addWorkspacePath: config.addWorkspacePath });
  }

  const edge = new TODOforAIEdge(config);
  await edge.ensureApiKey(true);

  const lp = lockPath(config.apiUrl, edge.userId);
  if (!acquireLock(lp)) {
    console.error("\x1b[31mAnother edge is already running for this user+server. Exiting.\x1b[0m");
    process.exit(1);
  }
  const cleanup = () => releaseLock(lp);
  process.on("exit", cleanup);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  await edge.start();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
