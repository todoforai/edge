// Discover SKILL.md files under .agents/skills/ and .claude/skills/ for given workspace roots and $HOME.
// Reads only YAML frontmatter — body is loaded later via existing read_file when mentioned.

import fs from "fs";
import path from "path";
import os from "os";

// Directories (relative to a root) that may contain a skills tree.
const SKILL_DIRS = [".agents", ".claude"];

const MAX_DEPTH = 6;
const MAX_DIRS_PER_ROOT = 2000;
const FRONTMATTER_BYTES = 8 * 1024; // enough for any reasonable frontmatter
const MAX_NAME_LEN = 64;
const MAX_DESC_LEN = 1024;

export type SkillScope = "repo" | "user";
export type SkillMeta = {
  name: string;
  description: string;
  shortDescription?: string;
  /** Absolute path to the SKILL.md (used internally by SkillTool, not shown to the LLM). */
  path: string;
  scope: SkillScope;
};
export type SkillError = { path: string; message: string };

export async function discoverSkills(
  rootPaths: string[],
  opts: { includeUserScope?: boolean } = {},
): Promise<{ skills: SkillMeta[]; errors: SkillError[] }> {
  const includeUserScope = opts.includeUserScope ?? true;
  const roots: { path: string; scope: SkillScope }[] = [
    ...rootPaths.flatMap((p) =>
      SKILL_DIRS.map((d) => ({ path: path.join(p, d, "skills"), scope: "repo" as const })),
    ),
  ];
  if (includeUserScope) {
    for (const d of SKILL_DIRS) {
      roots.push({ path: path.join(os.homedir(), d, "skills"), scope: "user" });
    }
  }

  const skills: SkillMeta[] = [];
  const errors: SkillError[] = [];
  const seenSkillPaths = new Set<string>();
  const seenRoots = new Set<string>();

  for (const root of roots) {
    if (seenRoots.has(root.path)) continue;
    seenRoots.add(root.path);

    let stat: fs.Stats;
    try { stat = fs.statSync(root.path); } catch { continue; }
    if (!stat.isDirectory()) continue;

    walkRoot(root.path, root.scope, skills, errors, seenSkillPaths);
  }

  // First-wins name dedupe: roots are priority-ordered (repo .agents → repo .claude → user).
  const seenNames = new Set<string>();
  const unique = skills.filter((s) => !seenNames.has(s.name) && seenNames.add(s.name));

  return { skills: unique, errors };
}

function walkRoot(root: string, scope: SkillScope, skills: SkillMeta[], errors: SkillError[], seen: Set<string>) {
  const queue: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
  let dirsVisited = 0;

  for (let i = 0; i < queue.length; i++) {
    const { dir, depth } = queue[i];
    if (depth > MAX_DEPTH) continue;
    if (dirsVisited++ >= MAX_DIRS_PER_ROOT) break;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e: any) {
      errors.push({ path: dir, message: `read dir failed: ${e?.message ?? e}` });
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        queue.push({ dir: full, depth: depth + 1 });
        continue;
      }

      // Don't follow directory symlinks (loop risk). Allow file symlinks for SKILL.md only.
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        try { isFile = fs.statSync(full).isFile(); } catch { continue; }
      }

      if (isFile && entry.name === "SKILL.md") {
        if (seen.has(full)) continue;
        seen.add(full);
        const skill = parseSkillFile(full, scope, errors);
        if (skill) skills.push(skill);
      }
    }
  }
}

function parseSkillFile(filePath: string, scope: SkillScope, errors: SkillError[]): SkillMeta | null {
  let head: string;
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(FRONTMATTER_BYTES);
    const bytes = fs.readSync(fd, buf, 0, FRONTMATTER_BYTES, 0);
    fs.closeSync(fd);
    head = buf.subarray(0, bytes).toString("utf-8");
  } catch (e: any) {
    errors.push({ path: filePath, message: `read failed: ${e?.message ?? e}` });
    return null;
  }

  const frontmatter = extractFrontmatter(head);
  if (!frontmatter) {
    errors.push({ path: filePath, message: "missing YAML frontmatter delimited by ---" });
    return null;
  }

  const fm = parseSimpleYaml(frontmatter);
  const name = sanitize(fm.name) || path.basename(path.dirname(filePath));
  const description = sanitize(fm.description) || "";
  const shortDescription = sanitize(fm["metadata.short-description"]) || undefined;

  if (!name || name.length > MAX_NAME_LEN) {
    errors.push({ path: filePath, message: `invalid name (empty or > ${MAX_NAME_LEN} chars)` });
    return null;
  }
  if (description.length > MAX_DESC_LEN) {
    errors.push({ path: filePath, message: `description > ${MAX_DESC_LEN} chars` });
    return null;
  }

  return {
    name,
    description,
    shortDescription: shortDescription && shortDescription.length <= MAX_DESC_LEN ? shortDescription : undefined,
    path: filePath,
    scope,
  };
}

function extractFrontmatter(text: string): string | null {
  // Tolerate BOM and trailing whitespace on delimiters.
  const stripped = text.replace(/^\uFEFF/, "");
  const lines = stripped.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end < 0) return null;
  return lines.slice(1, end).join("\n");
}

// Minimal YAML parser: intentionally only supports one-line scalar values:
// `name: value`, `description: value`, and `metadata.short-description` via a `metadata:` block.
// Quoted strings (single or double) are unquoted. Unquoted inline comments are stripped.
// Multiline / arrays / nested structures are NOT supported — keep skill metadata small.
function parseSimpleYaml(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  let inMetadata = false;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line || line.trimStart().startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (indent === 0) {
      inMetadata = false;
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
      if (!m) continue;
      const [, key, val] = m;
      if (val === "" && key === "metadata") { inMetadata = true; continue; }
      out[key] = unquote(val);
    } else if (inMetadata) {
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
      if (!m) continue;
      const [, key, val] = m;
      out[`metadata.${key}`] = unquote(val);
    }
  }
  return out;
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    const first = t[0], last = t[t.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return t.slice(1, -1);
    }
  }
  return t.replace(/\s+#.*$/, "").trim();
}

function sanitize(s: string | undefined): string {
  if (!s) return "";
  return s.split(/\s+/).filter(Boolean).join(" ");
}
