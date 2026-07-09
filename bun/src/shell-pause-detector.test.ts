import { describe, test, expect } from "bun:test";
import { isTerminalReadPause, pauseDetector } from "./shell-pause-detector.js";

const ECHO = 0o10;
const ECHO_ON = 35387;   // termios c_lflag with ECHO set (observed Bun.Terminal default)
const ECHO_OFF = ECHO_ON & ~ECHO;
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

// READ_NR per arch (mirrors the table in shell-pause-detector.ts).
const READ_NR: Record<string, number> = { x64: 0, arm64: 63, arm: 3, ia32: 3 };
const NR = READ_NR[process.arch] ?? 0;

const sc = (nr: number, fd: number) => ({ nr, fd });

describe("isTerminalReadPause", () => {
  test("read(fd=0) on shell's own pts → paused", () => {
    expect(isTerminalReadPause(sc(NR, 0), "/dev/pts/3", "/dev/pts/3")).toBe(true);
  });

  test("read(fd=0) on a pipe (intra-pipeline) → not paused", () => {
    expect(isTerminalReadPause(sc(NR, 0), "pipe:[12345]", "/dev/pts/3")).toBe(false);
  });

  test("read(fd=3) on /dev/tty with shell on pts → paused (sudo password)", () => {
    expect(isTerminalReadPause(sc(NR, 3), "/dev/tty", "/dev/pts/1")).toBe(true);
  });

  test("read(fd=4) on /dev/tty when shell stdin is a pipe → not paused", () => {
    // Edge runs without controlling pts; matching /dev/tty would be a false positive.
    expect(isTerminalReadPause(sc(NR, 4), "/dev/tty", "pipe:[99]")).toBe(false);
  });

  test("non-read syscall → not paused", () => {
    expect(isTerminalReadPause(sc(NR + 1, 0), "/dev/pts/3", "/dev/pts/3")).toBe(false);
  });

  test("negative fd → not paused", () => {
    expect(isTerminalReadPause(sc(NR, -1), "/dev/pts/3", "/dev/pts/3")).toBe(false);
  });

  test("null syscall (unreadable /proc/<pid>/syscall) → not paused", () => {
    // ptrace_scope / hidepid / setuid-root sudo: graceful, no crash, no false fire.
    expect(isTerminalReadPause(null, "/dev/pts/3", "/dev/pts/3")).toBe(false);
  });

  test("null leafTarget (unreadable /proc/<pid>/fd/<fd>) → not paused", () => {
    expect(isTerminalReadPause(sc(NR, 0), null, "/dev/pts/3")).toBe(false);
  });

  test("null rootStdin (shell's stdin not yet resolved) → not paused", () => {
    expect(isTerminalReadPause(sc(NR, 0), "/dev/pts/3", null)).toBe(false);
  });

  test("leaf reading a regular file on its fd 0 → not paused", () => {
    expect(isTerminalReadPause(sc(NR, 0), "/tmp/input.txt", "/dev/pts/3")).toBe(false);
  });

  test("leaf reading a socket → not paused", () => {
    expect(isTerminalReadPause(sc(NR, 5), "socket:[7890]", "/dev/pts/3")).toBe(false);
  });
});

// Watcher-level ECHO detection (cross-platform sudo/getpass path). Uses a fake
// pid (no /proc match) so only the terminal ECHO signal can fire — same path on
// macOS where the Linux syscall branch is inert.
describe("pauseDetector ECHO-off (cross-platform)", () => {
  test("ECHO off on the PTY → onPaused fires", async () => {
    let fired = false;
    const term = { localFlags: ECHO_OFF };
    const w = pauseDetector.watch(2 ** 30, () => { fired = true; }, term);
    await tick(900); // > GRACE_TICKS * POLL_MS
    w.cancel();
    expect(fired).toBe(true);
  });

  test("ECHO on → onPaused does not fire", async () => {
    let fired = false;
    const term = { localFlags: ECHO_ON };
    const w = pauseDetector.watch(2 ** 30, () => { fired = true; }, term);
    await tick(900);
    w.cancel();
    expect(fired).toBe(false);
  });

  test("reset() re-arms after a fire", async () => {
    let count = 0;
    const term = { localFlags: ECHO_OFF };
    const w = pauseDetector.watch(2 ** 30, () => { count++; }, term);
    await tick(900);
    expect(count).toBe(1);
    w.reset();
    await tick(900);
    w.cancel();
    expect(count).toBe(2);
  });
});

// Multi-leaf pipeline: `inner | head` has two foreground leaves — the
// interactive `inner` parked on the tty read, and `head` on the pipe. The
// detector must inspect BOTH and fire on the terminal-read leaf. Linux only
// (uses the /proc syscall signal). Regression for `./server ... | head -40`.
const isLinux = process.platform === "linux";
describe.if(isLinux)("pauseDetector pipeline leaf (real process)", () => {
  test("read behind a pipe (`inner | head`) fires paused", async () => {
    const proc = Bun.spawn(
      ["/bin/bash", "-c", "bash -c 'echo X; read t; echo got=$t' 2>&1 | head -40"],
      { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    (async () => { for await (const _ of proc.stdout as any) { /* drain */ } })();

    let fired = false;
    const w = pauseDetector.watch(proc.pid, () => { fired = true; });
    await tick(1200); // > GRACE_TICKS * POLL_MS, enough for tree walk
    expect(fired).toBe(true);

    proc.stdin!.write("hi\n"); proc.stdin!.flush?.();
    await proc.exited;
    w.cancel();
  }, 15000);
});
