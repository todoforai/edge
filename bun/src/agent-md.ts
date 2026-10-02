// Discover AGENT.md / AGENTS.md project-instruction files at workspace roots and $HOME/.agents.
// Unlike skills, the full body is returned (capped) — it's injected verbatim into the system prompt.
// Root-level only: these are repo-wide instructions, not nested per-directory rules.

import fs from "fs";
import path from "path";
import os from "os";

const MAX_BYTES = 64 * 1024;
const FILENAMES = ["AGENT.md", "AGENTS.md"]; // accept both (Cursor / Codex conventions)

export type AgentMdScope = "repo" | "user";
export type AgentMdFile = {
  path: string; // absolute
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

  const dirs: { dir: string; scope: AgentMdScope }[] = [
    ...rootPaths.map((p) => ({ dir: p, scope: "repo" as const })),
  ];
  if (includeUserScope) {
    dirs.push({ dir: path.join(os.homedir(), ".agents"), scope: "user" });
  }

  const files: AgentMdFile[] = [];
  const errors: AgentMdError[] = [];
  const seen = new Set<string>();

  for (const { dir, scope } of dirs) {
    for (const name of FILENAMES) {
      const full = path.join(dir, name);
      if (seen.has(full)) continue;

      let stat: fs.Stats;
      try { stat = fs.statSync(full); } catch { continue; }
      if (!stat.isFile()) continue;
      seen.add(full);

      try {
        const fd = fs.openSync(full, "r");
        const buf = Buffer.alloc(maxBytes);
        let bytes: number;
        try { bytes = fs.readSync(fd, buf, 0, maxBytes, 0); } finally { fs.closeSync(fd); }
        files.push({
          path: full,
          scope,
          content: buf.subarray(0, bytes).toString("utf-8"),
          bytes: stat.size,
          truncated: stat.size > maxBytes,
        });
      } catch (e: any) {
        errors.push({ path: full, message: `read failed: ${e?.message ?? e}` });
      }
    }
  }

  return { files, errors };
}
