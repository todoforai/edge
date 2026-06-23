import os from "os";
import fs from "fs";
import path from "path";
import { spawn as nodeSpawn } from "child_process";
import { msg, type WsMessage } from "./constants.js";
import { buildEnvWithTools, autoInstallMissingTools } from "./tool-registry.js";
import { getConnectionEnv } from "./connection-context.js";
import { pauseDetector } from "./shell-pause-detector.js";
import { capLineWidth, collapseCarriageReturns, formatTruncationNotice, OUTPUT_POLICIES, DEFAULT_OUTPUT_MODE, resolveOutputPolicy, type OutputPolicy } from "../../../packages/shared-fbe/src/outputLimits";

const IS_WIN = os.platform() === "win32";
const HAS_BUN = typeof globalThis.Bun !== "undefined";
let HAS_BUN_TERMINAL = HAS_BUN && typeof Bun.Terminal === "function";

// ── Shell detection (Windows support) ──

function whichSync(name: string): string | null {
  const rawPath = process.env.PATH ?? process.env.Path ?? process.env.path ?? "";
  const dirs = rawPath.split(path.delimiter);
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

/** Directory exists and is searchable (chdir-able) by this process. */
function isAccessibleDir(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
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

// ── Output buffer — head+tail cut driven by an OutputPolicy (see outputLimits.ts) ──

class OutputBuffer {
  firstPart = "";
  lastPart = "";
  totalLen = 0;
  truncated = false;
  private truncMsgSent = false;
  // Head is capped at min(firstLimit, hardCap); the tail never pushes the kept
  // total over hardCap. `full` (firstLimit ∞) ⇒ head-only up to hardCap;
  // `safe` ⇒ 10k head + 10k tail; `raw` (hardCap ∞) ⇒ everything.
  private headLimit: number;
  private lastLimit: number;
  private lineLimit: number;
  constructor(policy: OutputPolicy = OUTPUT_POLICIES[DEFAULT_OUTPUT_MODE]) {
    this.headLimit = Math.min(policy.firstLimit, policy.hardCap);
    this.lastLimit = Math.min(policy.lastLimit, policy.hardCap - this.headLimit);
    this.lineLimit = policy.lineLimit;
  }

  append(text: string): string {
    this.totalLen += text.length;
    let toStream = "";

    if (this.firstPart.length < this.headLimit) {
      const remaining = this.headLimit - this.firstPart.length;
      toStream = text.slice(0, remaining);
      this.firstPart += toStream;
      text = text.slice(remaining);
    }

    if (text) {
      if (!this.truncated) this.truncated = true;
      // lastLimit 0 keeps nothing in the tail (head-only / capped modes).
      this.lastPart = this.lastLimit > 0 ? (this.lastPart + text).slice(-this.lastLimit) : "";
    }

    return toStream;
  }

  getTruncationNotice(): string {
    if (this.truncated && !this.truncMsgSent) {
      this.truncMsgSent = true;
      return formatTruncationNotice(this.totalLen, this.firstPart.length, this.lastPart);
    }
    return "";
  }

  /** Drop everything already returned to the caller; the next paused/exit response
   *  shows only the delta produced after this point. */
  resetForInteraction() {
    this.firstPart = "";
    this.lastPart = "";
    this.totalLen = 0;
    this.truncated = false;
    this.truncMsgSent = false;
  }

  getOutput(): string {
    if (!this.truncated) return this.format(this.firstPart);
    return this.format(this.firstPart) + `\n\n... [truncated: showing first ${this.firstPart.length} and last ${this.lastPart.length} chars of ${this.totalLen} total] ...\n\n${this.format(this.lastPart)}`;
  }

  /** Get raw output without truncation formatting. Returns null if truncated (incomplete data). */
  getRawIfComplete(): string | null {
    return this.truncated ? null : this.format(this.firstPart);
  }

  private format(part: string): string {
    return capLineWidth(collapseCarriageReturns(part), this.lineLimit);
  }
}

// ── Global state ──

type ProcHandle = { terminal?: any; proc?: any; pid: number; resetPauseWatch?: () => void };
const processes = new Map<string, ProcHandle>();
const outputBuffers = new Map<string, OutputBuffer>();
const completionResolvers = new Map<string, () => void>();
// DEAD: previously held blockIds awaiting tool-install approval before re-exec.
// export const pendingToolApprovals = new Map<string, string[]>(); // blockId -> tool names
// Output that arrived between the last paused/exit response and process exit,
// keyed by the (now-dead) pid. Drained by the next resume call on that pid.
const exitedOutputByPid = new Map<number, { output: string; returnCode: number }>();

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
  cwd: string,
  manual = false,
  runMode?: string,
  edgeId?: string,
  agentSettingsId = "",
  keepAliveOnTimeout = false,
  outputMode = DEFAULT_OUTPUT_MODE,
) {
  // Kill any existing process with the same blockId (re-run scenario)
  if (processes.has(blockId)) {
    console.log(`[shell] killing existing process for blockId=${blockId}`);
    interruptBlock(blockId);
  }

  const buf = new OutputBuffer(resolveOutputPolicy(outputMode));
  outputBuffers.set(blockId, buf);

  try {
    // Resolve cwd: expand ~ and validate, fall back to tmp dir.
    // X_OK matters: a stat-able dir without search permission makes posix_spawn's
    // chdir fail with a misleading "EACCES ... posix_spawn '/bin/bash'".
    const tmpDir = path.join(os.tmpdir(), "todoforai");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    if (cwd) {
      const expanded = cwd.replace(/^~/, process.env.HOME || "~");
      cwd = isAccessibleDir(expanded) ? expanded : tmpDir;
    } else {
      cwd = tmpDir;
    }

    // Auto-install missing catalog tools; the notice goes through the normal
    // output buffer so it lands in both the stream and the final shell result.
    const installNotice = await autoInstallMissingTools(content);
    if (installNotice) {
      const toStream = buf.append(installNotice);
      if (toStream) await send(msg.shellBlockResult(todoId, blockId, toStream, messageId));
    }

    // Notify frontend that execution is starting
    await send({
      type: "BLOCK_UPDATE",
      payload: { todoId, blockId, messageId, updates: { status: "RUNNING" } },
    });

    const effectiveRunMode = runMode || (manual ? "manual" : undefined);
    const env = {
      ...buildEnvWithTools(), ...getConnectionEnv(), NO_COLOR: "1", TERM: HAS_BUN_TERMINAL ? "xterm-256color" : "dumb",
      PAGER: "", GIT_PAGER: "", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "color.ui", GIT_CONFIG_VALUE_0: "false",
      TODOFORAI_TODO_ID: todoId, TODOFORAI_MESSAGE_ID: messageId, TODOFORAI_BLOCK_ID: blockId,
      TODOFORAI_AGENT_SETTINGS_ID: agentSettingsId,
    };

    // Resolve waiter early without killing the process (used by paused-detection and keep-alive timeout).
    const resolveAlive = () => {
      const resolver = completionResolvers.get(blockId);
      if (resolver) { resolver(); completionResolvers.delete(blockId); }
    };

    // Timeout helper. keepAliveOnTimeout=true (LLM bash with session support):
    // resolve the waiter so the caller can return paused-status, but leave the process alive.
    const startTimeout = () => setTimeout(() => {
      if (!processes.has(blockId)) return;
      if (keepAliveOnTimeout) {
        resolveAlive();
      } else {
        interruptBlock(blockId);
        send(msg.shellBlockResult(todoId, blockId, `Execution timed out after ${timeout} seconds`, messageId));
      }
    }, timeout * 1000);

    // Paused-on-stdin detector. ECHO-off (sudo/ssh/getpass) works cross-platform via the
    // PTY terminal; the Linux /proc syscall path additionally catches echo-ON line prompts.
    let cancelPauseWatch: (() => void) | null = null;
    const startPauseWatch = (pid: number, terminal?: { localFlags: number }) => {
      if (!keepAliveOnTimeout) return;
      const watcher = pauseDetector.watch(pid, () => {
        if (processes.has(blockId)) resolveAlive();
      }, terminal);
      cancelPauseWatch = watcher.cancel;
      const h = processes.get(blockId);
      if (h) h.resetPauseWatch = watcher.reset;
    };

    // Exit handler
    const onExit = async (returnCode: number, timer: ReturnType<typeof setTimeout>) => {
      clearTimeout(timer);
      cancelPauseWatch?.();
      const notice = buf.getTruncationNotice();
      if (notice) await send(msg.shellBlockResult(todoId, blockId, notice, messageId));
      await send(msg.shellBlockDone(todoId, messageId, blockId, "execute", returnCode, effectiveRunMode));
      // If the LLM has been resuming by pid and the process died between paused
      // responses, stash the residual output so the next resume call can drain it
      // instead of seeing only "no live session". No completion resolver means
      // nobody is currently awaiting — that's exactly the orphan case.
      const handle = processes.get(blockId);
      if (handle && keepAliveOnTimeout && !completionResolvers.has(blockId)) {
        const output = buf.getRawIfComplete() ?? buf.getOutput();
        if (output) exitedOutputByPid.set(handle.pid, { output, returnCode });
      }
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
      startPauseWatch(proc.pid, terminal);
      proc.exited.then((code) => {
        terminal.close();
        onExit(code ?? -1, timer);
      }).catch(() => {
        terminal.close();
        onExit(-1, timer);
      });
    };

    const spawnWithPipes = () => {
      if (HAS_BUN) {
        // Bun.spawn pipes (no TTY — interactive programs won't work)
        const proc = Bun.spawn([sc.shell, ...sc.args], {
          cwd, env, stdin: "pipe", stdout: "pipe", stderr: "pipe",
        });

        const handle: ProcHandle = { proc, pid: proc.pid };
        processes.set(blockId, handle);
        const timer = startTimeout();
        startPauseWatch(proc.pid);

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
      } else {
        // Node.js child_process fallback
        const proc = nodeSpawn(sc.shell, sc.args, {
          cwd, env: env as NodeJS.ProcessEnv, stdio: ["pipe", "pipe", "pipe"],
        });

        const handle: ProcHandle = { proc: proc as any, pid: proc.pid ?? -1 };
        processes.set(blockId, handle);
        const timer = startTimeout();
        if (proc.pid != null) startPauseWatch(proc.pid);
        let exited = false;
        const exit = (code: number) => { if (!exited) { exited = true; onExit(code, timer); } };

        proc.stdout?.on("data", (chunk: Buffer) => onData(chunk.toString()));
        proc.stderr?.on("data", (chunk: Buffer) => onData(chunk.toString()));
        proc.on("close", (code) => exit(code ?? -1));
        proc.on("error", () => exit(-1));
      }
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
    await send(msg.shellBlockResult(todoId, blockId, `Error creating process: ${e.message} (cwd: ${cwd})`, messageId));
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
  // Re-arm pause detector so the next paused state on this session fires again.
  handle.resetPauseWatch?.();

  // Auto-append newline so callers (LLM, frontend) don't need to think about it.
  // Harmless for control bytes like \x03 (Ctrl+C) — the kernel reacts to them immediately.
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

// ── Detach ──
// Reuse the keepAliveOnTimeout semantics: resolve the waiter so the in-flight
// execute_shell_command returns `{ paused: true, pid }` to the agent (wire
// field `paused` kept for older-agent compat; agent renders this as
// "detached" in the LLM footer), while the proc keeps running and output
// keeps streaming on the same blockId. No-op if nobody is currently awaiting
// completion (manual user-Run blocks have no waiter — the UI guards this by
// only surfacing the button on blocks with a live agent-managed pid).
export function detachBlock(blockId: string) {
  const resolver = completionResolvers.get(blockId);
  if (resolver) { resolver(); completionResolvers.delete(blockId); }
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
  // Release any waiter (e.g. execute_shell_command) so it doesn't hang until its own timeout.
  const resolver = completionResolvers.get(blockId);
  if (resolver) { resolver(); completionResolvers.delete(blockId); }
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

/** Get raw output if not truncated, otherwise null. Used for typed output detection (e.g., images). */
export function getBlockRawOutput(blockId: string): string | null {
  return outputBuffers.get(blockId)?.getRawIfComplete() ?? null;
}

export function clearBlockOutput(blockId: string) {
  outputBuffers.delete(blockId);
}

/** Returns true if a process is still running for the given blockId. */
export function isBlockAlive(blockId: string): boolean {
  return processes.has(blockId);
}

/** Get the OS pid for a live blockId (null if no live process). */
export function getPid(blockId: string): number | null {
  return processes.get(blockId)?.pid ?? null;
}

/** Resolve a live OS pid back to its blockId (null if no live process). */
export function findBlockIdByPid(pid: number): string | null {
  for (const [bid, h] of processes) if (h.pid === pid) return bid;
  return null;
}

/** Drain residual output for a pid whose process exited between paused responses.
 *  Returns null if nothing stashed. Consumes the entry — callers see it once. */
export function consumeExitedOutput(pid: number): { output: string; returnCode: number } | null {
  const v = exitedOutputByPid.get(pid);
  if (v) exitedOutputByPid.delete(pid);
  return v ?? null;
}
