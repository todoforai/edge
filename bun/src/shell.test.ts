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

  // Regression: an interactive process behind a pipe (`inner | head`) must be
  // detected as paused via the OTHER pipeline leaf — not left to the full
  // timeout. This is the `./server ... 2>&1 | head -40` case.
  test("interactive read behind a pipe detaches fast (not on timeout)", async () => {
    const base = { todoId: "t", messageId: "m", blockId: "b-pipe", timeout: 20 };
    const t0 = Date.now();
    const r1: any = await fn(
      { ...base, cmd: `bash -c 'echo "Enter token:"; read tok; echo got=$tok' 2>&1 | head -40` },
      client);
    expect(r1.paused).toBe(true);
    expect(Date.now() - t0).toBeLessThan(5000); // well under the 20s timeout
    expect(r1.result).toContain("Enter token:");

    const r2: any = await fn({ ...base, cmd: "MYTOKEN", pid: r1.pid }, client);
    expect(r2.result).toContain("got=MYTOKEN");
  }, 30000);

  // A finished command that exited non-zero must tell the LLM it failed instead
  // of returning partial output as if it succeeded. Only kills get a notice;
  // ordinary non-zero exits (grep=1, diff=1) must stay clean.
  test("timeout-kill gets a notice; plain non-zero and success do not", async () => {
    const base = { todoId: "t", messageId: "m", timeout: 20 };
    const killed: any = await fn(
      { ...base, blockId: "b-timeout", cmd: "echo starting; timeout 1 sleep 5" }, client);
    expect(killed.result).toContain("starting");
    expect(killed.result).toMatch(/timed out — exit 124/);

    const nonzero: any = await fn({ ...base, blockId: "b-nonzero", cmd: "echo hi; exit 1" }, client);
    expect(nonzero.result.trim()).toBe("hi"); // exit 1, but no death → no notice

    const ok: any = await fn({ ...base, blockId: "b-ok", cmd: "echo all good" }, client);
    expect(ok.result.trim()).toBe("all good");
  }, 30000);

  // Resuming a session that gets killed after input must carry the kill notice.
  test("resume that gets killed appends a notice", async () => {
    const base = { todoId: "t", messageId: "m", blockId: "b-resume-kill", timeout: 20 };
    const r1: any = await fn(
      { ...base, cmd: "read x; echo partial; timeout 1 sleep 5" }, client);
    expect(r1.paused).toBe(true);
    const r2: any = await fn({ ...base, cmd: "go", pid: r1.pid }, client);
    expect(r2.paused).toBeUndefined();
    expect(r2.result).toContain("partial");
    expect(r2.result).toMatch(/timed out — exit 124/);
  }, 30000);
});

describe.if(linux)("detached-session output integrity", () => {
  const fn = FUNCTION_REGISTRY.get("execute_shell_command")!;
  const client = { maxTimeout: 0, sendResponse: noop } as any;

  // Regression: output produced between polls must be neither lost (the old
  // sendInput reset dropped it) nor re-returned (the old non-draining reads
  // repeated it). Poll a live ticker twice and check the concatenation.
  test("polling a live session loses nothing and repeats nothing", async () => {
    const base = { todoId: "t", messageId: "m", blockId: "b-integrity", timeout: 2 };
    const cmd = `for i in $(seq 1 8); do echo "TICK $i"; sleep 0.5; done`;

    const r1: any = await fn({ ...base, cmd }, client);
    expect(r1.paused).toBe(true);
    const r2: any = await fn({ ...base, cmd: "", pid: r1.pid }, client);
    const r3: any = await fn({ ...base, cmd: "", pid: r2.pid ?? r1.pid, timeout: 6 }, client);

    const all = (r1.result + r2.result + (r3.result ?? ""))
      .match(/TICK \d+/g) ?? [];
    expect(all).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((i) => `TICK ${i}`));
  }, 30000);

  // Regression: `pid` + empty cmd is a pure peek — it must NOT write a newline
  // to the process's stdin (the old path fed `read` an empty line).
  test("empty-cmd poll does not feed stdin", async () => {
    const base = { todoId: "t", messageId: "m", blockId: "b-peek", timeout: 5 };
    const r1: any = await fn({ ...base, cmd: "echo ready; read x; echo got=[$x]" }, client);
    expect(r1.paused).toBe(true);

    const r2: any = await fn({ ...base, cmd: "", pid: r1.pid, timeout: 2 }, client);
    expect(r2.paused).toBe(true); // still parked on read — no empty line was sent

    const r3: any = await fn({ ...base, cmd: "hi", pid: r1.pid }, client);
    expect(r3.result).toContain("got=[hi]");
  }, 30000);
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
