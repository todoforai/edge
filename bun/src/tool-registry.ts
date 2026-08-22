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

/** System python for pip installs/checks. Windows has no bare `python3` unless
 *  installed from python.org — `python3.exe` there is usually the Microsoft
 *  Store alias stub, which prints an install-from-Store nag and exits nonzero.
 *  `py` is the official launcher and resolves whatever CPython is installed. */
function systemPython(): string {
  if (os.platform() === "win32") return "py";
  for (const p of ["/usr/bin/python3", "/usr/bin/python"]) {
    if (fs.existsSync(p)) return p;
  }
  // Fall back to PATH, but skip our own venv.
  const pathDirs = (process.env.PATH || "").split(path.delimiter).filter(d => !d.includes(".todoforai"));
  for (const dir of pathDirs) {
    for (const exe of ["python3", "python"]) {
      const p = path.join(dir, exe);
      if (fs.existsSync(p)) return p;
    }
  }
  return "python3";
}

/** Where shell-based installs land (shared-fbe buildInstallCommand: npm/bun
 *  `--prefix ~/.local`, pip `--user`). The C bridge already prepends these
 *  (env_path.c) — mirror them here so a tool installed via either transport's
 *  shell path is visible to the edge's scan and exec env too. */
function localBinDirs(): string[] {
  const home = os.homedir();
  return os.platform() === "win32"
    ? [path.join(home, ".local"), path.join(home, ".local", "bin")] // npm on Windows puts bins in the prefix itself
    : [path.join(home, ".local", "bin")];
}

/** Bootstrapped Node tree (toolInstallCommand.ts ensureNodeSnippet). POSIX
 *  symlinks node/npm into tools/bin, but Windows keeps the whole extracted
 *  tree — npm.cmd needs its sibling node_modules\npm — so the dir itself
 *  must be on PATH. */
function nodeDir(): string { return path.join(TOOLS_DIR, "node"); }

function toolPathEntries(): string[] {
  const entries = [npmBinDir(), venvBinDir(), binDir(), ...localBinDirs()];
  if (os.platform() === "win32") entries.push(nodeDir());
  return entries;
}

/** Return env with tool dirs prepended to PATH. */
export function buildEnvWithTools(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  // Windows env vars are case-insensitive but JS objects aren't: process.env may
  // expose `Path` (not `PATH`). Merge both and write back to a single canonical key.
  const existingPath = env.PATH ?? env.Path ?? env.path ?? "";
  if (os.platform() === "win32") { delete env.Path; delete env.path; }
  env.PATH = toolPathEntries().join(path.delimiter) + path.delimiter + existingPath;
  return env;
}

function whichWithTools(name: string): string | null {
  const rawPath = process.env.PATH ?? process.env.Path ?? process.env.path ?? "";
  const dirs = [...toolPathEntries(), ...rawPath.split(path.delimiter)];
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

/** Resolve a catalog key to the actual binary filename on disk (e.g. slack → slack-cli). */
function binFileName(name: string): string {
  return TOOL_CATALOG[name]?.binName ?? name;
}

/** Shell command that checks whether a pip tool is importable/present. */
function pipCheckCmd(entry: typeof TOOL_CATALOG[string]): string {
  return entry.statusCmd || `${systemPython()} -c 'import ${entry.pkg.replace(/-/g, "_")}' 2>/dev/null`;
}

/** Check if a tool is installed (installer-aware). Sync — spawnSync for pip tools
 *  blocks the event loop, so only use off the reconnect path (user-triggered
 *  install flows). Reconnect scanning uses isToolInstalledAsync. */
export function isToolInstalled(name: string): boolean {
  const entry = TOOL_CATALOG[name];
  if (!entry) return false;

  if (entry.installer === "pip") {
    const r = spawnSync("sh", ["-c", pipCheckCmd(entry)], { stdio: "pipe", timeout: 5_000, env: buildEnvWithTools() });
    return r.status === 0;
  }

  return whichWithTools(binFileName(name)) !== null;
}

/** Async isToolInstalled — non-blocking pip check for the reconnect scan path. */
async function isToolInstalledAsync(name: string): Promise<boolean> {
  const entry = TOOL_CATALOG[name];
  if (!entry) return false;

  if (entry.installer === "pip") {
    return (await execShellAsync(pipCheckCmd(entry), buildEnvWithTools(), 5_000)).status === 0;
  }

  return whichWithTools(binFileName(name)) !== null;
}

// ── Find missing tools ──

/** Match tool names only in command position (start of line, after pipe, after && || ; $( ` xargs) */
export function findReferencedTools(content: string): string[] {
  // Strip quoted strings so tool names inside "foo|stripe|bar" or 'stripe' aren't matched
  const stripped = content
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");

  return Object.keys(TOOL_CATALOG).filter(name => {
    // Tools may be invoked under a different binary name than their catalog key
    // (e.g. todoai → todoforai-cli, slack-cli) or under a package alias
    // (todoai → tfa-cli). Match any of those tokens.
    const tokens = [name, TOOL_CATALOG[name].binName, ...(TOOL_CATALOG[name].aliases ?? [])]
      .filter((t): t is string => !!t);
    return tokens.some(tok => {
      const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Reject trailing hyphenated tokens like stripe-setup-dunning while still
      // allowing args like jq .foo. and known hyphenated bin names (slack-cli,
      // todoforai-cli) which are matched verbatim above.
      const re = new RegExp(
        String.raw`(?:^|[|;&\n]|&&|\|\||` +
        String.raw`\$\(|` + "`" +
        String.raw`|xargs\s+|sudo\s+|env\s+)\s*` +
        esc + String.raw`\b(?!-)`,
        "m"
      );
      return re.test(stripped);
    });
  });
}

export function findMissingTools(content: string): string[] {
  // `system` tools (curl, grep, rclone, …) come from the OS — never auto-installable.
  return findReferencedTools(content).filter(name => TOOL_CATALOG[name].installer !== "system" && !isToolInstalled(name));
}

// ── Installers ──

async function installBinary(name: string): Promise<boolean> {
  const urlFunc = BINARY_URL_FUNCS[name];
  if (!urlFunc) { log("warn", `No download URL for binary: ${name}`); return false; }

  const dir = binDir();
  fs.mkdirSync(dir, { recursive: true });
  const [url, isArchive] = await urlFunc();
  const fileName = binFileName(name);
  const destName = os.platform() === "win32" ? `${fileName}.exe` : fileName;
  const dest = path.join(dir, destName);
  const tmpPath = dest + ".tmp";

  log("info", `Downloading ${name} from ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const data = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tmpPath, data);

  if (isArchive) {
    const expectedNames = new Set([name, `${name}.exe`, fileName, `${fileName}.exe`]);
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

/** Display-only install command for the shell transcript notice. */
function getInstallCommand(name: string): string {
  const e = TOOL_CATALOG[name];
  return e.installCmd || {
    npm: `npm install --prefix ~/.todoforai/tools ${e.pkg}`,
    bun: `bun add --cwd ~/.todoforai/tools ${e.pkg}`,
    pip: `pip install ${e.pkg}`,
    binary: `download ${e.pkg}`,
  }[e.installer as string] || `install ${e.pkg}`;
}

export function installWithNpm(name: string, pkg: string) {
  const TIMEOUT_MS = 120_000;

  const install = () => {
    const args = ["install", "--prefix", TOOLS_DIR, pkg];
    const result = spawnSync("npm", args, {
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
  };

  log("info", `Installing ${name} via npm (${pkg})`);
  install();
}

/** Install an npm-registry package using `bun add` into TOOLS_DIR.
 *  Bun writes the bin shim to <cwd>/node_modules/.bin, matching the
 *  layout npm uses with `--prefix`, so npmBinDir() already covers
 *  discovery via whichWithTools / buildEnvWithTools. */
export function installWithBun(name: string, pkg: string) {
  const TIMEOUT_MS = 120_000;
  log("info", `Installing ${name} via bun (${pkg})`);
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  const result = spawnSync("bun", ["add", "--cwd", TOOLS_DIR, pkg], {
    stdio: "pipe", timeout: TIMEOUT_MS, shell: true,
  });
  const stderr = result.stderr?.toString().trim() || "";
  const stdout = result.stdout?.toString().trim() || "";
  if (result.error) {
    throw new Error(`bun add failed: ${result.error.message} | stderr: ${stderr || '(empty)'} | stdout: ${stdout || '(empty)'}`);
  }
  if (result.signal) {
    throw new Error(`bun add killed by ${result.signal}${result.signal === 'SIGTERM' ? ` (likely timed out after ${TIMEOUT_MS / 1000}s)` : ''} | stderr: ${stderr || '(empty)'}`);
  }
  if (result.status === null) {
    throw new Error(`bun add: null exit code (likely timed out after ${TIMEOUT_MS / 1000}s) | stderr: ${stderr || '(empty)'} | stdout: ${stdout || '(empty)'}`);
  }
  if (result.status !== 0) {
    throw new Error(`bun add failed (exit ${result.status}) | stderr: ${stderr || '(empty)'} | stdout: ${stdout || '(empty)'}`);
  }
}

function installWithPip(name: string, pkg: string) {
  const venvDir = path.join(TOOLS_DIR, "venv");
  const venvPython = os.platform() === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");

  // Use system python directly (absolute path where possible, never the venv)
  const sysPy = systemPython();

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
  const stderr = result.stderr?.toString().trim() || "";
  if (result.signal) throw new Error(`pip install killed by ${result.signal}${result.signal === 'SIGTERM' ? ' (likely timed out after 120s)' : ''}`);
  if (result.status !== 0) throw new Error(`pip install failed (exit ${result.status}): ${stderr || result.stdout?.toString().trim() || '(empty)'}`);
}

const INSTALLERS: Record<string, (name: string, pkg: string) => void | Promise<void>> = {
  npm: installWithNpm,
  bun: installWithBun,
  pip: installWithPip,
  // installBinary returns false (no URL resolver / download failed) without
  // throwing — convert to a throw so ensureToolDetailed reports failure
  // instead of a false success.
  binary: async (name: string, _pkg: string) => {
    if (!(await installBinary(name))) throw new Error(`No binary download available for ${name} on this platform`);
  },
  // "system" tools come from the OS package manager / rootfs preinstall — never
  // auto-install. Throw so install_tool doesn't report success for a no-op.
  system: (name: string) => { throw new Error(`${name} is OS-managed — install it via apt/brew/winget`); },
};

// ── Public API ──

// Simple mutex per tool name
const installing = new Set<string>();

export async function ensureTool(name: string): Promise<boolean> {
  return (await ensureToolDetailed(name)).ok;
}

/** Like `ensureTool`, but keeps the installer's failure reason (pip/npm
 *  stderr, download error) so RPC callers can surface it instead of a
 *  generic "Failed to install X". `ok:false` without `error` = no-op
 *  (unknown tool / already installed / install already in flight). */
export async function ensureToolDetailed(name: string): Promise<{ ok: boolean; error?: string }> {
  if (!(name in TOOL_CATALOG)) return { ok: false, error: `Unknown tool: ${name}` };
  if (installing.has(name)) return { ok: false, error: `${name} install already in progress` };

  installing.add(name);
  try {
    if (isToolInstalled(name)) return { ok: false }; // already installed

    const { pkg, installer: installerType } = TOOL_CATALOG[name];
    const installFn = INSTALLERS[installerType];
    if (!installFn) { log("warn", `Unknown installer: ${installerType}`); return { ok: false, error: `Unknown installer: ${installerType}` }; }

    log("info", `Installing tool: ${name} (${pkg})`);
    fs.mkdirSync(TOOLS_DIR, { recursive: true });
    await installFn(name, pkg);
    log("info", `Successfully installed ${name}`);
    return { ok: true };
  } catch (e: any) {
    log("warn", `Failed to install ${name}: ${e.message}`);
    return { ok: false, error: e?.message || `Failed to install ${name}` };
  } finally {
    installing.delete(name);
  }
}

/** spawnSync doesn't throw on non-zero exit or timeout — check status/signal
 *  explicitly, otherwise a failed `npm uninstall` would be reported as
 *  success and the tile would flip to "not installed" while the binary is
 *  still there. */
function checkSpawn(what: string, r: ReturnType<typeof spawnSync>): void {
  if (r.error) throw r.error;
  if (r.signal) throw new Error(`${what} killed by ${r.signal}${r.signal === "SIGTERM" ? " (likely timed out)" : ""}`);
  if (r.status !== 0) {
    const detail = r.stderr?.toString().trim() || r.stdout?.toString().trim() || "(no output)";
    throw new Error(`${what} failed (exit ${r.status}): ${detail}`);
  }
}

export function uninstallToolDetailed(name: string): { ok: boolean; error?: string } {
  if (!(name in TOOL_CATALOG)) return { ok: false, error: `Unknown tool: ${name}` };
  const { pkg, installer: installerType } = TOOL_CATALOG[name];

  try {
    if (installerType === "binary") {
      // binFileName, not the catalog key: aliased entries (ripgrep→rg,
      // todoai→todoforai-cli) install under their binName — deleting `name`
      // would remove nothing and still report success.
      const bin = binFileName(name);
      const exts = os.platform() === "win32" ? ["", ".exe"] : [""];
      for (const ext of exts) {
        const p = path.join(binDir(), bin + ext);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    } else if (installerType === "npm") {
      checkSpawn("npm uninstall", spawnSync("npm", ["uninstall", "--prefix", TOOLS_DIR, pkg], { stdio: "pipe", timeout: 30_000, shell: true }));
    } else if (installerType === "bun") {
      checkSpawn("bun remove", spawnSync("bun", ["remove", "--cwd", TOOLS_DIR, pkg], { stdio: "pipe", timeout: 30_000, shell: true }));
    } else if (installerType === "pip") {
      const venvPython = os.platform() === "win32"
        ? path.join(TOOLS_DIR, "venv", "Scripts", "python.exe")
        : path.join(TOOLS_DIR, "venv", "bin", "python");
      const python = fs.existsSync(venvPython) ? venvPython : systemPython();
      checkSpawn("pip uninstall", spawnSync(python, ["-m", "pip", "uninstall", "-y", pkg], { stdio: "pipe", timeout: 30_000 }));
    } else {
      return { ok: false, error: `system-installer tools are managed by the OS package manager` };
    }
    log("info", `Uninstalled tool: ${name}`);
    return { ok: true };
  } catch (e: any) {
    log("warn", `Failed to uninstall ${name}: ${e.message}`);
    return { ok: false, error: e?.message || `Failed to uninstall ${name}` };
  }
}

/** Auto-install catalog tools referenced by `content`. Returns a shell-transcript
 *  notice for the block result ("" when nothing was missing). */
export async function autoInstallMissingTools(content: string): Promise<string> {
  const lines = [];
  for (const name of findMissingTools(content)) {
    // `isToolInstalled` alone judges success: catalog aliases sharing one binary
    // (zele/zele-calendar) make the second ensureTool a no-op returning false.
    await ensureTool(name);
    const ok = isToolInstalled(name);
    lines.push(`$ ${getInstallCommand(name)}\n[${ok ? "installed" : "install failed"}: ${name}]`);
  }
  return lines.length ? lines.join("\n") + "\n" : "";
}

/** Scan all catalog tools: check binary presence, version, and auth status. */
type ToolState = { installed: boolean; version?: string; statusOutput?: string; authenticated?: boolean; description?: string; label?: string };

// ── User CLI-tool overrides ──
// ~/.todoforai/custom_tools.json lets the user shape the tool list this edge
// advertises to the agent: hide a catalog tool (`"xurl": {"enabled": false}`)
// or add a non-catalog binary with a description the agent sees on its bash
// tool (`"bird": {"description": "Fast X CLI: tweet, read, search."}`).
// Non-catalog binaries are only reported when actually found on PATH.
// Future: per-project overrides from a workspace-local .todoforai/ dir.
type CustomToolConfig = { enabled?: boolean; description?: string; label?: string };

const CUSTOM_TOOLS_PATH = path.join(os.homedir(), ".todoforai", "custom_tools.json");

function loadCustomTools(): Record<string, CustomToolConfig> {
  try {
    return JSON.parse(fs.readFileSync(CUSTOM_TOOLS_PATH, "utf-8"));
  } catch {
    return {};
  }
}

/** Upsert (conf=null → delete) one entry in ~/.todoforai/custom_tools.json. */
export function setCustomTool(name: string, conf: CustomToolConfig | null): void {
  const all = loadCustomTools();
  if (conf) all[name] = { ...all[name], ...conf };
  else delete all[name];
  fs.mkdirSync(path.dirname(CUSTOM_TOOLS_PATH), { recursive: true });
  fs.writeFileSync(CUSTOM_TOOLS_PATH, JSON.stringify(all, null, 2) + "\n");
}

/** Is `name` an executable on the tool-augmented PATH? Used by the UI to
 *  reject registering a custom tool that isn't actually installed here. */
export function probeBinary(name: string): boolean {
  return whichWithTools(name) !== null;
}

/** Async execFile that never rejects: resolves {status, stdout, stderr}. Non-blocking spawnSync replacement. */
function execFileAsync(file: string, args: string[], timeout: number, env?: NodeJS.ProcessEnv): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    execFile(file, args, { env, timeout, encoding: "utf-8", maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ status: err ? 1 : 0, stdout: (stdout || "").toString(), stderr: (stderr || "").toString() });
    });
  });
}

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
  // Installed-check in parallel (pip tools shell out — must not block the loop),
  // then run version/status checks in parallel.
  const installed: [string, typeof TOOL_CATALOG[string]][] = [];
  await Promise.all(entries.map(async ([name, entry]) => {
    if (await isToolInstalledAsync(name)) {
      installed.push([name, entry]);
    } else {
      result[name] = { installed: false };
    }
  }));

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

  applyCustomTools(result);
  return result;
}

/** Overlay ~/.todoforai/custom_tools.json onto a scan result (in place). */
function applyCustomTools(result: Record<string, ToolState>): void {
  for (const [name, conf] of Object.entries(loadCustomTools())) {
    if (conf.enabled === false) { delete result[name]; continue; }
    const overlay = {
      ...(conf.description ? { description: conf.description } : {}),
      ...(conf.label ? { label: conf.label } : {}),
    };
    if (result[name]?.installed) {
      result[name] = { ...result[name], ...overlay };
    } else if (!(name in TOOL_CATALOG) && whichWithTools(name)) {
      result[name] = { installed: true, authenticated: true, ...overlay };
    }
  }
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

// Async only — spawnSync here would freeze Bun's single-threaded event loop
// and stall all edge RPCs (file reads time out while shell survives).
async function isMounted(mountPoint: string): Promise<boolean> {
  if (!HAS_FUSE) return false;
  if (IS_LINUX) {
    return (await execFileAsync("mountpoint", ["-q", mountPoint], 3_000)).status === 0;
  }
  const r = await execFileAsync("mount", [], 3_000);
  return r.stdout.includes(mountPoint);
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

async function mountRemote(remote: string, mountPoint: string): Promise<boolean> {
  const rclone = whichWithTools("rclone");
  if (!rclone) return false;

  fs.mkdirSync(mountPoint, { recursive: true });

  const port = rcPort(remote);
  // Always register before the isMounted check — needed even if already mounted (e.g. after edge restart)
  rcPortMap.set(remote, port);

  if (await isMounted(mountPoint)) {
    log("info", `Already mounted: ${remote}: → ${mountPoint}`);
    return true;
  }

  const logFile = `/tmp/rclone-${sanitizeRemoteName(remote)}.log`;
  const args = ["mount", `${remote}:`, mountPoint, ...MOUNT_FLAGS,
    "--rc", "--rc-addr", `localhost:${port}`,
    "--log-file", logFile];
  log("info", `Mounting ${remote}: → ${mountPoint}`);
  const r = await execFileAsync(rclone, args, 10_000, buildEnvWithTools());
  if (r.status !== 0) {
    rcPortMap.delete(remote);
    log("warn", `Failed to mount ${remote}: ${r.stderr.trim()}`);
    return false;
  }

  // Verify the daemon actually mounted (poll up to 3s)
  for (let i = 0; i < 6; i++) {
    if (await isMounted(mountPoint)) {
      log("info", `Mounted ${remote}: → ${mountPoint}`);
      return true;
    }
    await new Promise(res => setTimeout(res, 500));
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

// CONNECTED_EDGE fires on every reconnect (sleep/resume churn); probing all
// remotes each time (up to 10s per unreachable remote) is wasteful — throttle
// to one probe pass per interval.
let lastProbe = 0;
const AUTO_MOUNT_INTERVAL_MS = 10 * 60_000;

/** Mount all configured rclone remotes that aren't already mounted. */
export async function autoMountRcloneRemotes(): Promise<void> {
  if (!HAS_FUSE) return;
  if (Date.now() - lastProbe < AUTO_MOUNT_INTERVAL_MS) return;
  lastProbe = Date.now();

  const rclone = whichWithTools("rclone");
  if (!rclone) return;

  const r = await execFileAsync(rclone, ["listremotes"], 5_000, buildEnvWithTools());
  if (r.status !== 0) return;
  const remotes = r.stdout.trim().split("\n").map(s => s.replace(/:$/, "")).filter(Boolean);

  for (const remote of remotes) {
    const safeName = sanitizeRemoteName(remote);
    const mountPoint = path.join(MNT_DIR, safeName);

    // Generic health check: can we reach the remote at all?
    const check = await execFileAsync(rclone, ["lsd", `${remote}:`, "--max-depth", "0"], 10_000, buildEnvWithTools());
    if (check.status !== 0) {
      log("info", `Skipping mount for ${remote} (not reachable)`);
      continue;
    }

    await mountRemote(remote, mountPoint);
  }
}

/** Unmount all rclone FUSE mounts under ~/.todoforai/mnt/.
 *  Sync (process-exit path). Unmounting a non-mounted dir fails silently. */
export function unmountAllRclone(): void {
  if (!HAS_FUSE || !fs.existsSync(MNT_DIR)) return;
  for (const entry of fs.readdirSync(MNT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    unmountPoint(path.join(MNT_DIR, entry.name));
  }
}
