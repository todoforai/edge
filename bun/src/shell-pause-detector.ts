// Detects when a shell process is paused on stdin (interactive prompt, read, sudo password).
// Two signals, either fires "paused":
//   1. ECHO-off on the PTY (cross-platform, Linux + macOS): getpass(3)/sudo/ssh/su disable
//      terminal echo before reading a password; raw-mode TUIs do the same while waiting for
//      keystrokes. Read straight off Bun.Terminal.localFlags (the termios c_lflag) — no /proc.
//   2. Linux only: /proc/<pid>/syscall on the foreground (leaf) descendant sitting in `read`
//      on a terminal fd (the shell's own pts, or /dev/tty). Catches echo-ON line prompts
//      (`read x`, a bare `cat`) that signal #1 misses.
// We deliberately do NOT watch poll/select/ppoll/pselect6: those fire on any socket/file
//   wait (git push, curl, npm, ssh handshake), causing false-positive paused states.

import os from "os";
import { readFile, readlink } from "fs/promises";

// POSIX termios c_lflag ECHO bit — identical value on Linux and macOS.
const ECHO = 0o10;

/** Minimal view of Bun.Terminal needed for echo-state polling. */
export interface PtyEchoState { localFlags: number }

export interface PauseWatcher {
  /** Stop watching entirely (e.g. on process exit). */
  cancel: () => void;
  /** Re-arm signalling so the next paused state fires onPaused again (call after sending stdin). */
  reset: () => void;
}

export interface PauseDetector {
  /** Start watching pid; calls onPaused() each time the process becomes stdin-blocked (after reset).
   *  Pass the PTY terminal (when spawned via Bun.Terminal) to enable cross-platform ECHO-off detection. */
  watch(pid: number, onPaused: () => void, terminal?: PtyEchoState): PauseWatcher;
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

const IS_LINUX = os.platform() === "linux" && READ_NR >= 0;

class PtyPauseDetector implements PauseDetector {
  watch(pid: number, onPaused: () => void, terminal?: PtyEchoState): PauseWatcher {
    let pausedTicks = 0;
    let signalled = false;
    let cancelled = false;
    // Session stdin = the shell's own fd 0 (e.g. /dev/pts/N or a pipe to the
    // edge). A descendant blocked on read(0) of a *different* fd 0 (an internal
    // pipeline pipe like `find | head`) is NOT stdin-blocked. Linux-only (/proc).
    let rootStdin: string | null = null;
    if (IS_LINUX) readFdTarget(pid, 0).then((t) => { rootStdin = t; });

    const tick = async () => {
      if (cancelled) return;
      // Signal 1 (cross-platform): ECHO disabled on the PTY ⇒ getpass/sudo/ssh
      // password prompt, or a raw-mode TUI parked on a keystroke. Covers sudo on
      // both Linux and macOS, where its setuid /proc is unreadable (EACCES).
      let blocked = terminal != null && !(terminal.localFlags & ECHO);
      // Signal 2 (Linux only): ANY leaf descendant parked in read() on a terminal
      // fd. Catches echo-ON line prompts (`read x`, bare `cat`) that signal 1
      // misses. Checks every pipeline branch: `inner | head` has two leaves — the
      // interactive `inner` is terminal-read-blocked while `head` sits on the
      // pipe; the predicate rejects the pipe leaf and accepts the terminal one.
      if (!blocked && IS_LINUX) {
        for (const leaf of await getLeafPids(pid)) {
          const sc = await readSyscall(leaf);
          const leafTarget = sc && sc.nr === READ_NR && sc.fd >= 0
            ? await readFdTarget(leaf, sc.fd) : null;
          if (isTerminalReadPause(sc, leafTarget, rootStdin)) { blocked = true; break; }
        }
      }
      if (blocked) {
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

/** Pure predicate: is the leaf process blocked in read() on a terminal fd?
 *  Matches:
 *    - leafTarget === rootStdin (shell's own pts; covers fd 0 prompts and any fd
 *      explicitly opened to the same pts).
 *    - leafTarget === "/dev/tty" when the shell runs in a pts (sudo/ssh open the
 *      controlling terminal on a non-0 fd; the symlink resolves to "/dev/tty").
 *  Skips:
 *    - non-read syscalls, missing/negative fds.
 *    - intra-pipeline reads where the fd points at a pipe (e.g. `find | head`).
 *    - unreadable /proc (sc === null or leafTarget === null). */
export function isTerminalReadPause(
  sc: { nr: number; fd: number } | null,
  leafTarget: string | null,
  rootStdin: string | null,
): boolean {
  if (!sc || sc.nr !== READ_NR || sc.fd < 0) return false;
  if (!leafTarget || !rootStdin) return false;
  if (leafTarget === rootStdin) return true;
  if (leafTarget === "/dev/tty" && rootStdin.startsWith("/dev/pts/")) return true;
  return false;
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

/** Collect all leaf pids in the descendant tree — every foreground branch of a
 *  pipeline (`inner | head` has two). BFS, depth-capped to bound the walk. */
async function getLeafPids(rootPid: number): Promise<number[]> {
  const leaves: number[] = [];
  let frontier = [rootPid];
  for (let depth = 0; depth < 16 && frontier.length; depth++) {
    const next: number[] = [];
    for (const pid of frontier) {
      const children = await readChildren(pid);
      if (children.length === 0) leaves.push(pid);
      else next.push(...children);
    }
    frontier = next;
  }
  // Depth cap hit with pids still pending: treat them as leaves rather than drop.
  return leaves.length ? leaves.concat(frontier) : frontier;
}

async function readChildren(pid: number): Promise<number[]> {
  try {
    const raw = await readFile(`/proc/${pid}/task/${pid}/children`, "utf-8");
    return raw.trim().split(/\s+/).filter(Boolean).map(Number);
  } catch { return []; }
}

/** Resolve /proc/<pid>/fd/<fd> to its target (e.g. "/dev/pts/13", "pipe:[12345]"). */
async function readFdTarget(pid: number, fd: number): Promise<string | null> {
  try { return await readlink(`/proc/${pid}/fd/${fd}`); } catch { return null; }
}

export const pauseDetector: PauseDetector = new PtyPauseDetector();
