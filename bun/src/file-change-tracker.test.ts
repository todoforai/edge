import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { startTracking, setFileTrackingEnabled, noteFileToolWrite } from "./file-change-tracker.js";
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
    expect(changes).toEqual([{ path: abs("a.txt"), originalContent: "hello\nworld\n", modifiedContent: "hi\nworld\n", status: "modified", size: 9 }]);
  });

  test("new untracked file: original=null, status=created", async () => {
    const sent = await run(() => fs.writeFileSync(path.join(repo, "new.txt"), "fresh\n"));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("new.txt"), originalContent: null, modifiedContent: "fresh\n", status: "created", size: 6 }]);
  });

  test("deleted file: modified=null, status=deleted", async () => {
    const sent = await run(() => fs.unlinkSync(path.join(repo, "a.txt")));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("a.txt"), originalContent: "hello\nworld\n", modifiedContent: null, status: "deleted", size: 12 }]);
  });

  test("pre-dirty file: original = pre-command dirty content, not HEAD", async () => {
    fs.writeFileSync(path.join(repo, "a.txt"), "dirty\n"); // dirty before command
    const sent = await run(() => fs.writeFileSync(path.join(repo, "a.txt"), "dirtier\n"));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("a.txt"), originalContent: "dirty\n", modifiedContent: "dirtier\n", status: "modified", size: 8 }]);
  });

  test("no changes → no message", async () => {
    expect(await run(() => {})).toEqual([]);
  });

  test("dirty but untouched file → not reported", async () => {
    fs.writeFileSync(path.join(repo, "a.txt"), "dirty\n");
    const sent = await run(() => fs.writeFileSync(path.join(repo, "b.txt"), "other\n"));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("b.txt"), originalContent: null, modifiedContent: "other\n", status: "created", size: 6 }]);
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

  test("new binary file → null contents, created + binary + size", async () => {
    const sent = await run(() => fs.writeFileSync(path.join(repo, "bin.dat"), Buffer.from([1, 0, 2, 0])));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("bin.dat"), originalContent: null, modifiedContent: null, status: "created", omitted: "binary", size: 4 }]);
  });

  test("staged rename reports destination + source deletion", async () => {
    const sent = await run(() => sh("git mv a.txt b.txt"));
    const changes = sent[0]!.payload.updates.fileChanges;
    expect(changes).toContainEqual({ path: abs("b.txt"), originalContent: null, modifiedContent: "hello\nworld\n", status: "created", size: 12 });
    expect(changes).toContainEqual({ path: abs("a.txt"), originalContent: "hello\nworld\n", modifiedContent: null, status: "deleted", size: 12 });
  });

  test("paths with spaces and quotes", async () => {
    const name = `we ird "quoted".txt`;
    const sent = await run(() => fs.writeFileSync(path.join(repo, name), "x\n"));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs(name), originalContent: null, modifiedContent: "x\n", status: "created", size: 2 }]);
  });

  test("pre-dirty binary changed → reported (via stat signature)", async () => {
    const p = path.join(repo, "bin.dat");
    fs.writeFileSync(p, Buffer.from([1, 0]));
    const sent = await run(() => fs.writeFileSync(p, Buffer.from([9, 0, 9])));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("bin.dat"), originalContent: null, modifiedContent: null, status: "modified", omitted: "binary", size: 3 }]);
  });

  test("pre-dirty binary untouched → not reported", async () => {
    fs.writeFileSync(path.join(repo, "bin.dat"), Buffer.from([1, 0]));
    const sent = await run(() => fs.writeFileSync(path.join(repo, "b.txt"), "y\n"));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("b.txt"), originalContent: null, modifiedContent: "y\n", status: "created", size: 2 }]);
  });

  test("symlink is not followed", async () => {
    const secret = path.join(os.tmpdir(), `fct-secret-${Date.now()}`);
    fs.writeFileSync(secret, "SECRET\n");
    const sent = await run(() => fs.symlinkSync(secret, path.join(repo, "link")));
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("link"), originalContent: null, modifiedContent: null, status: "created", omitted: "binary" }]);
    fs.rmSync(secret, { force: true });
  });

  test("read-only command → no tracker", () => {
    expect(startTracking(repo, "ls -la | grep foo && git status")).toBeNull();
  });

  test("writing command → tracker", () => {
    expect(startTracking(repo, "sed -i s/a/b/ file.txt")).not.toBeNull();
    expect(startTracking(repo, "cat a.txt > b.txt")).not.toBeNull();
  });

  test("file-tool write during command is not attributed to the command", async () => {
    const sent = await run(() => {
      const p = path.join(repo, "tool-written.txt");
      fs.writeFileSync(p, "from edit tool\n");
      noteFileToolWrite(p);
    });
    expect(sent).toEqual([]);
  });

  test("leading `cd` retargets tracking at the directory the command runs in", async () => {
    const outer = fs.mkdtempSync(path.join(os.tmpdir(), "fct-outer-"));
    const tracker = startTracking(outer, `cd ${repo}\necho hi > new.txt`)!;
    await tracker.ready;
    fs.writeFileSync(path.join(repo, "new.txt"), "hi\n");
    const sent: WsMessage[] = [];
    await tracker.finish(async (m) => { sent.push(m); }, ids);
    expect(sent[0]!.payload.updates.fileChanges).toEqual([{ path: abs("new.txt"), originalContent: null, modifiedContent: "hi\n", status: "created", size: 3 }]);
    fs.rmSync(outer, { recursive: true, force: true });
  });

  test("two repos in one command → both reported", async () => {
    const repo2 = fs.mkdtempSync(path.join(os.tmpdir(), "fct2-"));
    execSync("git init -q && git config user.email t@t && git config user.name t", { cwd: repo2, stdio: "pipe" });
    fs.writeFileSync(path.join(repo2, "b.txt"), "b\n");
    execSync("git add . && git commit -qm init", { cwd: repo2, stdio: "pipe" });
    const tracker = startTracking(repo, `touch x && cd ${repo2} && touch y`)!;
    await tracker.ready;
    fs.writeFileSync(path.join(repo, "x"), "");
    fs.writeFileSync(path.join(repo2, "y"), "");
    const sent: WsMessage[] = [];
    await tracker.finish(async (m) => { sent.push(m); }, ids);
    const paths = sent[0]!.payload.updates.fileChanges.map((c: { path: string }) => c.path).sort();
    expect(paths).toEqual([path.join(fs.realpathSync(repo), "x"), path.join(fs.realpathSync(repo2), "y")].sort());
    fs.rmSync(repo2, { recursive: true, force: true });
  });

  // ── rolling baseline (todoId present) ──────────────────────────────

  const rollRun = async (todoId: string, mutate: () => void): Promise<string[]> => {
    const tracker = startTracking(repo, undefined, todoId)!;
    await tracker.ready;
    mutate();
    const sent: WsMessage[] = [];
    await tracker.finish(async (m) => { sent.push(m); }, ids);
    return (sent[0]?.payload.updates.fileChanges ?? []).map((c: { path: string }) => c.path).sort();
  };

  test("rolling: the second command reports only its own edit", async () => {
    const todo = `rt-${Date.now()}-a`;
    expect(await rollRun(todo, () => fs.writeFileSync(path.join(repo, "a.txt"), "first\n")))
      .toEqual([abs("a.txt")]);
    // a.txt is still dirty vs HEAD, but the rolled baseline owns that state now.
    expect(await rollRun(todo, () => fs.writeFileSync(path.join(repo, "new.txt"), "second\n")))
      .toEqual([abs("new.txt")]);
  });

  test("rolling: an edit made between two runs is not blamed on the next command", async () => {
    const todo = `rt-${Date.now()}-b`;
    await rollRun(todo, () => {});   // establish the baseline

    // Foreign writer edits while no command runs; backdated past the margin,
    // as a genuinely earlier edit's mtime would be.
    fs.writeFileSync(path.join(repo, "a.txt"), "foreign edit\n");
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(path.join(repo, "a.txt"), past, past);

    expect(await rollRun(todo, () => fs.writeFileSync(path.join(repo, "mine.txt"), "my edit\n")))
      .toEqual([abs("mine.txt")]);
    // Absorbed into the new baseline: the next command doesn't report it either.
    expect(await rollRun(todo, () => {})).toEqual([]);
  });

  test("rolling: a HEAD moved between runs re-baselines instead of going blind", async () => {
    const todo = `rt-${Date.now()}-c`;
    await rollRun(todo, () => {});
    fs.writeFileSync(path.join(repo, "a.txt"), "committed by another agent\n");
    sh("git commit -qam other-agent");
    expect(await rollRun(todo, () => fs.writeFileSync(path.join(repo, "x.txt"), "tracked\n")))
      .toEqual([abs("x.txt")]);
  });

  test("rolling: a command that moves HEAD itself reports no file changes", async () => {
    const todo = `rt-${Date.now()}-d`;
    await rollRun(todo, () => {});
    expect(await rollRun(todo, () => {
      fs.writeFileSync(path.join(repo, "a.txt"), "committed\n");
      sh("git commit -qam by-this-command");
    })).toEqual([]);
    // Re-baseline left tracking healthy for the next command.
    expect(await rollRun(todo, () => fs.writeFileSync(path.join(repo, "y.txt"), "after\n")))
      .toEqual([abs("y.txt")]);
  });

  test("rolling: a file-tool write between two runs is not blamed on the next command", async () => {
    const todo = `rt-${Date.now()}-f`;
    await rollRun(todo, () => {});   // baseline
    // Edit/Create tool writes in the gap — recent mtime, but attributed to its
    // own block via noteFileToolWrite, not to the next shell command.
    fs.writeFileSync(path.join(repo, "a.txt"), "tool wrote this\n");
    noteFileToolWrite(path.join(repo, "a.txt"));
    expect(await rollRun(todo, () => fs.writeFileSync(path.join(repo, "mine.txt"), "shell wrote this\n")))
      .toEqual([abs("mine.txt")]);
  });

  test("rolling: consecutive commands with fire-and-forget finish stay serialized", async () => {
    const todo = `rt-${Date.now()}-e`;
    await rollRun(todo, () => {});
    // Command A finishes; its finish() is NOT awaited (as in shell.ts) while
    // command B already starts. The chain must keep post(A) before pre(B).
    const a = startTracking(repo, undefined, todo)!;
    fs.writeFileSync(path.join(repo, "a.txt"), "by A\n");
    const sentA: WsMessage[] = [];
    const finishA = a.finish(async (m) => { sentA.push(m); }, ids);   // fire-and-forget
    const b = startTracking(repo, undefined, todo)!;
    await b.ready;
    fs.writeFileSync(path.join(repo, "b.txt"), "by B\n");
    const sentB: WsMessage[] = [];
    await b.finish(async (m) => { sentB.push(m); }, ids);
    await finishA;
    const paths = (s: WsMessage[]) => (s[0]?.payload.updates.fileChanges ?? []).map((c: { path: string }) => c.path);
    expect(paths(sentA)).toEqual([abs("a.txt")]);
    expect(paths(sentB)).toEqual([abs("b.txt")]);
  });

});
