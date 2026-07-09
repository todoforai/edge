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

// Whole-tree scan (like the C bridge's process-group probe): the detector must
// find the terminal-read anywhere in the tree, not just at a leaf. Linux only
// (uses the /proc syscall signal). Regression for `./server ... | head -40`.
const isLinux = process.platform === "linux";
describe.if(isLinux)("pauseDetector whole-tree scan (real process)", () => {
  // Fires iff SOME process in `cmd`'s tree parks on a terminal read within ~1.2s.
  const fires = async (cmd: string) => {
    const proc = Bun.spawn(["/bin/bash", "-c", cmd],
      { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    (async () => { for await (const _ of proc.stdout as any) { /* drain */ } })();
    let fired = false;
    const w = pauseDetector.watch(proc.pid, () => { fired = true; });
    await tick(1200); // > GRACE_TICKS * POLL_MS, enough for the tree walk
    proc.stdin!.write("x\n"); proc.stdin!.flush?.();
    proc.kill(); await proc.exited.catch(() => {}); w.cancel();
    return fired;
  };

  // The bug: interactive `inner` blocks on the tty while `head` sits on the pipe
  // (a non-leaf-only walk would inspect only `head` and miss it).
  test("read behind a pipe (`inner | head`)", async () => {
    expect(await fires("bash -c 'echo X; read t' 2>&1 | head -40")).toBe(true);
  }, 15000);

  // The shell itself blocks on `read` with a live background child — the shell
  // is NOT a leaf, so a leaf-only walk would skip it.
  test("`sleep 100 & read x` (shell blocks with a live child)", async () => {
    expect(await fires("sleep 100 & read x")).toBe(true);
  }, 15000);

  // Nothing parked on a tty read → must NOT fire (grep sits on a pipe).
  test("negative: pipe with no terminal read does not fire", async () => {
    expect(await fires("yes | head -100000000 | grep zzz")).toBe(false);
  }, 15000);
});
