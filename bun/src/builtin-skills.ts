// Built-in skills shipped with the edge. Canonical source: ../builtin-skills/.
// Statically embedded via text imports (works under bun run, bundle and --compile),
// materialized on first use to a content-addressed cache dir so scripts/ are runnable
// on disk by subprocesses (python3/bash). Repo/user skills with the same name win —
// this root is appended at lowest priority in skills.ts.
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

import pptxSkill from "../builtin-skills/pptx/SKILL.md" with { type: "text" };
import pptxOoxml from "../builtin-skills/pptx/scripts/ooxml.py" with { type: "text" };
import pptxInventory from "../builtin-skills/pptx/scripts/inventory.py" with { type: "text" };
import pptxRender from "../builtin-skills/pptx/scripts/render.sh" with { type: "text" };
import slidesSkill from "../builtin-skills/slides/SKILL.md" with { type: "text" };

const FILES: Record<string, string> = {
  "pptx/SKILL.md": pptxSkill,
  "pptx/scripts/ooxml.py": pptxOoxml,
  "pptx/scripts/inventory.py": pptxInventory,
  "pptx/scripts/render.sh": pptxRender,
  "slides/SKILL.md": slidesSkill,
};

let cachedRoot: string | null = null;

function materialize(base: string, hash: string): string {
  const root = path.join(base, hash);
  if (fs.existsSync(path.join(root, ".complete"))) return root;
  // Stage into a process-unique sibling dir, then atomically rename, so a
  // concurrent edge process never observes a half-written tree.
  const tmp = `${root}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  for (const [rel, content] of Object.entries(FILES)) {
    const dst = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, content, { mode: rel.includes("/scripts/") ? 0o755 : 0o644 });
  }
  fs.writeFileSync(path.join(tmp, ".complete"), "");
  try {
    fs.renameSync(tmp, root);
  } catch {
    fs.rmSync(tmp, { recursive: true, force: true }); // lost the race — use the winner's tree
    if (!fs.existsSync(path.join(root, ".complete"))) throw new Error(`materialize failed: ${root}`);
  }
  return root;
}

/** Returns a directory containing <skill>/SKILL.md trees, or null if unavailable. */
export function builtinSkillsRoot(): string | null {
  if (cachedRoot) return cachedRoot; // failures are retried on next call
  const hash = crypto
    .createHash("sha256")
    .update(Object.entries(FILES).map(([rel, c]) => `${rel}\0${c}`).join("\0"))
    .digest("hex")
    .slice(0, 32);
  const cacheHome = process.env.XDG_CACHE_HOME?.trim() || path.join(os.homedir(), ".cache");
  try {
    cachedRoot = materialize(path.join(cacheHome, "todoforai", "builtin-skills"), hash);
  } catch (e) {
    console.error(`builtin skills unavailable: ${e}`);
  }
  return cachedRoot;
}
