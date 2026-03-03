import fs from "fs";
import path from "path";
import { resolveFilePath, WorkspacePathNotFoundError } from "./path-utils.js";
import { extractDocxContent, extractXlsxContent } from "./docx-handler.js";

const MAX_FILE_SIZE = 100_000; // 100KB
const MAX_OFFICE_FILE_SIZE = 500_000; // 500KB
const OFFICE_EXTENSIONS = new Set([".docx", ".xlsx"]);

export interface ReadResult {
  success: boolean;
  content?: string;
  fullPath?: string;
  contentType?: string;
  isDirectory?: boolean;
  error?: string;
}

export async function readFileContent(
  filePath: string,
  rootPath: string,
  fallbackRootPaths: string[],
): Promise<ReadResult> {
  try {
    const fullPath = path.resolve(resolveFilePath(filePath, rootPath, fallbackRootPaths));

    if (!fs.existsSync(fullPath)) {
      const roots = rootPath ? [rootPath, ...fallbackRootPaths] : fallbackRootPaths;
      return { success: false, error: `File not found: ${filePath} (roots: ${JSON.stringify(roots)})` };
    }

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const names = fs.readdirSync(fullPath).sort();
      const content = names
        .map(n => (fs.statSync(path.join(fullPath, n)).isDirectory() ? n + "/" : n))
        .join("\n");
      return { success: true, content, fullPath, contentType: "text", isDirectory: true };
    }

    const ext = path.extname(fullPath).toLowerCase();
    const isOffice = OFFICE_EXTENSIONS.has(ext);
    const sizeLimit = isOffice ? MAX_OFFICE_FILE_SIZE : MAX_FILE_SIZE;

    if (stat.size > sizeLimit) {
      return {
        success: false,
        error: `File too large: ${fullPath} (${stat.size.toLocaleString()} bytes, max ${sizeLimit.toLocaleString()})`,
      };
    }

    if (ext === ".docx") {
      const content = extractDocxContent(fullPath);
      return { success: true, content, fullPath, contentType: "docx-xml" };
    }
    if (ext === ".xlsx") {
      const content = extractXlsxContent(fullPath);
      return { success: true, content, fullPath, contentType: "xlsx-xml" };
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    return { success: true, content, fullPath, contentType: "text" };
  } catch (e: any) {
    if (e instanceof WorkspacePathNotFoundError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: String(e) };
  }
}
