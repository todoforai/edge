import fs from "fs";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { msg, EA, EF, type WsMessage } from "./constants.js";
import { resolveFilePath, getPathOrDefault, WorkspacePathNotFoundError } from "./path-utils.js";
import { readFileContent } from "./files.js";
import { saveDocxContent, saveXlsxContent } from "./docx-handler.js";
import { executeBlock, sendInput, interruptBlock, detachBlock, type SendFn } from "./shell.js";
import { FUNCTION_REGISTRY } from "./functions.js";
import type { EdgeConfigData } from "./types.js";

const log = (level: string, ...args: any[]) => console.log(`[${level}]`, ...args);

// ── Block Execute ──

export async function handleBlockExecute(payload: Record<string, any>, send: SendFn, edgeId?: string, maxTimeout = 0) {
  const { blockId, messageId = "", content = "", todoId = "", rootPath = "", manual = false } = payload;
  await send(msg.shellBlockStart(todoId, blockId, "execute", messageId));
  try {
    const timeout = Math.max(payload.timeout ?? 120, maxTimeout);
    await executeBlock(blockId, content, send, todoId, messageId, timeout, rootPath, manual, undefined, edgeId);
  } catch (e: any) {
    await send(msg.blockError(blockId, todoId, e.message));
  }
}

// ── Block Signal ──
// Detach (release the in-flight execute_shell_command waiter so the agent gets
// `{paused, pid}`, rendered as "detached" in the LLM footer) keeps the proc +
// terminal alive; otherwise SIGINT + close the terminal. Honor both explicit
// flags for version skew: `kill` always wins, `detach` alone detaches, and a
// bare payload (legacy frontend interrupt) falls back to interrupt.
//
// COMPAT: the `detach` branch + the `&& !payload.kill` guard only exist to
// understand old frontends (which sent `{}`=interrupt, `{detach:true}`=background).
// Once every frontend sends the explicit `kill`/`detach` flags, simplify to:
//   if (payload.kill) interruptBlock(...) else detachBlock(...)

export async function handleBlockSignal(payload: Record<string, any>) {
  if (payload.detach && !payload.kill) detachBlock(payload.blockId);
  else interruptBlock(payload.blockId);
}

// ── Block Keyboard ──

export async function handleBlockKeyboard(payload: Record<string, any>) {
  await sendInput(payload.blockId, payload.content || "");
}

// ── Block Save ──

export async function handleBlockSave(payload: Record<string, any>, send: SendFn) {
  const { blockId, todoId, filepath, rootPath, fallbackRootPaths = [], content, requestId } = payload;
  try {
    const resolved = resolveFilePath(filepath, rootPath, fallbackRootPaths);
    const ext = path.extname(resolved).toLowerCase();

    if (ext === ".docx" || ext === ".xlsx") {
      if (!fs.existsSync(resolved)) {
        throw new Error(`Cannot create new ${ext} file from XML — file must already exist: ${filepath}`);
      }
      if (ext === ".docx") saveDocxContent(resolved, content);
      else saveXlsxContent(resolved, content);
    } else {
      const dir = path.dirname(resolved);
      if (dir) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(resolved, content, "utf-8");
    }
    await send(msg.blockSaveResult(blockId, todoId, "SUCCESS", requestId));
  } catch (e: any) {
    await send(msg.blockSaveResult(blockId, todoId, `ERROR: ${e.message}`, requestId));
  }
}

// ── Get Folders ──

export async function handleGetFolders(payload: Record<string, any>, send: SendFn) {
  const { requestId, edgeId } = payload;
  const rawPath = getPathOrDefault(payload.path);
  try {
    const expandedPath = path.resolve(rawPath.replace(/^~/, process.env.HOME || "~"));
    let targetPath: string;
    if (fs.existsSync(expandedPath) && fs.statSync(expandedPath).isDirectory()) {
      targetPath = expandedPath;
    } else {
      targetPath = path.dirname(expandedPath);
    }

    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
      throw new Error(`No existing ancestor for path: ${rawPath}`);
    }

    const folders: string[] = [];
    const files: string[] = [];
    for (const item of fs.readdirSync(targetPath)) {
      const full = path.join(targetPath, item);
      try {
        if (fs.statSync(full).isDirectory()) folders.push(full);
        else files.push(full);
      } catch {}
    }
    folders.sort();
    files.sort();
    await send(msg.getFoldersResponse(requestId, edgeId, folders, files, undefined, targetPath));
  } catch (e: any) {
    await send(msg.getFoldersResponse(requestId, edgeId, [], [], e.message));
  }
}

// ── Create Folder ──

export async function handleCreateFolder(payload: Record<string, any>, send: SendFn) {
  const { requestId, edgeId, path: folderPath } = payload;
  try {
    await mkdir(folderPath, { recursive: true });
    await send(msg.createFolderResponse(requestId, edgeId, true));
  } catch (e: any) {
    await send(msg.createFolderResponse(requestId, edgeId, false, e.message));
  }
}

// ── Delete Path ──

export async function handleDeletePath(payload: Record<string, any>, send: SendFn) {
  const { requestId, edgeId, path: targetPath } = payload;
  try {
    await rm(targetPath, { recursive: true });
    await send(msg.deletePathResponse(requestId, edgeId, true));
  } catch (e: any) {
    await send(msg.deletePathResponse(requestId, edgeId, false, e.message));
  }
}

// ── Write File ──

export async function handleWriteFile(payload: Record<string, any>, send: SendFn, pendingBinaries?: Map<string, Uint8Array>) {
  const { requestId, edgeId, path: dirPath, fileName, binaryId, dataBase64 } = payload;
  try {
    const filePath = path.join(dirPath, fileName);
    const dir = path.dirname(filePath);
    if (dir) fs.mkdirSync(dir, { recursive: true });
    let buffer: Buffer | Uint8Array;
    if (binaryId && pendingBinaries?.has(binaryId)) {
      buffer = pendingBinaries.get(binaryId)!;
      pendingBinaries.delete(binaryId);
    } else if (dataBase64) {
      buffer = Buffer.from(dataBase64, "base64");
    } else {
      throw new Error("No file data provided (neither binaryId nor dataBase64)");
    }
    await writeFile(filePath, buffer);
    await send(msg.writeFileResponse(requestId, edgeId, true));
  } catch (e: any) {
    await send(msg.writeFileResponse(requestId, edgeId, false, e.message));
  }
}

// ── CD ──

const FORBIDDEN_PATHS = new Set(["/", "/tmp", "C:\\", "C:/"]);

export async function handleCd(
  payload: Record<string, any>,
  send: SendFn,
  edgeConfig: EdgeConfigData,
  onConfigChange: (updates: Partial<EdgeConfigData>) => void,
) {
  const { requestId, edgeId } = payload;
  const rawPath = getPathOrDefault(payload.path);
  try {
    const resolved = path.resolve(rawPath.replace(/^~/, process.env.HOME || "~"));
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Path does not exist or is not a directory: ${rawPath}`);
    }

    const normalized = resolved.replace(/\/+$/, "");
    if (!FORBIDDEN_PATHS.has(normalized) && !edgeConfig.workspacepaths.includes(resolved)) {
      const newPaths = [...edgeConfig.workspacepaths, resolved];
      onConfigChange({ workspacepaths: newPaths });
    }

    await send(msg.cdResponse(edgeId, resolved, requestId, true));
  } catch (e: any) {
    await send(msg.cdResponse(edgeId, rawPath, requestId, false, e.message));
  }
}

// ── File Chunk Request ──

export async function handleFileChunkRequest(
  payload: Record<string, any>,
  send: SendFn,
  responseType = EA.FILE_CHUNK_RESULT as string,
) {
  const { path: p = "", rootPath = "", fallbackRootPaths = [], skipSizeLimit = false } = payload;
  const result = await readFileContent(p, rootPath, fallbackRootPaths, skipSizeLimit);
  if (result.success) {
    await send(msg.fileChunkResult(responseType, { ...payload, full_path: result.fullPath, content: result.content, content_type: result.contentType }));
  } else {
    await send(msg.fileChunkResult(responseType, { ...payload, error: result.error }));
  }
}

// ── Task Action New ──

export async function handleTaskActionNew(payload: Record<string, any>, send: SendFn) {
  const { taskId, edgeId } = payload;
  await send(msg.taskActionUpdate(taskId, edgeId, "started"));
}

// ── Julia Context (stub) ──

export async function handleCtxJuliaRequest(payload: Record<string, any>, send: SendFn) {
  const { requestId, query = "", todoId = "" } = payload;
  await send(msg.ctxJuliaResult(todoId, requestId, ["example/file.jl"], ["# Placeholder Julia result"]));
}

// ── Function Call ──

export async function handleFunctionCall(payload: Record<string, any>, send: SendFn, client: any) {
  const { requestId, functionName, args = {}, agentId, edgeId } = payload;
  const isAgent = !!agentId;

  // Extract block info for frontend responses
  let blockInfo: Record<string, any> | undefined;
  if (args.blockId) {
    blockInfo = { todoId: args.todoId, messageId: args.messageId, blockId: args.blockId };
  }

  const makeSuccess = (result: any) =>
    isAgent
      ? msg.functionCallResult(requestId, edgeId, true, result, undefined, agentId)
      : msg.functionCallResultFront(requestId, edgeId, true, result, undefined, blockInfo);

  const makeError = (err: string) =>
    isAgent
      ? msg.functionCallResult(requestId, edgeId, false, undefined, err, agentId)
      : msg.functionCallResultFront(requestId, edgeId, false, undefined, err, blockInfo);

  try {
    const fn = FUNCTION_REGISTRY.get(functionName);
    if (!fn) {
      const available = [...FUNCTION_REGISTRY.keys()];
      throw new Error(`Unknown function: ${functionName}. Available: ${available.join(", ")}`);
    }

    const result = await fn(args, client);
    // DEAD: tool-install approval gating — if the function returned the
    // __awaiting_approval__ sentinel we suppressed the response and waited
    // for the server to re-invoke after the user approved.
    // if (result && result.__awaiting_approval__) return;
    await send(makeSuccess(result));
  } catch (e: any) {
    log("error", `Function call '${functionName}' failed:`, e.message);
    await send(makeError(e.message));
  }
}
