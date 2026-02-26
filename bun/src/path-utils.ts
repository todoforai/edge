import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

export class WorkspacePathNotFoundError extends Error {
  missingRoots: string[];
  constructor(filePath: string, missingRoots: string[]) {
    super(`File not found: ${filePath} — workspace path(s) do not exist: ${missingRoots.join(", ")}`);
    this.name = "WorkspacePathNotFoundError";
    this.missingRoots = missingRoots;
  }
}

function expandUser(p: string): string {
  if (p.startsWith("~")) return p.replace("~", process.env.HOME || "~");
  return p;
}

function getParentDirectoryIfNeeded(filePath: string, rootPath: string | undefined, fallbackRootPaths: string[]): string | null {
  if (path.isAbsolute(filePath)) return null;

  const allPaths: string[] = [];
  if (rootPath) allPaths.push(rootPath);
  allPaths.push(...fallbackRootPaths);

  for (const wp of allPaths) {
    if (!wp) continue;
    const folderName = path.basename(wp.replace(/[/\\]+$/, ""));
    if (filePath.startsWith(folderName + path.sep) || filePath === folderName) {
      const parent = path.dirname(wp);
      if (parent) return parent;
    }
  }
  return null;
}

function findFileInWorkspaces(filePath: string, workspacePaths: string[], primaryPath?: string): string | null {
  if (primaryPath) {
    const candidate = path.isAbsolute(filePath) ? filePath : path.resolve(expandUser(primaryPath), filePath);
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const wp of workspacePaths) {
    const candidate = path.resolve(expandUser(wp), filePath);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function checkRootsExist(filePath: string, rootPath?: string, fallbackRootPaths?: string[]): void {
  const roots: string[] = [];
  if (rootPath) roots.push(rootPath);
  if (fallbackRootPaths) roots.push(...fallbackRootPaths);
  const missing = roots.filter(r => r && !fs.existsSync(r));
  if (missing.length) throw new WorkspacePathNotFoundError(filePath, missing);
}

export function resolveFilePath(filePath: string, rootPath?: string, fallbackRootPaths: string[] = []): string {
  // Handle file:// URLs
  if (filePath.startsWith("file://")) {
    filePath = fileURLToPath(filePath);
  }
  filePath = expandUser(filePath);

  checkRootsExist(filePath, rootPath, fallbackRootPaths);

  if (fallbackRootPaths.length) {
    const allPaths = rootPath ? [rootPath, ...fallbackRootPaths] : [...fallbackRootPaths];
    const parentDir = getParentDirectoryIfNeeded(filePath, rootPath, fallbackRootPaths);
    if (parentDir && !allPaths.includes(parentDir)) allPaths.push(parentDir);

    const found = findFileInWorkspaces(filePath, allPaths, rootPath);
    if (found) return found;
  }

  if (rootPath && !path.isAbsolute(filePath)) {
    return path.join(rootPath, filePath);
  }

  return filePath;
}

export function getPlatformDefaultDirectory(): string {
  try {
    const home = process.env.HOME || process.env.USERPROFILE;
    if (home && fs.existsSync(home)) return path.resolve(home);
  } catch {}
  return process.cwd();
}

export function getPathOrDefault(p?: string): string {
  if (!p || p === "." || p === "") return getPlatformDefaultDirectory();
  return p;
}
