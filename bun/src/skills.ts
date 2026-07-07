// Discover SKILL.md files under .agents/skills/ and .claude/skills/ for given workspace roots and $HOME.
// Also discovers Claude Code-style plugins under .agents/plugins/ and .claude/plugins/:
// each <plugins>/<dir>/ may carry a `.claude-plugin/plugin.json` manifest (name; falls back
// to the directory name) plus `skills/**/SKILL.md` and `commands/**/*.md`. Commands are
// surfaced as SkillMeta with kind="command" so they ride the existing skills pipeline
// (skill tool name→path resolution, @mention autocomplete) with no new wire format.
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
export type SkillKind = "skill" | "command";
export type SkillMeta = {
  name: string;
  description: string;
  shortDescription?: string;
  /** Absolute path to the SKILL.md / command .md (used internally by SkillTool, not shown to the LLM). */
  path: string;
  scope: SkillScope;
  /** Omitted for plain skills (wire compat); "command" for plugin commands/*.md. */
  kind?: SkillKind;
  /** Plugin name when discovered inside a plugin directory. */
  plugin?: string;
};
export type SkillError = { path: string; message: string };

export async function discoverSkills(
  rootPaths: string[],
  opts: { includeUserScope?: boolean } = {},
): Promise<{ skills: SkillMeta[]; errors: SkillError[] }> {
  const includeUserScope = opts.includeUserScope ?? true;
  const bases: { base: string; scope: SkillScope }[] = [
    ...rootPaths.flatMap((p) =>
      SKILL_DIRS.map((d) => ({ base: path.join(p, d), scope: "repo" as const })),
    ),
  ];
  if (includeUserScope) {
    for (const d of SKILL_DIRS) {
      bases.push({ base: path.join(os.homedir(), d), scope: "user" });
    }
  }

  const skills: SkillMeta[] = [];
  const errors: SkillError[] = [];
  const seenSkillPaths = new Set<string>();
  const seenBases = new Set<string>();

  for (const { base, scope } of bases) {
    if (seenBases.has(base)) continue;
    seenBases.add(base);

    if (isDir(path.join(base, "skills"))) {
      walkRoot(path.join(base, "skills"), scope, skills, errors, seenSkillPaths);
    }
    for (const plugin of listPluginDirs(path.join(base, "plugins"))) {
      if (isDir(path.join(plugin.dir, "skills"))) {
        walkRoot(path.join(plugin.dir, "skills"), scope, skills, errors, seenSkillPaths, plugin.name);
      }
      if (isDir(path.join(plugin.dir, "commands"))) {
        walkCommands(path.join(plugin.dir, "commands"), scope, plugin.name, skills, errors, seenSkillPaths);
      }
    }
  }

  // First-wins name dedupe: roots are priority-ordered (repo .agents → repo .claude → user).
  const seenNames = new Set<string>();
  const unique = skills.filter((s) => !seenNames.has(s.name) && seenNames.add(s.name));

  return { skills: unique, errors };
}

function isDir(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

/** List plugin dirs under <base>/plugins. Name from `.claude-plugin/plugin.json`, falling back to the dir name. */
function listPluginDirs(pluginsRoot: string): { dir: string; name: string }[] {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(pluginsRoot, { withFileTypes: true }); } catch { return []; }
  const out: { dir: string; name: string }[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || !e.isDirectory()) continue;
    const dir = path.join(pluginsRoot, e.name);
    let name = e.name;
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, ".claude-plugin", "plugin.json"), "utf-8"));
      if (typeof manifest?.name === "string" && manifest.name.trim()) name = sanitize(manifest.name);
    } catch { /* manifest optional — dir name is the fallback */ }
    out.push({ dir, name });
  }
  return out;
}

function walkRoot(root: string, scope: SkillScope, skills: SkillMeta[], errors: SkillError[], seen: Set<string>, plugin?: string) {
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
        if (skill) skills.push(plugin ? { ...skill, plugin } : skill);
      }
    }
  }
}

/** Walk a plugin's commands/ dir for *.md prompt templates. Frontmatter is optional
 *  (name falls back to the file stem, description to ""). */
function walkCommands(root: string, scope: SkillScope, plugin: string, skills: SkillMeta[], errors: SkillError[], seen: Set<string>) {
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

      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        try { isFile = fs.statSync(full).isFile(); } catch { continue; }
      }

      if (isFile && entry.name.endsWith(".md")) {
        if (seen.has(full)) continue;
        seen.add(full);
        const cmd = parseCommandFile(full, scope, plugin, errors);
        if (cmd) skills.push(cmd);
      }
    }
  }
}

function parseCommandFile(filePath: string, scope: SkillScope, plugin: string, errors: SkillError[]): SkillMeta | null {
  let head: string;
  try {
    head = readHead(filePath);
  } catch (e: any) {
    errors.push({ path: filePath, message: `read failed: ${e?.message ?? e}` });
    return null;
  }

  const frontmatter = extractFrontmatter(head);
  const fm = frontmatter ? parseSimpleYaml(frontmatter) : {};
  const name = sanitize(fm.name) || path.basename(filePath, ".md");
  const description = sanitize(fm.description) || "";

  if (!name || name.length > MAX_NAME_LEN) {
    errors.push({ path: filePath, message: `invalid name (empty or > ${MAX_NAME_LEN} chars)` });
    return null;
  }
  if (description.length > MAX_DESC_LEN) {
    errors.push({ path: filePath, message: `description > ${MAX_DESC_LEN} chars` });
    return null;
  }

  return { name, description, path: filePath, scope, kind: "command", plugin };
}

function readHead(filePath: string): string {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(FRONTMATTER_BYTES);
  const bytes = fs.readSync(fd, buf, 0, FRONTMATTER_BYTES, 0);
  fs.closeSync(fd);
  return buf.subarray(0, bytes).toString("utf-8");
}

function parseSkillFile(filePath: string, scope: SkillScope, errors: SkillError[]): SkillMeta | null {
  let head: string;
  try {
    head = readHead(filePath);
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
