// Discover project-instruction files at workspace roots and for the user. One per folder,
// the first of AGENTS.md, AGENT.md, CLAUDE.md (user: ~/.agents/AGENTS.md, ~/.agents/AGENT.md,
// ~/.claude/CLAUDE.md), and one per real file (symlinks count once). The full body is
// returned (capped): it's injected verbatim into the system prompt. Root-level only.

import fs from "fs";
import path from "path";
import os from "os";

const MAX_BYTES = 64 * 1024;
const FILENAMES = ["AGENTS.md", "AGENT.md", "CLAUDE.md"]; // priority order

export type AgentMdScope = "repo" | "user";
export type AgentMdFile = {
  path: string; // absolute
  realpath: string; // symlinks resolved
  scope: AgentMdScope;
  content: string; // full body, capped at MAX_BYTES
  bytes: number; // pre-cap size on disk
  truncated: boolean;
};
export type AgentMdError = { path: string; message: string };

export async function discoverAgentMd(
  rootPaths: string[],
  opts: { includeUserScope?: boolean; maxBytes?: number } = {},
): Promise<{ files: AgentMdFile[]; errors: AgentMdError[] }> {
  const includeUserScope = opts.includeUserScope ?? true;
  const maxBytes = opts.maxBytes ?? MAX_BYTES;

  const candidates: { scope: AgentMdScope; paths: string[] }[] =
    rootPaths.map((p) => ({ scope: "repo" as const, paths: FILENAMES.map((n) => path.join(p, n)) }));
  if (includeUserScope) {
    const home = os.homedir();
    candidates.push({ scope: "user", paths: [path.join(home, ".agents", "AGENTS.md"), path.join(home, ".agents", "AGENT.md"), path.join(home, ".claude", "CLAUDE.md")] });
  }

  const files: AgentMdFile[] = [];
  const errors: AgentMdError[] = [];
  const seen = new Set<string>();

  for (const { scope, paths } of candidates) {
    for (const full of paths) {
      try {
        const stat = fs.statSync(full);
        if (!stat.isFile() || stat.size === 0) continue; // an empty file counts as none
        const real = fs.realpathSync(full);
        if (seen.has(real)) break; // this folder's file is already loaded
        const fd = fs.openSync(full, "r");
        const buf = Buffer.alloc(maxBytes);
        let bytes: number;
        try { bytes = fs.readSync(fd, buf, 0, maxBytes, 0); } finally { fs.closeSync(fd); }
        const content = buf.subarray(0, bytes).toString("utf-8");
        if (!content.trim()) continue; // whitespace-only counts as empty (matches agent_md_info.jl)
        seen.add(real);
        files.push({
          path: full,
          realpath: real,
          scope,
          content,
          bytes: stat.size,
          truncated: stat.size > maxBytes,
        });
        break; // first readable name wins
      } catch (e: any) {
        if (e?.code !== "ENOENT") errors.push({ path: full, message: `read failed: ${e?.message ?? e}` });
      }
    }
  }

  return { files, errors };
}
