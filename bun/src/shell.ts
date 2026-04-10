import os from "os";
import fs from "fs";
import path from "path";
import { msg, type WsMessage } from "./constants.js";
import { findMissingTools, ensureTool, buildEnvWithTools } from "./tool-registry.js";

const IS_WIN = os.platform() === "win32";
let HAS_BUN_TERMINAL = typeof Bun.Terminal === "function";

// ── Shell detection (Windows support) ──

function whichSync(name: string): string | null {
  const dirs = (process.env.PATH || "").split(path.delimiter);
  const exts = IS_WIN ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const full = path.join(dir, name + ext);
      try {
        fs.accessSync(full, fs.constants.X_OK);
        return full;
      } catch {}
    }
  }
  return null;
}

interface ShellCommand { shell: string; args: string[] }

function getShellCommand(content: string): ShellCommand {
  if (!IS_WIN) return { shell: "/bin/bash", args: ["-c", content] };

  const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
  if (fs.existsSync(gitBash)) return { shell: gitBash, args: ["-c", content] };

  const bashPath = whichSync("bash");
  if (bashPath) return { shell: bashPath, args: ["-c", content] };

  const psPath = whichSync("powershell") || whichSync("pwsh");
  if (psPath) {
    const psPrefix = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8;\n";
    return { shell: psPath, args: ["-NoProfile", "-Command", psPrefix + content] };
  }

  return { shell: "cmd.exe", args: ["/c", "chcp 65001>nul && " + content] };
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

type ProcHandle = { terminal?: any; proc?: any; pid: number };
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
  edgeId?: string,
) {
  // Kill any existing process with the same blockId (re-run scenario)
  if (processes.has(blockId)) {
    console.log(`[shell] killing existing process for blockId=${blockId}`);
    interruptBlock(blockId);
  }

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
            approvalContext: { source: "edge", toolInstalls: missing, workspace: cwd, edgeId },
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

    // Notify frontend that execution is starting
    await send({
      type: "BLOCK_UPDATE",
      payload: { todoId, blockId, messageId, updates: { status: "RUNNING" } },
    });

    const effectiveRunMode = runMode || (manual ? "manual" : undefined);
    const env = {
      ...buildEnvWithTools(), NO_COLOR: "1", TERM: HAS_BUN_TERMINAL ? "xterm-256color" : "dumb",
      PAGER: "", GIT_PAGER: "", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "color.ui", GIT_CONFIG_VALUE_0: "false",
    };

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

    const sc = getShellCommand(content);

    const spawnWithPty = () => {
      // PTY mode via Bun.Terminal (interactive, sudo/ssh support)
      // Pass terminal config inline so Bun sets up setsid+TIOCSCTTY (controlling terminal).
      // Pre-creating Bun.Terminal and passing it skips controlling terminal setup.
      const decoder = new TextDecoder();
      const proc = Bun.spawn([sc.shell, ...sc.args], {
        cwd, env,
        terminal: {
          cols: 200, rows: 50,
          data(_term: any, data: any) {
            const text = typeof data === "string" ? data : decoder.decode(data, { stream: true });
            onData(text);
          },
        },
      });
      const terminal = proc.terminal!;
      const handle: ProcHandle = { terminal, proc, pid: proc.pid };
      processes.set(blockId, handle);
      const timer = startTimeout();
      proc.exited.then((code) => {
        terminal.close();
        onExit(code ?? -1, timer);
      }).catch(() => {
        terminal.close();
        onExit(-1, timer);
      });
    };

    const spawnWithPipes = () => {
      // Bun.spawn pipes (no TTY — interactive programs won't work)
      const proc = Bun.spawn([sc.shell, ...sc.args], {
        cwd, env, stdin: "pipe", stdout: "pipe", stderr: "pipe",
      });

      const handle: ProcHandle = { proc, pid: proc.pid };
      processes.set(blockId, handle);
      const timer = startTimeout();

      const pipeStream = async (stream: ReadableStream<Uint8Array> | null) => {
        if (!stream) return;
        const decoder = new TextDecoder();
        for await (const chunk of stream) {
          await onData(decoder.decode(chunk, { stream: true }));
        }
      };

      Promise.all([
        pipeStream(proc.stdout as ReadableStream<Uint8Array>),
        pipeStream(proc.stderr as ReadableStream<Uint8Array>),
        proc.exited,
      ]).then(([, , code]) => onExit(code ?? -1, timer))
        .catch(() => onExit(-1, timer));
    };

    if (HAS_BUN_TERMINAL) {
      try {
        spawnWithPty();
      } catch {
        HAS_BUN_TERMINAL = false;
        spawnWithPipes();
      }
    } else {
      spawnWithPipes();
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

  if (handle.terminal) {
    handle.terminal.write(text);
  } else if (handle.proc?.stdin) {
    handle.proc.stdin.write(text);
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
    if (handle.proc) {
      handle.proc.kill(2); // SIGINT
      setTimeout(() => {
        try { handle.proc?.kill(15); } catch {} // SIGTERM
        setTimeout(() => {
          try { handle.proc?.kill(9); } catch {} // SIGKILL
        }, 500);
      }, 1000);
    }
  } catch {
    try { handle.proc?.kill(9); } catch {}
  }
  // Close terminal after process is killed
  try { handle.terminal?.close(); } catch {}
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
