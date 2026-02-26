import { spawn, type ChildProcess } from "child_process";
import os from "os";
import fs from "fs";
import path from "path";
import { msg, type WsMessage } from "./constants.js";
import { findMissingTools, ensureTool, buildEnvWithTools } from "./tool-registry.js";

// Lazy-load node-pty so the module doesn't crash if native addon isn't built
let ptySpawn: typeof import("node-pty").spawn | null = null;
type IPty = import("node-pty").IPty;
try {
  ptySpawn = require("node-pty").spawn;
} catch {
  // Will fall back to child_process
}

// ── Output buffer (first 10k stream, middle truncate, last 10k) ──

const STREAM_FIRST = 10_000;
const STREAM_LAST = 10_000;

class OutputBuffer {
  firstPart = "";
  lastPart = "";
  totalLen = 0;
  truncated = false;
  private truncMsgSent = false;
  private savedSegments: string[] = [];
  constructor(private firstLimit = STREAM_FIRST, private lastLimit = STREAM_LAST) {}

  append(text: string): string {
    this.totalLen += text.length;
    let toStream = "";

    if (this.firstPart.length < this.firstLimit) {
      const remaining = this.firstLimit - this.firstPart.length;
      toStream = text.slice(0, remaining);
      this.firstPart += toStream;
      text = text.slice(remaining);
    }

    if (text) {
      if (!this.truncated) this.truncated = true;
      this.lastPart = (this.lastPart + text).slice(-this.lastLimit);
    }

    return toStream;
  }

  getTruncationNotice(): string {
    if (this.truncated && !this.truncMsgSent) {
      this.truncMsgSent = true;
      const dropped = this.totalLen - this.firstLimit - this.lastPart.length;
      return `\n\n... [truncated ${dropped} chars] ...\n\n${this.lastPart}`;
    }
    return "";
  }

  resetForInteraction() {
    if (this.firstPart || this.lastPart) {
      let segment = this.firstPart;
      if (this.truncated) {
        const dropped = this.totalLen - this.firstPart.length - this.lastPart.length;
        segment += `\n... [truncated ${dropped} chars] ...\n${this.lastPart}`;
      }
      this.savedSegments.push(segment);
    }
    this.firstPart = "";
    this.lastPart = "";
    this.totalLen = 0;
    this.truncated = false;
    this.truncMsgSent = false;
  }

  getOutput(): string {
    let current = this.firstPart;
    if (this.truncated) {
      current += `\n\n... [truncated: showing first ${this.firstPart.length} and last ${this.lastPart.length} chars of ${this.totalLen} total] ...\n\n${this.lastPart}`;
    }
    const all = current ? [...this.savedSegments, current] : [...this.savedSegments];
    return all.join("\n");
  }
}

// ── Global state ──

type ProcHandle = { pty?: IPty; child?: ChildProcess; pid: number };
const processes = new Map<string, ProcHandle>();
const outputBuffers = new Map<string, OutputBuffer>();
const completionResolvers = new Map<string, () => void>();
export const pendingToolApprovals = new Map<string, string[]>(); // blockId -> tool names

export interface SendFn {
  (message: WsMessage): Promise<void>;
}

// ── Execute block ──

export async function executeBlock(
  blockId: string,
  content: string,
  send: SendFn,
  todoId: string,
  messageId: string,
  timeout: number,
  rootPath: string,
  manual = false,
  runMode?: string,
) {
  const buf = new OutputBuffer();
  outputBuffers.set(blockId, buf);

  try {
    // Determine cwd
    const tmpDir = path.join(os.tmpdir(), "todoforai");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    let cwd = tmpDir;
    if (rootPath) {
      const expanded = rootPath.replace(/^~/, process.env.HOME || "~");
      if (fs.existsSync(expanded) && fs.statSync(expanded).isDirectory()) cwd = expanded;
    }

    // Check for missing tools — request approval before executing
    const missing = findMissingTools(content);
    if (missing.length && !pendingToolApprovals.has(blockId)) {
      pendingToolApprovals.set(blockId, missing);
      console.log(`[shell] Missing tools ${missing}, requesting approval for block ${blockId}`);
      await send({
        type: "BLOCK_UPDATE",
        payload: {
          todoId, blockId, messageId,
          updates: {
            status: "AWAITING_APPROVAL",
            approvalContext: { source: "edge", toolInstalls: missing, workspace: cwd },
          },
        },
      });
      return; // wait for re-execute after approval
    }

    // Re-execute after approval — install the approved tools
    if (pendingToolApprovals.has(blockId)) {
      const tools = pendingToolApprovals.get(blockId)!;
      pendingToolApprovals.delete(blockId);
      const installed: string[] = [];
      for (const t of tools) {
        if (await ensureTool(t)) installed.push(t);
      }
      if (installed.length) {
        const notice = `[installed: ${installed.join(", ")}]\n`;
        await send(msg.shellBlockResult(todoId, blockId, notice, messageId));
      }
    }

    const effectiveRunMode = runMode || (manual ? "manual" : undefined);
    const env = { ...buildEnvWithTools(), NO_COLOR: "1", TERM: "dumb" };

    // Timeout helper
    const startTimeout = () => setTimeout(() => {
      if (processes.has(blockId)) {
        interruptBlock(blockId);
        send(msg.shellBlockResult(todoId, blockId, `Execution timed out after ${timeout} seconds`, messageId));
      }
    }, timeout * 1000);

    // Exit handler
    const onExit = async (returnCode: number, timer: ReturnType<typeof setTimeout>) => {
      clearTimeout(timer);
      const notice = buf.getTruncationNotice();
      if (notice) await send(msg.shellBlockResult(todoId, blockId, notice, messageId));
      await send(msg.shellBlockDone(todoId, messageId, blockId, "execute", returnCode, effectiveRunMode));
      processes.delete(blockId);
      const resolver = completionResolvers.get(blockId);
      if (resolver) { resolver(); completionResolvers.delete(blockId); }
    };

    // Data handler
    const onData = async (data: string) => {
      const toStream = buf.append(data);
      if (toStream) await send(msg.shellBlockResult(todoId, blockId, toStream, messageId));
    };

    if (ptySpawn) {
      // PTY mode (interactive, sudo support)
      const pty = ptySpawn("/bin/bash", ["-c", content], {
        name: "xterm", cols: 200, rows: 50, cwd, env,
      });
      const handle: ProcHandle = { pty, pid: pty.pid };
      processes.set(blockId, handle);
      pty.onData(onData);
      const timer = startTimeout();
      pty.onExit(async ({ exitCode }) => onExit(exitCode ?? -1, timer));
    } else {
      // Fallback: child_process pipes
      const proc = spawn("/bin/bash", ["-c", content], {
        cwd, stdio: ["pipe", "pipe", "pipe"], detached: true, env,
      });
      const handle: ProcHandle = { child: proc, pid: proc.pid! };
      processes.set(blockId, handle);
      proc.stdout?.on("data", (d: Buffer) => onData(d.toString("utf-8")));
      proc.stderr?.on("data", (d: Buffer) => onData(d.toString("utf-8")));
      const timer = startTimeout();
      proc.on("close", (code) => onExit(code ?? -1, timer));
      proc.on("error", (err) => {
        send(msg.shellBlockResult(todoId, blockId, `Process error: ${err.message}`, messageId));
        onExit(-1, timer);
      });
    }
  } catch (e: any) {
    await send(msg.shellBlockResult(todoId, blockId, `Error creating process: ${e.message}`, messageId));
    const resolver = completionResolvers.get(blockId);
    if (resolver) {
      resolver();
      completionResolvers.delete(blockId);
    }
  }
}

// ── Send input ──

export async function sendInput(blockId: string, text: string): Promise<boolean> {
  const handle = processes.get(blockId);
  if (!handle) return false;

  const buf = outputBuffers.get(blockId);
  if (buf) buf.resetForInteraction();

  if (!text.endsWith("\n")) text += "\n";

  if (handle.pty) {
    handle.pty.write(text);
  } else if (handle.child?.stdin && !handle.child.stdin.destroyed) {
    handle.child.stdin.write(text);
  } else {
    return false;
  }
  return true;
}

// ── Interrupt ──

export function interruptBlock(blockId: string) {
  const handle = processes.get(blockId);
  if (!handle) return;

  try {
    if (handle.pty) {
      handle.pty.kill("SIGINT");
      // Give it a moment, then force
      setTimeout(() => {
        try { handle.pty?.kill("SIGTERM"); } catch {}
        setTimeout(() => {
          try { handle.pty?.kill("SIGKILL"); } catch {}
        }, 500);
      }, 1000);
    } else {
      process.kill(-handle.pid, "SIGINT");
    }
  } catch {
    try {
      if (handle.pty) handle.pty.kill("SIGKILL");
      else if (handle.child) handle.child.kill("SIGKILL");
    } catch {}
  }
  processes.delete(blockId);
}

// ── Helpers for execute_shell_command function ──

export function waitForCompletion(blockId: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!processes.has(blockId)) return resolve();
    completionResolvers.set(blockId, resolve);
    setTimeout(() => {
      if (completionResolvers.has(blockId)) {
        completionResolvers.delete(blockId);
        resolve();
      }
    }, timeoutMs);
  });
}

export function getBlockOutput(blockId: string): string {
  return outputBuffers.get(blockId)?.getOutput() ?? "";
}

export function clearBlockOutput(blockId: string) {
  outputBuffers.delete(blockId);
}
