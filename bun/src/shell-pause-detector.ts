// Detects when a shell process is paused on stdin (interactive prompt, read, sudo password).
// Linux: poll /proc/<pid>/syscall on the foreground (leaf) descendant — if it sits in the
//   `read` syscall (or `poll`/`select` family) for several ticks, the process is stdin-blocked.
// Other platforms: NullDetector — paused state only via the wall-clock timeout.

import os from "os";
import { readFile } from "fs/promises";

export interface PauseDetector {
  /** Start watching pid; calls onPaused() once when the process becomes stdin-blocked. Returns cancel fn. */
  watch(pid: number, onPaused: () => void): () => void;
}

class NullDetector implements PauseDetector {
  watch(): () => void { return () => {}; }
}

// Linux syscall numbers that indicate "blocked on input" for the watched arch.
// Sources: include/uapi/asm-generic/unistd.h and arch-specific tables.
// Keep the set conservative — only "read", "pselect6", "ppoll", "poll", "select".
const SYSCALL_TABLES: Record<string, Set<number>> = {
  x64:     new Set([0, 7, 23, 270, 271]),   // read, poll, select, pselect6, ppoll
  arm64:   new Set([63, 72, 73]),           // read, pselect6, ppoll
  arm:     new Set([3, 142, 168, 335, 336]),
  ia32:    new Set([3, 142, 168, 308, 309]),
};
const READ_SYSCALLS = SYSCALL_TABLES[process.arch] ?? new Set<number>();

const POLL_MS = 250;
const GRACE_TICKS = 2; // require N consecutive paused readings (~500ms) before firing

class LinuxSyscallDetector implements PauseDetector {
  watch(pid: number, onPaused: () => void): () => void {
    let pausedTicks = 0;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const fgPid = await getForegroundPid(pid);
      const sc = fgPid != null ? await readSyscallNum(fgPid) : null;
      if (sc != null && READ_SYSCALLS.has(sc)) {
        if (++pausedTicks >= GRACE_TICKS) {
          cancelled = true;
          onPaused();
          return;
        }
      } else {
        pausedTicks = 0;
      }
      setTimeout(tick, POLL_MS);
    };
    setTimeout(tick, POLL_MS);

    return () => { cancelled = true; };
  }
}

/** First token of /proc/<pid>/syscall — the current syscall number (or "running"/"-1" if not in a syscall). */
async function readSyscallNum(pid: number): Promise<number | null> {
  try {
    const raw = (await readFile(`/proc/${pid}/syscall`, "utf-8")).trim();
    const first = raw.split(/\s+/)[0];
    const n = parseInt(first, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch { return null; }
}

/** Walk the descendant tree, return the deepest (leaf) pid — the actual foreground process. */
async function getForegroundPid(rootPid: number): Promise<number | null> {
  let current = rootPid;
  for (let depth = 0; depth < 16; depth++) {
    const children = await readChildren(current);
    if (children.length === 0) return current;
    current = children[children.length - 1]; // last spawned child
  }
  return current;
}

async function readChildren(pid: number): Promise<number[]> {
  try {
    const raw = await readFile(`/proc/${pid}/task/${pid}/children`, "utf-8");
    return raw.trim().split(/\s+/).filter(Boolean).map(Number);
  } catch { return []; }
}

export const pauseDetector: PauseDetector =
  os.platform() === "linux" && READ_SYSCALLS.size > 0
    ? new LinuxSyscallDetector()
    : new NullDetector();
