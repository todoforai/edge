/** Per-agent login profiles (AgentSettings.toolProfiles: tool key → profile name).
 *
 *  A tool with a profile runs through a generated shim that points its HOME (and
 *  XDG dirs) at ~/.todoforai/profiles/<name>/, so its logins live there instead of
 *  the shared ~. The shim dir is keyed by the exact mapping, so an agent only ever
 *  gets shims for its own tools. No profiles (the normal case) = nothing happens.
 *
 *  Guardrail, not isolation: same OS user, so the profile dir is still readable, and
 *  credentials passed in env (GH_TOKEN, RCLONE_CONFIG, …) are not overridden. */

import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { TOOL_CATALOG } from "./tool-catalog.js";

const ROOT = path.join(os.homedir(), ".todoforai");
const PROFILE_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;
const BIN_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function profileDir(name: string): string {
  return path.join(ROOT, "profiles", name);
}

/** Valid entries as binName → profile name. Unknown tools and bad names are dropped. */
function profileBins(toolProfiles: unknown): [string, string][] {
  if (!toolProfiles || typeof toolProfiles !== "object") return [];
  const out = new Map<string, string>();
  const conflict = new Set<string>();
  for (const [key, name] of Object.entries(toolProfiles as Record<string, unknown>)) {
    const entry = TOOL_CATALOG[key];
    const bin = entry?.binName ?? key;
    if (!entry || typeof name !== "string" || !PROFILE_NAME.test(name) || !BIN_NAME.test(bin)) continue;
    // gdrive + rclone share one binary: two different profiles for it can't both hold.
    if (out.has(bin) && out.get(bin) !== name) conflict.add(bin);
    out.set(bin, name);
  }
  for (const bin of conflict) {
    console.log(`[tool-profiles] ${bin}: conflicting profiles, using the shared login`);
    out.delete(bin);
  }
  return [...out].sort(([a], [b]) => a.localeCompare(b));
}

const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function shimScript(shimDir: string, bin: string, home: string): string {
  // Drop the shim dir from PATH so `exec` finds the real binary (and children don't loop back).
  // Builtins only: an external grep/tr could itself be a shim and recurse.
  return `#!/bin/sh
set -f
d=${sq(shimDir)} p=
IFS=:
for x in $PATH; do [ "$x" = "$d" ] || p="\${p:+$p:}$x"; done
unset IFS
set +f
PATH=$p
export PATH HOME=${sq(home)} XDG_CONFIG_HOME=${sq(path.join(home, ".config"))} XDG_DATA_HOME=${sq(path.join(home, ".local", "share"))} XDG_STATE_HOME=${sq(path.join(home, ".local", "state"))} XDG_CACHE_HOME=${sq(path.join(home, ".cache"))}
exec ${sq(bin)} "$@"
`;
}

/** Shim dir to prepend to PATH for this mapping, or undefined when there is nothing to do. */
export function ensureProfileShims(toolProfiles: unknown): string | undefined {
  const bins = profileBins(toolProfiles);
  if (!bins.length) return undefined;
  if (os.platform() === "win32") {
    console.log("[tool-profiles] separate login profiles are not supported on Windows yet; using the shared login");
    return undefined;
  }
  const hash = crypto.createHash("sha256").update(JSON.stringify(bins)).digest("hex").slice(0, 16);
  const shimDir = path.join(ROOT, "profile-shims", hash);
  for (const [bin, name] of bins) {
    const home = profileDir(name);
    fs.mkdirSync(home, { recursive: true, mode: 0o700 });
    const file = path.join(shimDir, bin);
    const script = shimScript(shimDir, bin, home);
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === script) continue;
    fs.mkdirSync(shimDir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, script, { mode: 0o755 });
    fs.renameSync(tmp, file); // atomic: a concurrent run never sees a half-written shim
  }
  return shimDir;
}

/** `env` with the profile shim dir in front of PATH (unchanged without profiles). */
export function withToolProfiles(env: Record<string, string>, toolProfiles: unknown): Record<string, string> {
  const shimDir = ensureProfileShims(toolProfiles);
  return shimDir ? { ...env, PATH: shimDir + path.delimiter + (env.PATH ?? "") } : env;
}
