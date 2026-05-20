import fs from "fs";
import path from "path";
import os from "os";
import { readFileContent } from "./files.js";
import { resolveFilePath, getPlatformDefaultDirectory, getPathOrDefault } from "./path-utils.js";
import { executeBlock, waitForCompletion, getBlockOutput, getBlockRawOutput, clearBlockOutput, isBlockAlive, sendInput, getPid, findBlockIdByPid, consumeExitedOutput, pendingToolApprovals, type SendFn } from "./shell.js";
import { msg } from "./constants.js";
import { ensureTool, uninstallTool, buildEnvWithTools, scanCatalogTools } from "./tool-registry.js";
import { getConnectionEnv } from "./connection-context.js";
import { TOOL_CATALOG } from "./tool-catalog.js";
import { getGlobalEdgeInstance } from "./edge.js";
import { discoverSkills } from "./skills.js";

// ── Registry ──

type FnHandler = (args: Record<string, any>, client?: any) => Promise<any>;
export const FUNCTION_REGISTRY = new Map<string, FnHandler>();

function register(name: string, fn: FnHandler) {
  FUNCTION_REGISTRY.set(name, fn);
}

// ── Functions ──

register("list_available_functions", async () => {
  const names = [...FUNCTION_REGISTRY.keys()];
  return { functions: names, count: names.length };
});

register("get_current_directory", async () => ({ current_directory: process.cwd() }));

register("get_environment_variable", async (args) => ({
  variable: args.var_name,
  value: process.env[args.var_name] ?? null,
}));

register("get_system_info", async () => {
  let system = os.platform();
  if (system === "darwin") system = "macOS";
  else if (system === "linux") {
    try {
      const release = fs.readFileSync("/etc/os-release", "utf-8");
      const m = release.match(/PRETTY_NAME="(.+?)"/);
      if (m) system = m[1];
      else system = "Linux";
    } catch { system = "Linux"; }
  } else if (system === "win32") {
    system = `Windows ${os.release()}`;
  }
  const shell = process.env.SHELL ? path.basename(process.env.SHELL) : "unknown";
  const mount_path = path.join(os.homedir(), ".todoforai", "mnt", "todoforai");
  return { system, shell, mount_path };
});

register("get_available_tools", async () => {
  const tools: Record<string, string> = {};
  for (const [name, { installer }] of Object.entries(TOOL_CATALOG)) {
    tools[name] = installer;
  }
  return { tools };
});

register("install_tool", async (args) => {
  const { name } = args;
  if (!name || !(name in TOOL_CATALOG)) {
    return { success: false, error: `Unknown tool: ${name}` };
  }
  const scan = await scanCatalogTools();
  if (scan[name]?.installed) {
    return { success: true, alreadyInstalled: true, tool: name };
  }
  const installed = await ensureTool(name);
  if (!installed) {
    return { success: false, error: `Failed to install ${name}` };
  }
  
  // Update edge config with new tool state
  const edge = getGlobalEdgeInstance();
  if (edge) {
    await edge.updateConfig({ installedTools: await scanCatalogTools() });
  }
  
  return { success: true, tool: name, label: TOOL_CATALOG[name].label };
});

register("uninstall_tool", async (args) => {
  const { name } = args;
  if (!name || !(name in TOOL_CATALOG)) {
    return { success: false, error: `Unknown tool: ${name}` };
  }
  const success = uninstallTool(name);
  if (success) {
    const edge = getGlobalEdgeInstance();
    if (edge) await edge.updateConfig({ installedTools: await scanCatalogTools() });
  }
  return { success, tool: name };
});

register("get_workspace_tree", async (args) => {
  const { path: p, max_depth = 2 } = args;
  const root = path.resolve(p.replace(/^~/, process.env.HOME || "~"));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return { tree: "", is_git: false };
  }

  const isGit = fs.existsSync(path.join(root, ".git"));

  // Try external tree command first (Unix-like systems)
  if (process.platform !== "win32") {
    try {
      const { execSync } = await import("child_process");
      // Check if tree is available
      execSync(process.platform === "win32" ? "where tree" : "which tree", { encoding: "utf-8", stdio: "pipe" });
      const cmd = ["tree", "-L", String(max_depth), "--dirsfirst"];
      if (isGit) cmd.push("--gitignore", "-I", ".git");
      const result = execSync(cmd.join(" "), {
        cwd: root, encoding: "utf-8", timeout: 5000,
        maxBuffer: 1024 * 1024, stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (result) return { tree: result, is_git: isGit };
    } catch { /* fall through to JS implementation */ }
  }

  // Pure JS fallback with gitignore support via `ignore` package
  const ignore = (await import("ignore")).default;
  const ig = ignore();

  if (isGit) {
    // Collect all .gitignore patterns with directory-relative prefixes
    function scanGitignores(dir: string) {
      const giPath = path.join(dir, ".gitignore");
      if (fs.existsSync(giPath)) {
        try {
          const relDir = path.relative(root, dir).replace(/\\/g, "/");
          const prefix = relDir === "" || relDir === "." ? "" : relDir + "/";
          for (let line of fs.readFileSync(giPath, "utf-8").split("\n")) {
            line = line.trim();
            if (!line || line.startsWith("#")) continue;
            if (prefix) {
              ig.add(line.startsWith("!") ? "!" + prefix + line.slice(1) : prefix + line);
            } else {
              ig.add(line);
            }
          }
        } catch {}
      }
      try {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.isDirectory() && e.name !== ".git") scanGitignores(path.join(dir, e.name));
        }
      } catch {}
    }
    scanGitignores(root);
  }

  const lines: string[] = [path.basename(root) + "/"];

  function walk(dirPath: string, prefix: string, depth: number) {
    if (depth > max_depth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch { return; }

    const visible = entries
      .filter(e => {
        if (e.name === ".git") return false;
        if (isGit) {
          let rel = path.relative(root, path.join(dirPath, e.name)).replace(/\\/g, "/");
          if (e.isDirectory()) rel += "/";
          if (ig.ignores(rel)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aDir = a.isDirectory() ? 1 : 0;
        const bDir = b.isDirectory() ? 1 : 0;
        if (aDir !== bDir) return aDir - bDir;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });

    for (let i = 0; i < visible.length; i++) {
      const entry = visible[i];
      const isLast = i === visible.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const suffix = entry.isDirectory() ? "/" : "";
      lines.push(`${prefix}${connector}${entry.name}${suffix}`);
      if (entry.isDirectory()) {
        const extension = isLast ? "    " : "│   ";
        walk(path.join(dirPath, entry.name), prefix + extension, depth + 1);
      }
    }
  }

  walk(root, "", 1);
  return { tree: lines.join("\n"), is_git: isGit };
});

register("get_skills", async (args) => {
  const paths: string[] = Array.isArray(args?.paths) ? args.paths : [];
  const includeUserScope = args?.includeUserScope ?? true;
  return await discoverSkills(paths, { includeUserScope });
});

register("get_os_aware_default_path", async () => {
  let p = getPlatformDefaultDirectory();
  if (!p.endsWith(path.sep)) p += path.sep;
  return { path: p };
});

register("create_directory", async (args) => {
  const { name } = args;
  if (!name?.trim()) throw new Error("Folder name cannot be empty");
  const baseDir = path.resolve(getPathOrDefault(args.path).replace(/^~/, process.env.HOME || "~"));
  let target = path.resolve(name.replace(/^~/, process.env.HOME || "~"));
  if (!path.isAbsolute(name)) target = path.join(baseDir, name.trim());
  const existed = fs.existsSync(target);
  fs.mkdirSync(target, { recursive: true });
  let full = target;
  if (!full.endsWith(path.sep)) full += path.sep;
  return { path: full, created: !existed, exists: true };
});

// Backward-compat aliases
FUNCTION_REGISTRY.set("getOSAwareDefaultPath", FUNCTION_REGISTRY.get("get_os_aware_default_path")!);
FUNCTION_REGISTRY.set("createDirectory", FUNCTION_REGISTRY.get("create_directory")!);

// Strip trailing `| tail -N` so the command streams fully,
// then apply the line filter to the collected output before returning.
// (head streams naturally — it emits first N lines immediately — so no need to strip it)
function extractTrailingTail(cmd: string): { execCmd: string; postFilter?: (s: string) => string } {
  const m = cmd.match(/^(.*?)\s*\|\s*tail\s+-(?:n\s*)?(\d+)\s*$/);
  if (!m) return { execCmd: cmd };
  const n = parseInt(m[2], 10);
  return { execCmd: m[1], postFilter: (s) => s.split("\n").slice(-n).join("\n") };
}

// Detect data URL image in shell output (same pattern as readFileContent uses)
const DATA_URL_IMAGE_REGEX = /^data:(image\/[^;]+);base64,[A-Za-z0-9+/]+=*$/;

function detectContentType(output: string, cmd?: string): { result: string; contentType?: string } {
  const trimmed = output.trim();
  const match = trimmed.match(DATA_URL_IMAGE_REGEX);
  if (match) {
    console.log(`\n🖼️  [edge] Image output detected! type=${match[1]} size=${trimmed.length} chars${cmd ? `\n    cmd: ${cmd}` : ""}\n`);
    return { result: trimmed, contentType: match[1] };
  }
  return { result: output };
}

register("execute_shell_command", async (args, client) => {
  const { cmd, cwd = (args as any).root_path ?? "", todoId = "", messageId = "", blockId = "", agentSettingsId = "", pid: resumePid = 0 } = args as Record<string, any>;
  const timeout = Math.max((args as Record<string, any>).timeout ?? 120, client?.maxTimeout ?? 0);
  const canStream = !!(todoId && blockId && client);

  if (!canStream) {
    // Simple fallback (no session support without streaming context)
    const { exec } = await import("child_process");
    const result = await new Promise<string>((resolve) => {
      exec(cmd, { cwd: cwd || os.tmpdir(), encoding: "utf-8", timeout: timeout * 1000, maxBuffer: 10 * 1024 * 1024, env: { ...buildEnvWithTools(), ...getConnectionEnv(), TODOFORAI_TODO_ID: todoId, TODOFORAI_MESSAGE_ID: messageId, TODOFORAI_BLOCK_ID: blockId, TODOFORAI_AGENT_SETTINGS_ID: agentSettingsId } }, (_err, stdout, stderr) => {
        resolve((stdout || "") + (stderr || ""));
      });
    });
    return { cmd, ...detectContentType(result, cmd) };
  }

  // Strip trailing | tail so the raw command streams, then filter the result
  const { execCmd, postFilter } = extractTrailingTail(cmd);

  const send: SendFn = (m) => client.sendResponse(m);

  // ── Continue detached session by pid: send stdin to existing process, wait for new output ──
  const resumeBlockId = resumePid ? findBlockIdByPid(Number(resumePid)) : null;
  // Caller asked to resume a specific pid that's no longer alive → don't silently
  // fall through to a fresh exec (would run `cmd` as a brand-new shell command).
  // First drain any residual output captured at exit; otherwise tell the LLM the
  // session is gone so it starts a fresh command.
  if (resumePid && !resumeBlockId) {
    const residual = consumeExitedOutput(Number(resumePid));
    if (residual) {
      return { cmd, result: `${residual.output}\n[session pid=${resumePid} exited with code ${residual.returnCode}]` };
    }
    return { cmd, result: `[no live session for pid=${resumePid} — it already exited; start a fresh command]` };
  }
  if (resumeBlockId) {
    await sendInput(resumeBlockId, cmd);  // resets buffer for interaction
    await waitForCompletion(resumeBlockId, timeout * 1000);
    const rawOutput = getBlockRawOutput(resumeBlockId);
    let output = rawOutput ?? getBlockOutput(resumeBlockId);
    if (postFilter) output = postFilter(output);
    const stillAlive = isBlockAlive(resumeBlockId);
    if (!stillAlive) clearBlockOutput(resumeBlockId);
    if (stillAlive) {
      const livePid = getPid(resumeBlockId);
    // Wire field stays `paused` for older-agent compat; the agent's LLM
    // footer says "detached" since agent upgrades atomically.
    return { cmd, result: output, paused: true, ...(livePid ? { pid: livePid } : {}) };
    }
    return rawOutput !== null ? { cmd, ...detectContentType(output, cmd) } : { cmd, result: output };
  }

  // ── Fresh exec ──
  try {
    await send(msg.shellBlockStart(todoId, blockId, "execute", messageId));
    await executeBlock(blockId, execCmd, send, todoId, messageId, timeout, cwd, false, "internal", undefined, agentSettingsId, true);

    // If awaiting tool approval, signal caller to suppress response
    if (pendingToolApprovals.has(blockId)) {
      return { __awaiting_approval__: true };
    }

    await waitForCompletion(blockId, (timeout + 5) * 1000);
    const rawOutput = getBlockRawOutput(blockId);
    let output = rawOutput ?? getBlockOutput(blockId);
    if (postFilter) output = postFilter(output);
    const stillAlive = isBlockAlive(blockId);
    if (stillAlive) {
      const livePid = getPid(blockId);
      return { cmd, result: output, paused: true, ...(livePid ? { pid: livePid } : {}) };
    }
    clearBlockOutput(blockId);
    return rawOutput !== null ? { cmd, ...detectContentType(output, cmd) } : { cmd, result: output };
  } catch (e: any) {
    clearBlockOutput(blockId);
    throw e;
  }
});

register("read_file", async (args) => {
  const { path: p, rootPath = "", fallbackRootPaths = [] } = args;
  const result = await readFileContent(p, rootPath, fallbackRootPaths);
  if (!result.success) throw new Error(result.error || "Unknown read error");
  const { success, ...rest } = result;
  return rest;
});

const LIST_DIR_MAX_ENTRIES = 10_000;

register("list_dir", async (args) => {
  // readdir_plus: one round-trip returns name + size + mtime + mode + is_dir.
  // Keeps FUSE/getattr storms down (see comment on rclone --attr-timeout).
  const { path: p, rootPath = "", fallbackRootPaths = [] } = args;
  const fullPath = resolveFilePath(p, rootPath, fallbackRootPaths);
  const st = fs.statSync(fullPath);
  if (!st.isDirectory()) throw new Error(`Not a directory: ${fullPath}`);
  const dirents = fs.readdirSync(fullPath, { withFileTypes: true });
  if (dirents.length > LIST_DIR_MAX_ENTRIES) {
    throw new Error(`Directory too large: ${dirents.length} entries (max ${LIST_DIR_MAX_ENTRIES})`);
  }
  const entries = dirents.map((d) => {
    let size = 0, mtime = 0, mode = 0, is_dir = d.isDirectory();
    try {
      const s = fs.lstatSync(path.join(fullPath, d.name));
      size = Number(s.size);
      mtime = s.mtimeMs / 1000;
      mode = s.mode & 0o777;
      is_dir = s.isDirectory();
    } catch { /* unreadable entry → keep zeros */ }
    return { name: d.name, is_dir, size, mtime, mode };
  });
  return { entries };
});

register("create_file", async (args) => {
  const { path: p, content, rootPath = "", fallbackRootPaths = [] } = args;
  const fullPath = resolveFilePath(p, rootPath, fallbackRootPaths);
  const dir = path.dirname(fullPath);
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
  return { path: fullPath, bytes: Buffer.byteLength(content, "utf-8") };
});

register("read_file_base64", async (args) => {
  const { path: p, rootPath = "", fallbackRootPaths = [] } = args;
  const fullPath = resolveFilePath(p, rootPath, fallbackRootPaths);
  if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`);
  const stat = fs.statSync(fullPath);
  if (stat.size > 50_000_000) throw new Error(`File too large: ${stat.size.toLocaleString()} bytes (max 50MB)`);
  const data = fs.readFileSync(fullPath);
  return { path: fullPath, base64: data.toString("base64"), bytes: data.length };
});

register("search_files", async (args) => {
  const { pattern, path: p = ".", cwd = (args as any).root_path ?? "", head = 100, max_count = 5, glob: globPattern = "", ignore_case = true } = args;
  const { execSync: execWhich } = await import("child_process");
  const whichCmd = process.platform === "win32" ? "where" : "which";
  const which = (bin: string) => { try { return execWhich(`${whichCmd} ${bin}`, { encoding: "utf-8" }).trim().split("\n")[0].trim(); } catch { return null; } };
  let rgPath = which("rg");
  if (!rgPath) {
    await ensureTool("rg");
    rgPath = which("rg");
  }

  let searchPath = p.replace(/^~/, process.env.HOME || "~");
  if (!path.isAbsolute(searchPath) && cwd) searchPath = path.join(cwd, searchPath);
  searchPath = path.resolve(searchPath);
  if (!fs.existsSync(searchPath)) throw new Error(`Search path does not exist: ${searchPath}`);

  let cmd: string[];
  if (rgPath) {
    cmd = [rgPath, "--no-heading", "--line-number", "--color=never"];
    if (ignore_case) cmd.push("--ignore-case");
    if (max_count > 0) cmd.push(`--max-count=${max_count}`);
    if (globPattern) cmd.push("--glob", globPattern);
    cmd.push(pattern, searchPath);
  } else {
    // Fallback to grep when ripgrep is unavailable
    console.warn("[search_files] ripgrep (rg) not found, falling back to grep");
    const grepPath = which("grep") || "grep";
    cmd = [grepPath, "-rn", "--color=never"];
    if (ignore_case) cmd.push("-i");
    if (max_count > 0) cmd.push(`--max-count=${max_count}`);
    if (globPattern) {
      // Convert rg glob to grep --include (e.g. "*.ts" or "*.{ts,tsx}")
      cmd.push(`--include=${globPattern}`);
    }
    cmd.push(pattern, searchPath);
  }

  const { spawn: spawnChild } = await import("child_process");
  const { stdout, stderr, code } = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    const child = spawnChild(cmd[0], cmd.slice(1));
    let out = "", err = "";
    child.stdout?.on("data", (d: Buffer) => { out += d.toString(); });
    child.stderr?.on("data", (d: Buffer) => { err += d.toString(); });
    child.on("close", (exitCode) => resolve({ stdout: out, stderr: err, code: exitCode ?? 1 }));
  });

  if (code === 0) {
    let output = stdout;
    // Limit total number of result lines
    const lines = output.split("\n").filter(l => l.trim());
    if (lines.length > head) {
      output = lines.slice(0, head).join("\n") + `\n... (${lines.length - head} more matches truncated)`;
    }
    // Make paths relative if close, truncate long lines for cleaner display
    if ((cwd || searchPath) && output) {
      // Use dir form of searchPath as base (so file paths relativize cleanly)
      const searchBase = searchPath && fs.existsSync(searchPath) && fs.statSync(searchPath).isDirectory() ? searchPath : path.dirname(searchPath);
      const bases = Array.from(new Set([cwd, searchBase].filter(Boolean))) as string[];
      const lines = output.split("\n").map(line => {
        if (line.includes(":")) {
          const colonIdx = line.indexOf(":");
          let filePart = line.slice(0, colonIdx);
          const rest = line.slice(colonIdx);
          // Pick the shortest candidate among absolute and all bases (within 2 up-levels)
          try {
            const candidates = [filePart, ...bases.map(b => path.relative(b, filePart))]
              .filter(p => (p.match(/\.\.\//g) || []).length <= 2);
            filePart = candidates.reduce((a, b) => a.length <= b.length ? a : b, filePart);
          } catch {
            // Keep absolute on error
          }
          let fullLine = filePart + rest;
          // Truncate very long lines (keep file:line but limit content)
          if (fullLine.length > 300) {
            fullLine = fullLine.slice(0, 300) + "...";
          }
          return fullLine;
        }
        return line;
      });
      output = lines.join("\n");
    }
    if (output.length > 100_000) output = output.slice(0, 100_000) + "\n... (output truncated)";
    return { result: output };
  }
  if (code === 1) return { result: "No matches found." };
  throw new Error(`search error (exit ${code}): ${stderr}`);
});

register("download_attachment", async (args, client) => {
  if (!client) throw new Error("Client instance required");
  const { attachmentId, path: p = "", rootPath = "" } = args;
  if (!p) throw new Error("No file path provided");

  const apiUrl = client.apiUrl.replace(/\/+$/, "");
  const res = await fetch(`${apiUrl}/api/v1/files/${attachmentId}`, {
    headers: { "x-api-key": client.apiKey },
  });
  if (!res.ok) throw new Error(`Backend responded with ${res.status}`);

  const base = getPathOrDefault(rootPath);
  let target = p.replace(/^~/, process.env.HOME || "~");
  if (!path.isAbsolute(target)) target = path.join(base, target);
  target = path.resolve(target);
  fs.mkdirSync(path.dirname(target), { recursive: true });

  try {
    const data = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(target, data);
    return { path: target, bytes: data.length };
  } catch (e: any) {
    throw new Error(`Download failed: ${e.message}`);
  }
});

register("download_chat", async (args, client) => {
  if (!client) throw new Error("Client instance required");
  try {
    const res = await fetch(`${client.apiUrl.replace(/\/+$/, "")}/api/v1/todos/${args.todoId}`, {
      headers: { "x-api-key": client.apiKey },
    });
    if (!res.ok) throw new Error(`Backend responded with ${res.status}: ${await res.text()}`);
    return { todo: await res.json() };
  } catch (e: any) {
    if (e instanceof Error) throw e;
    throw new Error(`Download chat failed: ${e.message}`);
  }
});

register("register_attachment", async (args, client) => {
  if (!client) throw new Error("Client instance required");
  const { filePath, userId = "test-user", isPublic = false, agentSettingsId = "", todoId = "", rootPath = "" } = args;

  const base = getPathOrDefault(rootPath);
  let target = filePath.replace(/^~/, process.env.HOME || "~");
  if (!path.isAbsolute(target)) target = path.join(base, target);
  target = path.resolve(target);
  if (!fs.existsSync(target)) throw new Error(`File not found: ${target}`);

  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(target)]), path.basename(target));
  if (userId) form.append("userId", userId);
  if (agentSettingsId) form.append("agentSettingsId", agentSettingsId);
  if (todoId) form.append("todoId", todoId);
  form.append("isPublic", isPublic ? "true" : "false");

  const res = await fetch(`${client.apiUrl.replace(/\/+$/, "")}/api/v1/resources/register`, {
    method: "POST",
    headers: { "x-api-key": client.apiKey },
    body: form,
  });
  if (!res.ok) throw new Error(`Backend responded with ${res.status}: ${await res.text()}`);
  const payload = await res.json().catch(() => ({}));
  return { attachmentId: payload.attachmentId, response: payload };
});
