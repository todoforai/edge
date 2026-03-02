/** Auto-install missing tools into ~/.todoforai/tools/ */

import fs from "fs";
import os from "os";
import path from "path";
import { execSync, spawnSync } from "child_process";
import { TOOL_REGISTRY, BINARY_URL_FUNCS } from "./tool-catalog.js";

const TOOLS_DIR = path.join(os.homedir(), ".todoforai", "tools");

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
  const exts = os.platform() === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
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

// ── Find missing tools ──

/** Match tool names only in command position (start of line, after pipe, after && || ; $( ` xargs) */
export function findReferencedTools(content: string): string[] {
  return Object.keys(TOOL_REGISTRY).filter(name => {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Command position: start of string/line, or preceded by | && || ; $( ` xargs sudo env
    const re = new RegExp(
      String.raw`(?:^|[|;&\n]|&&|\|\||` +
      String.raw`\$\(|` + "`" +
      String.raw`|xargs\s+|sudo\s+|env\s+)\s*` +
      esc + String.raw`\b`,
      "m"
    );
    return re.test(content);
  });
}

export function findMissingTools(content: string): string[] {
  return findReferencedTools(content).filter(name => !whichWithTools(name));
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

function installWithNpm(name: string, pkg: string) {
  const npm = whichWithTools("npm") || "npm";
  log("info", `Installing ${name} via npm (${pkg})`);
  spawnSync(npm, ["install", "--prefix", TOOLS_DIR, pkg], {
    stdio: "pipe", timeout: 120_000,
  });
}

function installWithPip(name: string, pkg: string) {
  const venvDir = path.join(TOOLS_DIR, "venv");
  const python = os.platform() === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");

  // Create venv if needed
  if (!fs.existsSync(python)) {
    log("info", `Creating venv at ${venvDir}`);
    const py = whichWithTools("python3") || whichWithTools("python") || "python3";
    spawnSync(py, ["-m", "venv", venvDir], { stdio: "pipe" });
  }

  log("info", `Installing ${name} via pip (${pkg})`);
  spawnSync(python, ["-m", "pip", "install", pkg], {
    stdio: "pipe", timeout: 120_000,
  });
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
  if (!(name in TOOL_REGISTRY)) return false;
  if (installing.has(name)) return false;

  installing.add(name);
  try {
    if (whichWithTools(name)) return false; // already installed

    const [pkg, installerType] = TOOL_REGISTRY[name];
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

export async function ensureToolsForCommand(content: string): Promise<string[]> {
  const missing = findMissingTools(content);
  if (!missing.length) return [];
  const installed: string[] = [];
  for (const name of missing) {
    if (await ensureTool(name)) installed.push(name);
  }
  return installed;
}
