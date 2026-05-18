import { describe, test, expect } from "bun:test";
import { isTerminalReadPause } from "./shell-pause-detector.js";

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
