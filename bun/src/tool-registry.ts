/** Auto-install missing tools into ~/.todoforai/tools/ */

import fs from "fs";
import os from "os";
import path from "path";
import { execSync, spawnSync, execFile } from "child_process";
import { TOOL_CATALOG, BINARY_URL_FUNCS } from "./tool-catalog.js";

const TOOLS_DIR = path.join(os.homedir(), ".todoforai", "tools");
const MNT_DIR  = path.join(os.homedir(), ".todoforai", "mnt");

const log = (level: string, ...args: any[]) => console.log(`[tool-registry:${level}]`, ...args);

// ── Path helpers ──

function binDir(): string { return path.join(TOOLS_DIR, "bin"); }
function npmBinDir(): string { return path.join(TOOLS_DIR, "node_modules", ".bin"); }
function venvBinDir(): string {
  return os.platform() === "win32"
    ? path.join(TOOLS_DIR, "venv", "Scripts")
    : path.join(TOOLS_DIR, "venv", "bin");
}

function toolPathEntries(): string[] { return [npmBinDir(), venvBinDir(), binDir()]; }

/** Return env with tool dirs prepended to PATH. */
export function buildEnvWithTools(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  env.PATH = toolPathEntries().join(path.delimiter) + path.delimiter + (env.PATH || "");
  return env;
}

function whichWithTools(name: string): string | null {
  const dirs = [...toolPathEntries(), ...(process.env.PATH || "").split(path.delimiter)];
  const exts = os.platform() === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const full = path.join(dir, name + ext);
      try {
        fs.accessSync(full, fs.constants.X_OK);
        return full;
      } catch {}
    }
  }
  return null;
}

/** Check if a tool is installed (installer-aware). */
function isToolInstalled(name: string): boolean {
  const entry = TOOL_CATALOG[name];
  if (!entry) return false;
  
  if (entry.installer === "pip") {
    const checkCmd = entry.statusCmd || `python3 -c 'import ${entry.pkg.replace(/-/g, "_")}' 2>/dev/null`;
    const r = spawnSync("sh", ["-c", checkCmd], { stdio: "pipe", timeout: 5_000 });
    return r.status === 0;
  }
  
  return whichWithTools(name) !== null;
}

// ── Find missing tools ──

/** Match tool names only in command position (start of line, after pipe, after && || ; $( ` xargs) */
export function findReferencedTools(content: string): string[] {
  // Strip quoted strings so tool names inside "foo|stripe|bar" or 'stripe' aren't matched
  const stripped = content
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");

  return Object.keys(TOOL_CATALOG).filter(name => {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Reject hyphenated tokens like stripe-setup-dunning while still allowing args like jq .foo.
    const re = new RegExp(
      String.raw`(?:^|[|;&\n]|&&|\|\||` +
      String.raw`\$\(|` + "`" +
      String.raw`|xargs\s+|sudo\s+|env\s+)\s*` +
      esc + String.raw`\b(?!-)`,
      "m"
    );
    return re.test(stripped);
  });
}

export function findMissingTools(content: string): string[] {
  return findReferencedTools(content).filter(name => !isToolInstalled(name));
}

// ── Installers ──

async function installBinary(name: string): Promise<boolean> {
  const urlFunc = BINARY_URL_FUNCS[name];
  if (!urlFunc) { log("warn", `No download URL for binary: ${name}`); return false; }

  const dir = binDir();
  fs.mkdirSync(dir, { recursive: true });
  const [url, isArchive] = await urlFunc();
  const destName = os.platform() === "win32" ? `${name}.exe` : name;
  const dest = path.join(dir, destName);
  const tmpPath = dest + ".tmp";

  log("info", `Downloading ${name} from ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const data = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tmpPath, data);

  if (isArchive) {
    const expectedNames = new Set([name, `${name}.exe`]);
    if (url.endsWith(".tar.gz") || url.endsWith(".tgz")) {
      await extractTarBinary(tmpPath, dest, expectedNames);
    } else if (url.endsWith(".zip")) {
      await extractZipBinary(tmpPath, dest, expectedNames);
    } else {
      throw new Error(`Unsupported archive: ${url}`);
    }
    fs.unlinkSync(tmpPath);
  } else {
    fs.renameSync(tmpPath, dest);
  }

  fs.chmodSync(dest, 0o755);
  return true;
}

async function extractTarBinary(archivePath: string, dest: string, expectedNames: Set<string>) {
  // Use system tar
  const tmpDir = dest + ".extract";
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    execSync(`tar xzf "${archivePath}" -C "${tmpDir}"`, { stdio: "pipe" });
    const found = findFileRecursive(tmpDir, expectedNames);
    if (!found) throw new Error(`Binary not found in tar archive`);
    fs.copyFileSync(found, dest);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function extractZipBinary(archivePath: string, dest: string, expectedNames: Set<string>) {
  const tmpDir = dest + ".extract";
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    execSync(`unzip -o "${archivePath}" -d "${tmpDir}"`, { stdio: "pipe" });
    const found = findFileRecursive(tmpDir, expectedNames);
    if (!found) throw new Error(`Binary not found in zip archive`);
    fs.copyFileSync(found, dest);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function findFileRecursive(dir: string, names: Set<string>): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(full, names);
      if (found) return found;
    } else if (names.has(entry.name)) {
      return full;
    }
  }
  return null;
}

export function installWithNpm(name: string, pkg: string) {
  const TIMEOUT_MS = 120_000;
  log("info", `Installing ${name} via npm (${pkg})`);
  const result = spawnSync("npm", ["install", "--prefix", TOOLS_DIR, pkg], {
    stdio: "pipe", timeout: TIMEOUT_MS, shell: true,
  });
  const stderr = result.stderr?.toString().trim() || "";
  const stdout = result.stdout?.toString().trim() || "";
  if (result.error) {
    throw new Error(`npm install failed: ${result.error.message} | stderr: ${stderr || '(empty)'} | stdout: ${stdout || '(empty)'}`);
  }
  if (result.signal) {
    throw new Error(`npm install killed by ${result.signal}${result.signal === 'SIGTERM' ? ` (likely timed out after ${TIMEOUT_MS / 1000}s)` : ''} | stderr: ${stderr || '(empty)'}`);
  }
  // On Windows with shell:true, timeout-kills can yield status:null AND signal:null.
  if (result.status === null) {
    throw new Error(`npm install: null exit code (likely timed out after ${TIMEOUT_MS / 1000}s on Windows, signal not propagated through cmd.exe) | stderr: ${stderr || '(empty)'} | stdout: ${stdout || '(empty)'}`);
  }
  if (result.status !== 0) {
    throw new Error(`npm install failed (exit ${result.status}) | stderr: ${stderr || '(empty)'} | stdout: ${stdout || '(empty)'}`);
  }
}

function installWithPip(name: string, pkg: string) {
  const venvDir = path.join(TOOLS_DIR, "venv");
  const venvPython = os.platform() === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");

  // Use system python directly (find absolute path, not from venv)
  let sysPy = "/usr/bin/python3";
  if (!fs.existsSync(sysPy)) {
    sysPy = "/usr/bin/python";
  }
  if (!fs.existsSync(sysPy)) {
    // Fallback to PATH, but filter out venv
    const pathDirs = (process.env.PATH || "").split(path.delimiter).filter(d => !d.includes(".todoforai"));
    for (const dir of pathDirs) {
      const p3 = path.join(dir, "python3");
      const p = path.join(dir, "python");
      if (fs.existsSync(p3)) { sysPy = p3; break; }
      if (fs.existsSync(p)) { sysPy = p; break; }
    }
  }

  let python: string = sysPy;
  let useVenv = false;

  // Check if existing venv has working pip
  if (fs.existsSync(venvPython)) {
    const check = spawnSync(venvPython, ["-m", "pip", "--version"], { stdio: "pipe", timeout: 5_000 });
    if (check.status === 0) {
      python = venvPython;
      useVenv = true;
    } else {
      // Venv exists but is broken, remove it
      log("warn", `Removing broken venv at ${venvDir}`);
      try { fs.rmSync(venvDir, { recursive: true, force: true }); } catch {}
    }
  }

  // Try creating venv if we don't have a working one
  if (!useVenv) {
    log("info", `Creating venv at ${venvDir}`);
    const r = spawnSync(sysPy, ["-m", "venv", venvDir], { stdio: "pipe", timeout: 30_000 });
    if (r.status === 0 && fs.existsSync(venvPython)) {
      const check = spawnSync(venvPython, ["-m", "pip", "--version"], { stdio: "pipe", timeout: 5_000 });
      if (check.status === 0) {
        python = venvPython;
        useVenv = true;
      }
    }
  }

  // Fallback to system python with --user
  if (!useVenv) {
    log("warn", `venv not usable, falling back to --user install`);
    python = sysPy;
  }

  log("info", `Installing ${name} via pip (${pkg})`);
  const args = useVenv
    ? ["-m", "pip", "install", pkg]
    : ["-m", "pip", "install", "--user", pkg];
  const result = spawnSync(python, args, { stdio: "pipe", timeout: 120_000 });
  
  if (result.signal) {
    log("error", `Failed to install ${name}: killed by ${result.signal}${result.signal === 'SIGTERM' ? ' (likely timed out after 120s)' : ''}`);
  } else if (result.status !== 0) {
    log("error", `Failed to install ${name}: ${result.stderr?.toString() || result.stdout?.toString()}`);
  }

}

const INSTALLERS: Record<string, (name: string, pkg: string) => void | Promise<void>> = {
  npm: installWithNpm,
  pip: installWithPip,
  binary: async (name: string, _pkg: string) => { await installBinary(name); },
};

// ── Public API ──

// Simple mutex per tool name
const installing = new Set<string>();

export async function ensureTool(name: string): Promise<boolean> {
  if (!(name in TOOL_CATALOG)) return false;
  if (installing.has(name)) return false;

  installing.add(name);
  try {
    if (isToolInstalled(name)) return false; // already installed

    const { pkg, installer: installerType } = TOOL_CATALOG[name];
    const installFn = INSTALLERS[installerType];
    if (!installFn) { log("warn", `Unknown installer: ${installerType}`); return false; }

    log("info", `Installing tool: ${name} (${pkg})`);
    fs.mkdirSync(TOOLS_DIR, { recursive: true });
    await installFn(name, pkg);
    log("info", `Successfully installed ${name}`);
    return true;
  } catch (e: any) {
    log("warn", `Failed to install ${name}: ${e.message}`);
    return false;
  } finally {
    installing.delete(name);
  }
}

export function uninstallTool(name: string): boolean {
  if (!(name in TOOL_CATALOG)) return false;
  const { pkg, installer: installerType } = TOOL_CATALOG[name];

  try {
    if (installerType === "binary") {
      const exts = os.platform() === "win32" ? ["", ".exe"] : [""];
      for (const ext of exts) {
        const p = path.join(binDir(), name + ext);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    } else if (installerType === "npm") {
      spawnSync("npm", ["uninstall", "--prefix", TOOLS_DIR, pkg], { stdio: "pipe", timeout: 30_000, shell: true });
    } else if (installerType === "pip") {
      const venvPython = os.platform() === "win32"
        ? path.join(TOOLS_DIR, "venv", "Scripts", "python.exe")
        : path.join(TOOLS_DIR, "venv", "bin", "python");
      const python = fs.existsSync(venvPython) ? venvPython : "python3";
      spawnSync(python, ["-m", "pip", "uninstall", "-y", pkg], { stdio: "pipe", timeout: 30_000 });
    }
    log("info", `Uninstalled tool: ${name}`);
    return true;
  } catch (e: any) {
    log("warn", `Failed to uninstall ${name}: ${e.message}`);
    return false;
  }
}

export async function ensureToolsForCommand(content: string): Promise<string[]> {
  const missing = findMissingTools(content);
  if (!missing.length) return [];
  const installed: string[] = [];
  for (const name of missing) {
    if (await ensureTool(name)) installed.push(name);
  }
  return installed;
}

/** Scan all catalog tools: check binary presence, version, and auth status. */
type ToolState = { installed: boolean; version?: string; statusOutput?: string; authenticated?: boolean };

function execShellAsync(cmd: string, env: NodeJS.ProcessEnv, timeout: number): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    execFile("sh", ["-c", cmd], { env, timeout, encoding: "utf-8", maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ status: err ? 1 : 0, stdout: (stdout || "").toString(), stderr: (stderr || "").toString() });
    });
  });
}

export async function scanCatalogTools(): Promise<Record<string, ToolState>> {
  const result: Record<string, ToolState> = {};
  const env = buildEnvWithTools();

  const entries = Object.entries(TOOL_CATALOG);
  // Check installation synchronously (fast which lookups), then run version/status checks in parallel
  const installed: [string, typeof TOOL_CATALOG[string]][] = [];
  for (const [name, entry] of entries) {
    if (!isToolInstalled(name)) {
      result[name] = { installed: false };
    } else {
      installed.push([name, entry]);
    }
  }

  await Promise.all(installed.map(async ([name, entry]) => {
    const state: ToolState = { installed: true };

    if (entry.versionCmd) {
      try {
        const r = await execShellAsync(entry.versionCmd, env, 5_000);
        if (r.status === 0) state.version = r.stdout.trim().slice(0, 100);
      } catch {}
    }

    if (entry.statusCmd) {
      try {
        const r = await execShellAsync(entry.statusCmd, env, 10_000);
        state.authenticated = r.status === 0;
        state.statusOutput = (r.stdout || r.stderr).trim().slice(0, 200);
      } catch {
        state.authenticated = false;
      }
    } else {
      state.authenticated = true;
    }

    result[name] = state;
  }));

  return result;
}

// ── Auto-mount rclone remotes as FUSE ──

const MOUNT_FLAGS = [
  "--vfs-cache-mode", "full",
  "--vfs-fast-fingerprint",
  "--no-modtime",
  "--attr-timeout", "1h",
  "--vfs-cache-max-size", "400M",
  "--daemon",
  "--log-level", "INFO",
];

const IS_LINUX = os.platform() === "linux";
const IS_MAC   = os.platform() === "darwin";
const HAS_FUSE = IS_LINUX || IS_MAC;

function isMounted(mountPoint: string): boolean {
  if (!HAS_FUSE) return false;
  try {
    if (IS_LINUX) {
      return spawnSync("mountpoint", ["-q", mountPoint], { stdio: "pipe", timeout: 3_000 }).status === 0;
    }
    // macOS: check /sbin/mount output
    const r = spawnSync("mount", [], { stdio: "pipe", timeout: 3_000, encoding: "utf-8" });
    return (r.stdout || "").includes(mountPoint);
  } catch {
    return false;
  }
}

function unmountPoint(mountPoint: string): void {
  try {
    if (IS_LINUX) {
      spawnSync("fusermount", ["-uz", mountPoint], { stdio: "pipe", timeout: 5_000 });
    } else if (IS_MAC) {
      spawnSync("umount", [mountPoint], { stdio: "pipe", timeout: 5_000 });
    }
  } catch {}
}

function sanitizeRemoteName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.@-]/g, "_");
}

/** Deterministic RC port per remote: 5600–5699 */
function rcPort(remote: string): number {
  let h = 0;
  for (let i = 0; i < remote.length; i++) h = (h * 31 + remote.charCodeAt(i)) & 0xffff;
  return 5600 + (h % 100);
}

const rcPortMap = new Map<string, number>(); // remote → port (populated on mount)

/** Trigger vfs/refresh for the parent dir of absPath. No-op if RC not available. */
export async function refreshMountPath(absPath: string): Promise<void> {
  for (const [remote, port] of rcPortMap) {
    const mountPoint = path.join(MNT_DIR, sanitizeRemoteName(remote));
    if (absPath !== mountPoint && !absPath.startsWith(mountPoint + path.sep)) continue;
    // Refresh the parent directory (rclone refreshes dir listings, not individual files)
    const parentAbs = path.dirname(absPath);
    const dirInMount = parentAbs.slice(mountPoint.length) || "/";
    try {
      const res = await fetch(`http://localhost:${port}/vfs/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir: dirInMount, recursive: false }),
        signal: AbortSignal.timeout(3_000),
      });
      if (!res.ok) log("warn", `vfs/refresh failed for ${remote}: HTTP ${res.status}`);
    } catch { /* RC not up yet or timed out, ignore */ }
    return;
  }
}

function mountRemote(remote: string, mountPoint: string): boolean {
  const rclone = whichWithTools("rclone");
  if (!rclone) return false;

  fs.mkdirSync(mountPoint, { recursive: true });

  const port = rcPort(remote);
  // Always register before the isMounted check — needed even if already mounted (e.g. after edge restart)
  rcPortMap.set(remote, port);

  if (isMounted(mountPoint)) {
    log("info", `Already mounted: ${remote}: → ${mountPoint}`);
    return true;
  }

  const logFile = `/tmp/rclone-${sanitizeRemoteName(remote)}.log`;
  const args = ["mount", `${remote}:`, mountPoint, ...MOUNT_FLAGS,
    "--rc", "--rc-addr", `localhost:${port}`,
    "--log-file", logFile];
  log("info", `Mounting ${remote}: → ${mountPoint}`);
  const r = spawnSync(rclone, args, { stdio: "pipe", timeout: 10_000, env: buildEnvWithTools() });
  if (r.status !== 0) {
    rcPortMap.delete(remote);
    log("warn", `Failed to mount ${remote}: ${r.stderr?.toString().trim()}`);
    return false;
  }

  // Verify the daemon actually mounted (poll up to 3s)
  for (let i = 0; i < 6; i++) {
    if (isMounted(mountPoint)) {
      log("info", `Mounted ${remote}: → ${mountPoint}`);
      return true;
    }
    spawnSync("sleep", ["0.5"], { stdio: "pipe" });
  }
  // Read rclone log for the actual error
  let logTail = "";
  try {
    const content = fs.readFileSync(logFile, "utf-8");
    const lines = content.trim().split("\n");
    logTail = lines.slice(-5).join("\n");
  } catch {}
  log("warn", `Mount daemon started but ${remote}: not yet visible at ${mountPoint}${logTail ? `\nRclone log tail:\n${logTail}` : ""}`);
  return false;
}

/** Mount all configured rclone remotes that aren't already mounted. */
export function autoMountRcloneRemotes(): void {
  if (!HAS_FUSE) return;

  const rclone = whichWithTools("rclone");
  if (!rclone) return;

  let remotes: string[];
  try {
    const r = spawnSync(rclone, ["listremotes"], { stdio: "pipe", timeout: 5_000, env: buildEnvWithTools() });
    if (r.status !== 0) return;
    remotes = (r.stdout?.toString() || "").trim().split("\n").map(s => s.replace(/:$/, "")).filter(Boolean);
  } catch { return; }

  for (const remote of remotes) {
    const safeName = sanitizeRemoteName(remote);
    const mountPoint = path.join(MNT_DIR, safeName);

    // Generic health check: can we reach the remote at all?
    const check = spawnSync(rclone, ["lsd", `${remote}:`, "--max-depth", "0"], {
      stdio: "pipe", timeout: 10_000, env: buildEnvWithTools(),
    });
    if (check.status !== 0) {
      log("info", `Skipping mount for ${remote} (not reachable)`);
      continue;
    }

    mountRemote(remote, mountPoint);
  }
}

/** Unmount all rclone FUSE mounts under ~/.todoforai/mnt/. */
export function unmountAllRclone(): void {
  if (!HAS_FUSE || !fs.existsSync(MNT_DIR)) return;
  for (const entry of fs.readdirSync(MNT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const mountPoint = path.join(MNT_DIR, entry.name);
    if (isMounted(mountPoint)) {
      log("info", `Unmounting ${mountPoint}`);
      unmountPoint(mountPoint);
    }
  }
}
