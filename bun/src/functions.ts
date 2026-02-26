import fs from "fs";
import path from "path";
import os from "os";
import { readFileContent } from "./files.js";
import { resolveFilePath, getPlatformDefaultDirectory, getPathOrDefault } from "./path-utils.js";
import { executeBlock, waitForCompletion, getBlockOutput, clearBlockOutput, pendingToolApprovals, type SendFn } from "./shell.js";
import { msg } from "./constants.js";
import { ensureTool, buildEnvWithTools } from "./tool-registry.js";

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
  return { system, shell };
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

register("execute_shell_command", async (args, client) => {
  const { cmd, timeout = 120, root_path = "", todoId = "", messageId = "", blockId = "" } = args;
  const canStream = !!(todoId && blockId && client);

  if (!canStream) {
    // Simple fallback
    const proc = Bun.spawn(["bash", "-c", cmd], {
      cwd: root_path || os.tmpdir(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    const err = await new Response(proc.stderr).text();
    await proc.exited;
    return { cmd, result: out + err };
  }

  // Streaming via ShellProcess
  const send: SendFn = (m) => client.sendResponse(m);
  await send(msg.shellBlockStart(todoId, blockId, "execute", messageId));
  await executeBlock(blockId, cmd, send, todoId, messageId, timeout, root_path, false, "internal");

  // If awaiting tool approval, signal caller to suppress response
  if (pendingToolApprovals.has(blockId)) {
    return { __awaiting_approval__: true };
  }

  await waitForCompletion(blockId, (timeout + 5) * 1000);
  const output = getBlockOutput(blockId);
  clearBlockOutput(blockId);
  return { cmd, result: output };
});

register("read_file", async (args) => {
  const { path: p, rootPath = "", fallbackRootPaths = [] } = args;
  const result = await readFileContent(p, rootPath, fallbackRootPaths);
  if (!result.success) throw new Error(result.error);
  const { success, ...rest } = result;
  return rest;
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
  const { pattern, path: p = ".", root_path = "", max_results = 100, glob: globPattern = "", ignore_case = true } = args;
  const { which } = await import("bun");
  let rgPath = which("rg");
  if (!rgPath) {
    // Auto-install ripgrep if missing
    await ensureTool("rg");
    rgPath = which("rg");
    if (!rgPath) throw new Error("ripgrep (rg) not found and auto-install failed");
  }

  let searchPath = p.replace(/^~/, process.env.HOME || "~");
  if (!path.isAbsolute(searchPath) && root_path) searchPath = path.join(root_path, searchPath);
  searchPath = path.resolve(searchPath);
  if (!fs.existsSync(searchPath)) throw new Error(`Search path does not exist: ${searchPath}`);

  const cmd = [rgPath, "--no-heading", "--line-number", "--color=never", `--max-count=${max_results}`];
  if (ignore_case) cmd.push("--ignore-case");
  if (globPattern) cmd.push("--glob", globPattern);
  cmd.push(pattern, searchPath);

  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;

  if (code === 0) {
    let output = stdout;
    // Make paths relative if close, truncate long lines for cleaner display
    if (root_path && output) {
      const lines = output.split("\n").map(line => {
        if (line.includes(":")) {
          const colonIdx = line.indexOf(":");
          let filePart = line.slice(0, colonIdx);
          const rest = line.slice(colonIdx);
          // Try to make relative if within 2 levels, otherwise keep absolute
          try {
            const relPath = path.relative(root_path, filePart);
            const upLevels = (relPath.match(/\.\.\//g) || []).length;
            if (upLevels <= 2) {
              filePart = relPath;
            }
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
  throw new Error(`ripgrep error (exit ${code}): ${stderr}`);
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

  const data = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(target, data);
  return { path: target, bytes: data.length };
});

register("download_chat", async (args, client) => {
  if (!client) throw new Error("Client instance required");
  const res = await fetch(`${client.apiUrl.replace(/\/+$/, "")}/api/v1/todos/${args.todoId}`, {
    headers: { "x-api-key": client.apiKey },
  });
  if (!res.ok) throw new Error(`Backend responded with ${res.status}`);
  return { todo: await res.json() };
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
  if (!res.ok) throw new Error(`Backend responded with ${res.status}`);
  const payload = await res.json().catch(() => ({}));
  return { attachmentId: payload.attachmentId, response: payload };
});
