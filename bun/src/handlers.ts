import fs from "fs";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { msg, EA, EF, type WsMessage } from "./constants.js";
import { resolveFilePath, getPathOrDefault, WorkspacePathNotFoundError } from "./path-utils.js";
import { readFileContent } from "./files.js";
import { executeBlock, sendInput, interruptBlock, type SendFn } from "./shell.js";
import { FUNCTION_REGISTRY } from "./functions.js";
import type { EdgeConfigData } from "./types.js";

const log = (level: string, ...args: any[]) => console.log(`[${level}]`, ...args);

// ── Block Execute ──

export async function handleBlockExecute(payload: Record<string, any>, send: SendFn) {
  const { blockId, messageId = "", content = "", todoId = "", rootPath = "", manual = false } = payload;
  await send(msg.shellBlockStart(todoId, blockId, "execute", messageId));
  try {
    const timeout = payload.timeout ?? 120;
    await executeBlock(blockId, content, send, todoId, messageId, timeout, rootPath, manual);
  } catch (e: any) {
    await send(msg.blockError(blockId, todoId, e.message));
  }
}

// ── Block Signal ──

export async function handleBlockSignal(payload: Record<string, any>) {
  interruptBlock(payload.blockId);
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
    const dir = path.dirname(resolved);
    if (dir) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, content, "utf-8");
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

export async function handleWriteFile(payload: Record<string, any>, send: SendFn) {
  const { requestId, edgeId, path: dirPath, fileName, dataBase64 } = payload;
  try {
    const filePath = path.join(dirPath, fileName);
    const dir = path.dirname(filePath);
    if (dir) fs.mkdirSync(dir, { recursive: true });
    const buffer = Buffer.from(dataBase64, "base64");
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
  const { path: p = "", rootPath = "", fallbackRootPaths = [] } = payload;
  const result = await readFileContent(p, rootPath, fallbackRootPaths);
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
    // If awaiting tool approval, suppress the response — server will re-invoke after approval
    if (result && result.__awaiting_approval__) return;
    await send(makeSuccess(result));
  } catch (e: any) {
    log("error", `Function call '${functionName}' failed:`, e.message);
    await send(makeError(e.message));
  }
}
