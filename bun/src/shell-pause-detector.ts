// Detects when a shell process is paused on stdin (interactive prompt, read, sudo password).
// Linux: poll /proc/<pid>/syscall on the foreground (leaf) descendant — if it sits in the
//   `read` syscall on fd 0 (stdin) for several ticks, the process is stdin-blocked.
// We deliberately do NOT watch poll/select/ppoll/pselect6: those fire on any socket/file
//   wait (git push, curl, npm, ssh handshake), causing false-positive paused states.
// Other platforms: NullDetector — paused state only via the wall-clock timeout.

import os from "os";
import { readFile } from "fs/promises";

export interface PauseWatcher {
  /** Stop watching entirely (e.g. on process exit). */
  cancel: () => void;
  /** Re-arm signalling so the next paused state fires onPaused again (call after sending stdin). */
  reset: () => void;
}

export interface PauseDetector {
  /** Start watching pid; calls onPaused() each time the process becomes stdin-blocked (after reset). */
  watch(pid: number, onPaused: () => void): PauseWatcher;
}

class NullDetector implements PauseDetector {
  watch(): PauseWatcher { return { cancel: () => {}, reset: () => {} }; }
}

// Linux `read` syscall number per arch. Only `read` — poll/select wait on arbitrary fds
// (sockets, pipes), so they're not reliable indicators of stdin-blocked.
// Sources: include/uapi/asm-generic/unistd.h and arch-specific tables.
const READ_SYSCALL_NR: Record<string, number> = {
  x64:   0,
  arm64: 63,
  arm:   3,
  ia32:  3,
};
const READ_NR = READ_SYSCALL_NR[process.arch] ?? -1;

const POLL_MS = 250;
const GRACE_TICKS = 2; // require N consecutive paused readings (~500ms) before firing

class LinuxSyscallDetector implements PauseDetector {
  watch(pid: number, onPaused: () => void): PauseWatcher {
    let pausedTicks = 0;
    let signalled = false;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const fgPid = await getForegroundPid(pid);
      const sc = fgPid != null ? await readSyscall(fgPid) : null;
      // Only treat as paused if blocked in read() on fd 0 (stdin).
      if (sc && sc.nr === READ_NR && sc.fd === 0) {
        if (!signalled && ++pausedTicks >= GRACE_TICKS) {
          signalled = true;
          onPaused();
        }
      } else {
        pausedTicks = 0;
      }
      setTimeout(tick, POLL_MS);
    };
    setTimeout(tick, POLL_MS);

    return {
      cancel: () => { cancelled = true; },
      reset: () => { signalled = false; pausedTicks = 0; },
    };
  }
}

/** Parse /proc/<pid>/syscall — format: "<nr> <arg0> <arg1> ... <sp> <pc>".
 *  For read(), arg0 is the fd. Returns null if not in a syscall ("running"/"-1"). */
async function readSyscall(pid: number): Promise<{ nr: number; fd: number } | null> {
  try {
    const raw = (await readFile(`/proc/${pid}/syscall`, "utf-8")).trim();
    const parts = raw.split(/\s+/);
    const nr = parseInt(parts[0], 10);
    if (!Number.isFinite(nr) || nr < 0) return null;
    // arg0 is hex (e.g. "0x0"); parseInt with base 16 after stripping "0x".
    const fd = parts[1] ? parseInt(parts[1].replace(/^0x/, ""), 16) : -1;
    return { nr, fd: Number.isFinite(fd) ? fd : -1 };
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
  os.platform() === "linux" && READ_NR >= 0
    ? new LinuxSyscallDetector()
    : new NullDetector();
