import { describe, test, expect } from "bun:test";
import os from "os";
import {
  executeBlock, waitForCompletion, sendInput, getBlockOutput,
  isBlockAlive, getPid, findBlockIdByPid, consumeExitedOutput, clearBlockOutput,
} from "./shell.js";
import { FUNCTION_REGISTRY } from "./functions.js";

// Detach/resume relies on the Linux /proc syscall pause signal for echo-ON
// `read` prompts (the ECHO-off signal only covers sudo/getpass). Gate to Linux.
const linux = os.platform() === "linux";
const noop = async () => {};

describe.if(linux)("executeBlock detach + resume (real process)", () => {
  test("blocks on read → detaches alive, resume feeds stdin, exits", async () => {
    const blockId = "test-detach-1";
    await executeBlock(blockId, "echo ready; read x; echo got=$x", noop,
      "todo", "msg", 30, "", false, "internal", undefined, "", true);
    await waitForCompletion(blockId, 30000);

    // Detached while the process is still parked on `read`.
    expect(isBlockAlive(blockId)).toBe(true);
    const pid = getPid(blockId);
    expect(pid).toBeGreaterThan(0);
    expect(getBlockOutput(blockId)).toContain("ready");
    expect(findBlockIdByPid(pid!)).toBe(blockId);

    // Resume: stdin reaches the process, it finishes and exits.
    expect(await sendInput(blockId, "hello")).toBe(true);
    await waitForCompletion(blockId, 30000);
    expect(isBlockAlive(blockId)).toBe(false);
    expect(getBlockOutput(blockId)).toContain("got=hello");
    clearBlockOutput(blockId);
  }, 40000);
});

describe.if(linux)("execute_shell_command resume-by-pid", () => {
  const fn = FUNCTION_REGISTRY.get("execute_shell_command")!;
  const client = { maxTimeout: 0, sendResponse: noop } as any;

  test("fresh exec pauses, resume by pid, dead pid reports gone", async () => {
    const base = { todoId: "t", messageId: "m", blockId: "b-resume", timeout: 30 };

    const r1: any = await fn({ ...base, cmd: "echo ready; read x; echo got=$x" }, client);
    expect(r1.paused).toBe(true);
    expect(r1.pid).toBeGreaterThan(0);
    expect(r1.result).toContain("ready");

    const r2: any = await fn({ ...base, cmd: "hello", pid: r1.pid }, client);
    expect(r2.paused).toBeUndefined();
    expect(r2.result).toContain("got=hello");

    // Same pid again: session is gone → don't run `cmd` as a fresh shell.
    const r3: any = await fn({ ...base, cmd: "again", pid: r1.pid }, client);
    expect(r3.result).toMatch(/no active shell session|session pid=.*exited/);
  }, 40000);
});

describe.if(linux)("consumeExitedOutput dead-pid drain", () => {
  const fn = FUNCTION_REGISTRY.get("execute_shell_command")!;
  const client = { maxTimeout: 0, sendResponse: noop } as any;

  test("output produced after detach, before exit, is drained once on resume", async () => {
    const base = { todoId: "t", messageId: "m", blockId: "b-drain", timeout: 30 };

    // Detach while parked on read; then the process prints & exits on its own
    // (short sleep) with nobody awaiting → residual stashed by pid.
    const r1: any = await fn(
      { ...base, cmd: "echo ready; read x; echo bye; exit 7" }, client);
    expect(r1.paused).toBe(true);
    const pid = r1.pid;

    // No waitForCompletion after sending stdin ⇒ nobody awaiting, so onExit
    // stashes the residual output by pid instead of discarding it.
    await sendInput(findBlockIdByPid(pid)!, "go");
    await new Promise((r) => setTimeout(r, 400)); // flush "bye" + exit(7)

    const drained = consumeExitedOutput(pid);
    expect(drained).not.toBeNull();
    expect(drained!.output).toContain("bye");
    expect(drained!.returnCode).toBe(7);
    expect(consumeExitedOutput(pid)).toBeNull(); // consumed exactly once
  }, 40000);
});
