/** Per-agent login profiles on the native edge: writes the shared shims
 *  (packages/shared-fbe toolProfiles.ts) and puts their dir first on PATH.
 *  No profiles (the normal case) = env untouched. */

import fs from "fs";
import os from "os";
import path from "path";
import { toolProfileBins, toolProfileHash, toolProfileShimScript } from "../../../packages/shared-fbe/src/toolProfiles";

const ROOT = path.join(os.homedir(), ".todoforai");

export function profileDir(name: string): string {
  return path.join(ROOT, "profiles", name);
}

/** Shim dir to prepend to PATH for this mapping, or undefined when there is nothing to do. */
export function ensureProfileShims(toolProfiles: unknown): string | undefined {
  const bins = toolProfileBins(toolProfiles);
  if (!bins.length) return undefined;
  if (os.platform() === "win32") {
    console.log("[tool-profiles] separate login profiles are not supported on Windows yet; using the shared login");
    return undefined;
  }
  const shimDir = path.join(ROOT, "profile-shims", toolProfileHash(bins));
  for (const [bin, name] of bins) {
    fs.mkdirSync(profileDir(name), { recursive: true, mode: 0o700 });
    const file = path.join(shimDir, bin);
    const script = toolProfileShimScript(bin, name);
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === script) continue;
    fs.mkdirSync(shimDir, { recursive: true });
    const tmp = path.join(shimDir, `.${bin}.${process.pid}`);
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
