import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { startTracking, setFileTrackingEnabled } from "./file-change-tracker.js";
import type { WsMessage } from "./constants.js";

let repo: string;
const ids = { todoId: "t1", blockId: "b1", messageId: "m1" };

function sh(cmd: string) { execSync(cmd, { cwd: repo, stdio: "pipe" }); }

/** Reported paths are absolute, anchored at git's toplevel (symlinks resolved). */
function abs(name: string) { return path.join(fs.realpathSync(repo), name); }

async function run(mutate: () => void): Promise<WsMessage[]> {
  const tracker = startTracking(repo)!;
  await tracker.ready;
  mutate();
  const sent: WsMessage[] = [];
  await tracker.finish(async (m) => { sent.push(m); }, ids);
  return sent;
}


beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "fct-"));
  sh("git init -q && git config user.email t@t && git config user.name t");
  fs.writeFileSync(path.join(repo, "a.txt"), "hello\nworld\n");
  sh("git add . && git commit -qm init");
  setFileTrackingEnabled(true);
});

afterEach(() => {
  setFileTrackingEnabled(false);
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("file-change-tracker", () => {
  test("disabled → no tracker", () => {
    setFileTrackingEnabled(false);
    expect(startTracking(repo)).toBeNull();
  });

  test("sed-style edit reports original + modified", async () => {
    const sent = await run(() => fs.writeFileSync(path.join(repo, "a.txt"), "hi\nworld\n"));
    expect(sent.length).toBe(1);
    const changes = sent[0]!.payload.updates.fileChanges;
    expect(changes).toEqual([{ path: abs("a.txt"), originalContent: "hello\nworld\n", modifiedContent: "hi\nworld\n" }]);
  });

  test("new untracked file: original=null", async () => {
    const sent = await run(() => fs.writeFileSync(path.join(repo, "new.txt"), "fresh\n"));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("new.txt"), originalContent: null, modifiedContent: "fresh\n" }]);
  });

  test("deleted file: modified=null", async () => {
    const sent = await run(() => fs.unlinkSync(path.join(repo, "a.txt")));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("a.txt"), originalContent: "hello\nworld\n", modifiedContent: null }]);
  });

  test("pre-dirty file: original = pre-command dirty content, not HEAD", async () => {
    fs.writeFileSync(path.join(repo, "a.txt"), "dirty\n"); // dirty before command
    const sent = await run(() => fs.writeFileSync(path.join(repo, "a.txt"), "dirtier\n"));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("a.txt"), originalContent: "dirty\n", modifiedContent: "dirtier\n" }]);
  });

  test("no changes → no message", async () => {
    expect(await run(() => {})).toEqual([]);
  });

  test("dirty but untouched file → not reported", async () => {
    fs.writeFileSync(path.join(repo, "a.txt"), "dirty\n");
    const sent = await run(() => fs.writeFileSync(path.join(repo, "b.txt"), "other\n"));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("b.txt"), originalContent: null, modifiedContent: "other\n" }]);
  });

  test("git checkout (HEAD move) → nothing reported", async () => {
    fs.writeFileSync(path.join(repo, "a.txt"), "v2\n");
    sh("git commit -qam v2");
    expect(await run(() => sh("git checkout -q HEAD~1"))).toEqual([]);
  });

  test("non-git dir → inert, no throw", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fct-nogit-"));
    const tracker = startTracking(dir)!;
    const sent: WsMessage[] = [];
    await tracker.finish(async (m) => { sent.push(m); }, ids);
    expect(sent).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("binary file → null contents", async () => {
    const sent = await run(() => fs.writeFileSync(path.join(repo, "bin.dat"), Buffer.from([1, 0, 2, 0])));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("bin.dat"), originalContent: null, modifiedContent: null }]);
  });

  test("staged rename reports destination + source deletion", async () => {
    const sent = await run(() => sh("git mv a.txt b.txt"));
    const changes = sent[0]!.payload.updates.fileChanges;
    expect(changes).toContainEqual({ path: abs("b.txt"), originalContent: null, modifiedContent: "hello\nworld\n" });
    expect(changes).toContainEqual({ path: abs("a.txt"), originalContent: "hello\nworld\n", modifiedContent: null });
  });

  test("paths with spaces and quotes", async () => {
    const name = `we ird "quoted".txt`;
    const sent = await run(() => fs.writeFileSync(path.join(repo, name), "x\n"));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs(name), originalContent: null, modifiedContent: "x\n" }]);
  });

  test("pre-dirty binary changed → reported (via stat signature)", async () => {
    const p = path.join(repo, "bin.dat");
    fs.writeFileSync(p, Buffer.from([1, 0]));
    const sent = await run(() => fs.writeFileSync(p, Buffer.from([9, 0, 9])));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("bin.dat"), originalContent: null, modifiedContent: null }]);
  });

  test("pre-dirty binary untouched → not reported", async () => {
    fs.writeFileSync(path.join(repo, "bin.dat"), Buffer.from([1, 0]));
    const sent = await run(() => fs.writeFileSync(path.join(repo, "b.txt"), "y\n"));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("b.txt"), originalContent: null, modifiedContent: "y\n" }]);
  });

  test("symlink is not followed", async () => {
    const secret = path.join(os.tmpdir(), `fct-secret-${Date.now()}`);
    fs.writeFileSync(secret, "SECRET\n");
    const sent = await run(() => fs.symlinkSync(secret, path.join(repo, "link")));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("link"), originalContent: null, modifiedContent: null }]);
    fs.rmSync(secret, { force: true });
  });
});
