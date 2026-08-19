// Git-based file-change tracking around shell command execution.
//
// Best-effort by design: the pre-snapshot is kicked off alongside the command
// (not awaited before spawn), so a command that writes files within the first
// few ms may race it. The post-diff runs after the shell result has already
// been sent, so it never delays the DONE message.
//
// original resolution: pre-command dirty content cache → `git show <preHEAD>:file`.
// HEAD moves (checkout/rebase/reset/pull) are reported as a summary, not per-file.
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import type { SendFn } from "./shell.js";
import { commandMightWriteFiles } from "../../../packages/shared-fbe/src/shellReadOnly";

const MAX_FILE_SIZE = 100_000;   // per-file content cap (bytes) — also bounds what gets persisted on the block
const MAX_PRE_FILES = 50;        // dirty files whose content we snapshot pre-command
const MAX_REPORT_FILES = 20;     // per-command reported changes cap

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
  dirty: Set<string>;
  contents: Map<string, string | null>;
  sig: Map<string, string | null>; // lstat signature of dirty files (change detection for binary/large)
}

function git(cwd: string, args: string[], maxBuffer = 8 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, timeout: 15_000, maxBuffer },
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
  return { root, head, dirty: new Set(dirty), contents, sig };
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

async function report(cwd: string, pre: PreState, startedAt: number, send: SendFn, ids: { todoId: string; blockId: string; messageId: string }) {
  // checkout / rebase / reset / pull moved HEAD → the working tree diff is git's
  // doing, not the command editing files. Nothing worth reporting.
  const postHead = (await git(cwd, ["rev-parse", "HEAD"])).trim();
  if (postHead !== pre.head) return;

  const postDirty = new Set(parseStatusZ(await gitStatus(cwd)));
  const changes: FileChange[] = [];
  for (const p of new Set([...postDirty, ...pre.dirty])) {
    if (changes.length >= MAX_REPORT_FILES) break;
    const abs = path.join(pre.root, p);
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
    // A file-tool (Edit/Create) wrote this path during the command — that
    // write belongs to its own block (possibly another todo's), not this one.
    const toolWriteTs = recentToolWrites.get(abs);
    if (toolWriteTs !== undefined && toolWriteTs >= startedAt) continue;

    const existsNow = statSig(abs) !== null;
    const existedBefore = wasDirty
      ? pre.sig.get(p) !== null                       // dirty pre-command → lstat snapshot decides
      : await gitPathExistsAt(cwd, pre.head, p);      // clean pre-command → HEAD decides
    const status: FileChange["status"] = !existsNow ? "deleted" : !existedBefore ? "created" : "modified";
    changes.push(annotate(abs, { path: abs, originalContent, modifiedContent, status }));
  }

  // The existing BLOCK_UPDATE pipeline does the rest: backend persists the
  // updates onto the block and republishes to the frontend's block cache.
  if (changes.length) {
    await send({ type: "BLOCK_UPDATE", payload: { ...ids, updates: { fileChanges: changes } } });
  }
}

/** Commands very often start with `cd <path>` and then write there, while the
 *  block's cwd is some unrelated workspace root. Track the directory the command
 *  actually runs in: follow a leading `cd` (only at the very start, before any
 *  other command) and fall back to `cwd` when it doesn't resolve to a directory. */
export function resolveTrackingCwd(cwd: string, cmd?: string): string {
  if (!cmd) return cwd;
  const m = /^[\s;\n]*cd\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|<>\n]+))\s*(?:&&|;|\n|$)/.exec(cmd);
  const raw = m && (m[1] ?? m[2] ?? m[3]);
  if (!raw) return cwd;
  const expanded = raw.replace(/^~(?=$|\/)/, process.env.HOME || "~");
  const target = path.resolve(cwd, expanded);
  try { return fs.statSync(target).isDirectory() ? target : cwd; } catch { return cwd; }
}

/** Kick off a pre-snapshot (fire-and-forget, not awaited by the caller).
 *  Returns null when disabled or when `cmd` is provably read-only — tracking a
 *  command that cannot write files only opens a window for concurrent writers
 *  (other todos, editors, HMR) to be misattributed to it. */
export function startTracking(cwdIn: string, cmd?: string): FileTracker | null {
  if (!enabled) return null;
  if (cmd !== undefined && !commandMightWriteFiles(cmd)) return null;
  const cwd = resolveTrackingCwd(cwdIn, cmd);
  const startedAt = Date.now();
  const pre = snapshot(cwd).catch(() => null); // not a git repo → tracker stays inert
  return {
    ready: pre,
    async finish(send, ids) {
      try {
        const p = await pre;
        if (p) await report(cwd, p, startedAt, send, ids);
      } catch { /* best-effort: never disturb the shell flow */ }
    },
  };
}
