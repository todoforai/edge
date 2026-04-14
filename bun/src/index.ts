import { loadConfig } from "./config.js";
import { TODOforAIEdge, setGlobalEdgeInstance } from "./edge.js";
import { unmountAllRclone } from "./tool-registry.js";
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

function isEdgeProcess(pid: number): boolean {
  try {
    process.kill(pid, 0); // throws if not alive
    const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, "utf-8");
    return cmdline.includes("index.ts") || cmdline.includes("todoforai-edge");
  } catch { return false; }
}

function killExistingEdge(lp: string): boolean {
  try {
    const pid = parseInt(fs.readFileSync(lp, "utf-8").trim(), 10);
    if (!isNaN(pid) && isEdgeProcess(pid)) {
      console.log(`\x1b[33mKilling existing edge process (pid ${pid})...\x1b[0m`);
      process.kill(pid, "SIGTERM");
      // Wait up to 3s for graceful shutdown
      for (let i = 0; i < 30; i++) {
        try { process.kill(pid, 0); } catch { break; }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      }
      // Force kill if still alive
      try { process.kill(pid, "SIGKILL"); } catch {}
      console.log(`\x1b[32mKilled.\x1b[0m`);
      return true;
    }
  } catch {}
  return false;
}

function acquireLock(lp: string, kill = false): boolean {
  try {
    const pid = parseInt(fs.readFileSync(lp, "utf-8").trim(), 10);
    if (!isNaN(pid) && isEdgeProcess(pid)) {
      if (kill) { killExistingEdge(lp); }
      else return false;
    }
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
  setGlobalEdgeInstance(edge);
  await edge.ensureApiKey(true);

  const lp = lockPath(config.apiUrl, edge.userId);
  if (!acquireLock(lp, config.kill)) {
    console.error("\x1b[31mAnother edge is already running for this user+server. Use --kill to replace it.\x1b[0m");
    process.exit(1);
  }
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    edge.stop();
    unmountAllRclone();
    releaseLock(lp);
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  await edge.start();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
