// Git-based file-change tracking around shell command execution.
//
// With a todoId the baseline *rolls*: each post leaves its final snapshot
// behind (in-memory, keyed by todo + repo root), so the next command's pre
// reuses it instead of re-scanning — and, more to the point, the baseline
// predates the command instead of racing its first writes. `startedAt` is
// taken synchronously before spawn, so the mtime gate that keeps between-run
// edits (other agents, the user's editor, HMR) out of the report has an exact
// stamp; the margin only covers filesystem timestamp granularity. A per-todo
// chain serializes one todo's snapshots so a fire-and-forget finish() never
// interleaves with the next command's pre. Without a todoId the snapshot is
// one-shot per run, as before.
//
// Best-effort by design: the bootstrap pre-snapshot is kicked off alongside
// the command (not awaited before spawn), so a command that writes files
// within the first few ms may race it. The post-diff runs after the shell
// result has already been sent, so it never delays the DONE message.
//
// original resolution: pre-command dirty content cache → `git show <preHEAD>:file`.
// HEAD moves (checkout/rebase/reset/pull) are reported as a summary, not per-file.
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import type { SendFn } from "./shell.js";
import { commandMightWriteFiles } from "../../../packages/shared-fbe/src/shellReadOnly";
import { trackingDirs } from "../../../packages/shared-fbe/src/shellCwd";

const MAX_FILE_SIZE = 100_000;   // per-file content cap (bytes) — also bounds what gets persisted on the block
const MAX_PRE_FILES = 50;        // dirty files whose content we snapshot pre-command
const MAX_REPORT_FILES = 20;     // per-command reported changes cap
const MTIME_MARGIN_MS = 2_000;   // stamp-vs-mtime slack: coarse fs timestamps (FAT: 2s)
const BASELINE_TTL_MS = 60 * 60_000;

let enabled = false;
export function setFileTrackingEnabled(v: boolean) { enabled = v; }

export interface FileChange {
  path: string;                    // absolute (repo root + relative)
  originalContent: string | null;  // null = didn't exist / binary / too large
  modifiedContent: string | null;  // null = deleted / binary / too large
  status: "created" | "modified" | "deleted";
  omitted?: "binary" | "too-large"; // why the shown side has null content
  size?: number;                   // bytes after the command (before it, when deleted)
}

// ── Cross-todo write attribution ─────────────────────────────────────
// The edge serves every todo from one process, so a concurrent agent's
// Edit/Create tool can write into a repo while another todo's shell command
// runs — git tracking would then blame that write on the command. File-tool
// handlers report their writes here and trackers exclude them.
const recentToolWrites = new Map<string, number>(); // resolved abs path → ts
const TOOL_WRITE_TTL = 10 * 60_000;

export function noteFileToolWrite(absPath: string) {
  if (recentToolWrites.size > 500) {
    const cutoff = Date.now() - TOOL_WRITE_TTL;
    for (const [p, t] of recentToolWrites) if (t < cutoff) recentToolWrites.delete(p);
  }
  try { recentToolWrites.set(fs.realpathSync(absPath), Date.now()); }
  catch { recentToolWrites.set(path.resolve(absPath), Date.now()); }
}

export interface FileTracker {
  /** Resolves when the pre-snapshot is captured (used by tests). */
  ready: Promise<unknown>;
  /** Diff against the pre-snapshot and push BLOCK_FILE_CHANGED. Never throws. */
  finish(send: SendFn, ids: { todoId: string; blockId: string; messageId: string }): Promise<void>;
}

interface PreState {
  root: string;
  head: string;
  takenAt: number;                 // when this snapshot was captured (tool-write cutoff for rolled baselines)
  dirty: Set<string>;
  contents: Map<string, string | null>;
  sig: Map<string, string | null>; // lstat signature of dirty files (change detection for binary/large)
}

// ── Rolling baselines & per-todo serialization ───────────────────────
// `${todoId}\0${root}` → the repo's state as of the last post. ~5MB worst
// case per entry (50 files × 100KB); the TTL sweep reclaims quiet todos.
const baselines = new Map<string, { pre: PreState; at: number }>();
const baseKey = (todoId: string, root: string) => `${todoId}\0${root}`;

// One todo's snapshots must not interleave: finish() is fire-and-forget in
// shell.ts, so the next command's pre can arrive while the previous post is
// still consuming/rolling the shared baseline. The chain gives
// pre(A) → post(A) → pre(B) → post(B) for consecutive commands; two commands
// *overlapping* in time degrade to pre(A) → pre(B) → post(A) → post(B) — both
// diff the same baseline and each may pick up the other's writes (accepted:
// mtime cannot separate truly concurrent writers, and nothing is lost).
// Only tracking waits, never the shell.
// First link runs synchronously — the bootstrap pre races the command, and
// every tick it loses widens the blind spot.
const chains = new Map<string, Promise<unknown>>();
function enqueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key);
  const run = prev ? prev.then(fn, fn) : fn();
  const tail = run.then(() => {}, () => {});
  chains.set(key, tail);
  void tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
  return run;
}

function git(cwd: string, args: string[], maxBuffer = 8 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    // GIT_OPTIONAL_LOCKS=0: snapshots are read-only observers; don't take
    // index.lock for opportunistic refreshes, so a concurrent `git commit`
    // by the tracked command never contends with us.
    execFile("git", args, { cwd, timeout: 15_000, maxBuffer, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } },
      (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}

/** Parse `git status --porcelain=v2 -z` output into repo-root-relative paths.
 *  Renames contribute both destination and source (source shows up as deleted). */
function parseStatusZ(out: string): string[] {
  const tokens = out.split("\0");
  const paths: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) continue;
    if (t.startsWith("1 ")) paths.push(t.split(" ").slice(8).join(" "));
    else if (t.startsWith("2 ")) {
      paths.push(t.split(" ").slice(9).join(" "));
      const orig = tokens[++i]; // rename/copy source follows as its own NUL token
      if (orig) paths.push(orig);
    } else if (t.startsWith("? ")) paths.push(t.slice(2));
    else if (t.startsWith("u ")) paths.push(t.split(" ").slice(10).join(" "));
  }
  return paths;
}

function gitStatus(cwd: string): Promise<string> {
  return git(cwd, ["status", "--porcelain=v2", "-z", "-uall"]);
}

/** Directory that exists locally (the edge runs on the same host as the command). */
function isDir(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

/** lstat signature for cheap change detection; null = missing. */
function statSig(abs: string): string | null {
  try {
    const st = fs.lstatSync(abs);
    return `${st.mtimeMs}:${st.size}`;
  } catch { return null; }
}

/** Read regular-file content; null for missing/symlink/binary/too-large. */
async function readCapped(abs: string): Promise<string | null> {
  try {
    const st = await fs.promises.lstat(abs); // no symlink following — never read outside the repo
    if (!st.isFile() || st.size > MAX_FILE_SIZE) return null;
    const buf = await fs.promises.readFile(abs);
    if (buf.includes(0)) return null; // binary
    return buf.toString("utf-8");
  } catch { return null; }
}

/** Did `p` exist at `rev`? (`git cat-file -e` exits non-zero when absent.) */
async function gitPathExistsAt(cwd: string, rev: string, p: string): Promise<boolean> {
  try { await git(cwd, ["cat-file", "-e", `${rev}:${p}`]); return true; }
  catch { return false; }
}

async function gitShow(cwd: string, rev: string, p: string): Promise<string | null> {
  try {
    const s = await git(cwd, ["show", `${rev}:${p}`], MAX_FILE_SIZE * 2);
    return Buffer.byteLength(s) > MAX_FILE_SIZE || s.includes("\0") ? null : s;
  } catch { return null; } // path didn't exist at rev / blob over maxBuffer
}

async function snapshot(cwd: string): Promise<PreState> {
  // Single call: prints HEAD sha then the repo toplevel. Throws outside a repo / before first commit.
  const [head, root] = (await git(cwd, ["rev-parse", "HEAD", "--show-toplevel"])).trim().split("\n");
  const dirty = parseStatusZ(await gitStatus(cwd));
  const contents = new Map<string, string | null>();
  const sig = new Map<string, string | null>();
  for (const p of dirty.slice(0, MAX_PRE_FILES)) {
    const abs = path.join(root, p);
    contents.set(p, await readCapped(abs));
    sig.set(p, statSig(abs));
  }
  return { root, head, takenAt: Date.now(), dirty: new Set(dirty), contents, sig };
}

/** Size + why-content-is-null for the side of the change the user would see. */
function annotate(abs: string, c: Omit<FileChange, "size" | "omitted">): FileChange {
  const out: FileChange = { ...c };
  try {
    const st = fs.lstatSync(abs);
    if (st.isFile()) out.size = st.size;
  } catch { /* deleted — size unknown (pre-content may carry it below) */ }
  if (c.status === "deleted") {
    if (c.originalContent !== null) out.size = Buffer.byteLength(c.originalContent);
    else out.omitted = "binary"; // original was binary/large; size unknowable now
  } else if (c.modifiedContent === null) {
    out.omitted = out.size !== undefined && out.size > MAX_FILE_SIZE ? "too-large" : "binary";
  }
  return out;
}

/** mtime of `abs`, falling back to its nearest existing ancestor — a deletion
 *  has no mtime of its own, but unlinking updates the parent dir's. */
function ancestorMtime(abs: string): number | null {
  for (let t = abs; ; ) {
    try { return fs.lstatSync(t).mtimeMs; }
    catch { const up = path.dirname(t); if (up === t) return null; t = up; }
  }
}

/** Files the command changed in one repo. Absolute paths, anchored at its root. */
async function report(pre: PreState, startedAt: number, roll: boolean): Promise<FileChange[]> {
  const cwd = pre.root;
  // checkout / rebase / reset / pull moved HEAD → the working tree diff is git's
  // doing, not the command editing files. Nothing worth reporting. (A HEAD
  // moved *between* runs never reaches here — startTracking re-baselines.)
  const postHead = (await git(cwd, ["rev-parse", "HEAD"])).trim();
  if (postHead !== pre.head) return [];

  const postDirty = new Set(parseStatusZ(await gitStatus(cwd)));
  const changes: FileChange[] = [];
  for (const p of new Set([...postDirty, ...pre.dirty])) {
    if (changes.length >= MAX_REPORT_FILES) break;
    const abs = path.join(pre.root, p);
    // Rolled baselines persist between runs, so the tree can hold edits by
    // anyone. Files untouched since this command started can't be its doing —
    // dropped here, absorbed into the next baseline. Unknown mtime fails open.
    if (roll) {
      const m = ancestorMtime(abs);
      if (m !== null && m < startedAt - MTIME_MARGIN_MS) continue;
    }
    const wasDirty = pre.dirty.has(p);
    let originalContent: string | null;
    if (wasDirty) {
      if (!pre.contents.has(p)) continue; // over the snapshot cap → pre-state unknown, skip
      originalContent = pre.contents.get(p)!;
    } else {
      originalContent = await gitShow(cwd, pre.head, p); // null = new file
    }
    const modifiedContent = await readCapped(abs);
    if (wasDirty) {
      // Skip files that were dirty before the command and untouched by it:
      // text → content equality; binary/large (null contents) → lstat signature.
      const unchangedText = originalContent !== null && originalContent === modifiedContent;
      const unchangedOpaque = originalContent === null && modifiedContent === null && statSig(abs) === pre.sig.get(p);
      if (unchangedText || unchangedOpaque) continue;
    }
    // A file-tool (Edit/Create) wrote this path inside the attribution window
    // — that write belongs to its own block (possibly another todo's), not
    // this one. A rolled baseline's window opens when it was captured (the
    // previous post), not when this command started: a tool write in the gap
    // between runs is newer than the baseline, so it would otherwise be
    // blamed here.
    const toolWriteTs = recentToolWrites.get(abs);
    if (toolWriteTs !== undefined && toolWriteTs >= (roll ? pre.takenAt : startedAt)) continue;

    const existsNow = statSig(abs) !== null;
    const existedBefore = wasDirty
      ? pre.sig.get(p) !== null                       // dirty pre-command → lstat snapshot decides
      : await gitPathExistsAt(cwd, pre.head, p);      // clean pre-command → HEAD decides
    const status: FileChange["status"] = !existsNow ? "deleted" : !existedBefore ? "created" : "modified";
    changes.push(annotate(abs, { path: abs, originalContent, modifiedContent, status }));
  }

  return changes;
}

/** Kick off pre-snapshots (fire-and-forget, not awaited by the caller).
 *  Returns null when disabled or when `cmd` is provably read-only — tracking a
 *  command that cannot write files only opens a window for concurrent writers
 *  (other todos, editors, HMR) to be misattributed to it.
 *  With a `todoId` the baseline rolls across the todo's commands; without one
 *  it is one-shot per run. */
export function startTracking(cwd: string, cmd?: string, todoId?: string): FileTracker | null {
  if (!enabled) return null;
  if (cmd !== undefined && !commandMightWriteFiles(cmd)) return null;
  const startedAt = Date.now();
  if (todoId) for (const [k, b] of baselines) if (b.at < startedAt - BASELINE_TTL_MS) baselines.delete(k);
  // One snapshot per directory the command plausibly writes in — the cwd plus
  // every `cd` target, since `cd /other/repo && …` is a staple of agent output
  // and the cwd's repo would show none of it. A dir outside a git repo yields
  // no snapshot; several dirs of one repo collapse into a single one.
  const dirs = trackingDirs(cwd, cmd, { isDir, resolve: path.resolve, home: process.env.HOME });
  // Reuse the rolled baseline when its HEAD still matches; a moved HEAD
  // (another agent committed between runs) means the baseline speaks for a
  // tree that no longer exists — re-snapshot, before the diff, so report()'s
  // HEAD check only trips on moves the command itself made.
  const preOf = async (d: string): Promise<PreState | null> => {
    if (!todoId) return snapshot(d);
    const head = (await git(d, ["rev-parse", "HEAD", "--show-toplevel"])).trim().split("\n");
    const rolled = baselines.get(baseKey(todoId, head[1]!));
    if (rolled && rolled.pre.head === head[0]) return rolled.pre;
    const fresh = await snapshot(d);
    baselines.set(baseKey(todoId, fresh.root), { pre: fresh, at: Date.now() });
    return fresh;
  };
  const takePre = () => Promise.all(dirs.map((d) => preOf(d).catch(() => null)))
    .then((snaps) => snaps.filter((s): s is PreState => !!s)
      .filter((s, i, all) => all.findIndex((o) => o.root === s.root) === i));
  const pre = todoId ? enqueue(todoId, takePre) : takePre();
  return {
    ready: pre,
    async finish(send, ids) {
      try {
        const run = async () => {
          const out: FileChange[] = [];
          for (const p of await pre) {
            out.push(...await report(p, startedAt, !!todoId));
            // Roll forward: the post-command tree is the next run's pre-state.
            // A failed snapshot must *drop* the baseline, not keep the old one
            // — reusing it would fold this command's changes into the next
            // command's report.
            if (todoId) {
              const next = await snapshot(p.root).catch(() => null);
              if (next) baselines.set(baseKey(todoId, next.root), { pre: next, at: Date.now() });
              else baselines.delete(baseKey(todoId, p.root));
            }
          }
          return out;
        };
        const changes = todoId ? await enqueue(todoId, run) : await run();
        // The existing BLOCK_UPDATE pipeline does the rest: backend persists the
        // updates onto the block and republishes to the frontend's block cache.
        if (changes.length) {
          await send({ type: "BLOCK_UPDATE", payload: { ...ids, updates: { fileChanges: changes.slice(0, MAX_REPORT_FILES) } } });
        }
      } catch { /* best-effort: never disturb the shell flow */ }
    },
  };
}
