# File Operations

## Overview

File operations in the Python edge handle reading, writing, and listing files with special handling for DOCX/XLSX formats. Neutralino.js provides the `Neutralino.filesystem` API for these operations.

## Python Implementation

Location: `/edge/todoforai_edge/handlers/handlers.py`

### File Reading

```python
async def handle_file_chunk_request(payload, client, response_type=EA.FILE_CHUNK_RESULT):
    file_path = payload.get("path")
    request_id = payload.get("requestId")

    # Resolve path with workspace validation
    resolved_path = resolve_file_path(file_path, client.edge_config)

    # Check if path is allowed
    if not is_path_allowed(resolved_path, client.edge_config):
        # Send error response
        return

    # Check file size (max 100KB)
    file_size = os.path.getsize(resolved_path)
    if file_size > 100 * 1024:
        # Send error: file too large
        return

    # Handle special formats
    if resolved_path.endswith('.docx'):
        content = extract_docx_content(resolved_path)
    elif resolved_path.endswith('.xlsx'):
        content = extract_xlsx_content(resolved_path)
    else:
        with open(resolved_path, 'r', encoding='utf-8') as f:
            content = f.read()

    # Send response
    await client.send_response(file_chunk_result_msg(...))
```

## Neutralino.js Implementation

### File Operations Module

```typescript
// src/FileOperations.ts

const MAX_FILE_SIZE = 100 * 1024; // 100KB

interface FileReadResult {
  content: string;
  path: string;
  error?: string;
}

interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: number;
}

export class FileOperations {
  private workspacePaths: string[] = [];

  setWorkspacePaths(paths: string[]): void {
    this.workspacePaths = paths;
  }

  // Check if path is within allowed workspaces
  isPathAllowed(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);

    for (const workspace of this.workspacePaths) {
      const normalizedWorkspace = this.normalizePath(workspace);
      if (normalizedPath.startsWith(normalizedWorkspace)) {
        return true;
      }
    }

    return false;
  }

  private normalizePath(path: string): string {
    // Normalize path separators and resolve . and ..
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  async readFile(filePath: string): Promise<FileReadResult> {
    try {
      // Validate path is allowed
      if (!this.isPathAllowed(filePath)) {
        return {
          content: '',
          path: filePath,
          error: 'Path not in allowed workspaces'
        };
      }

      // Get file stats to check size
      const stats = await Neutralino.filesystem.getStats(filePath);

      if (stats.size > MAX_FILE_SIZE) {
        return {
          content: '',
          path: filePath,
          error: `File too large: ${stats.size} bytes (max ${MAX_FILE_SIZE})`
        };
      }

      // Handle special formats
      const ext = filePath.toLowerCase().split('.').pop();

      if (ext === 'docx') {
        return await this.readDocx(filePath);
      }

      if (ext === 'xlsx') {
        return await this.readXlsx(filePath);
      }

      // Read text file
      const content = await Neutralino.filesystem.readFile(filePath);
      return { content, path: filePath };

    } catch (error) {
      return {
        content: '',
        path: filePath,
        error: String(error)
      };
    }
  }

  async writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isPathAllowed(filePath)) {
        return { success: false, error: 'Path not in allowed workspaces' };
      }

      // Handle special formats
      const ext = filePath.toLowerCase().split('.').pop();

      if (ext === 'docx') {
        return await this.writeDocx(filePath, content);
      }

      if (ext === 'xlsx') {
        return await this.writeXlsx(filePath, content);
      }

      // Ensure directory exists
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      await this.ensureDirectory(dir);

      // Write text file
      await Neutralino.filesystem.writeFile(filePath, content);
      return { success: true };

    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async listDirectory(dirPath: string): Promise<DirectoryEntry[]> {
    try {
      const entries = await Neutralino.filesystem.readDirectory(dirPath);

      return entries.map(entry => ({
        name: entry.entry,
        type: entry.type === 'DIRECTORY' ? 'directory' : 'file'
      }));

    } catch (error) {
      console.error(`Failed to list directory ${dirPath}:`, error);
      return [];
    }
  }

  async getStats(filePath: string): Promise<Neutralino.filesystem.Stats | null> {
    try {
      return await Neutralino.filesystem.getStats(filePath);
    } catch {
      return null;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    const stats = await this.getStats(filePath);
    return stats !== null;
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await Neutralino.filesystem.createDirectory(dirPath);
    } catch {
      // Directory may already exist
    }
  }

  // DOCX handling (simplified - actual implementation would need a zip library)
  private async readDocx(filePath: string): Promise<FileReadResult> {
    // DOCX files are ZIP archives containing XML
    // In browser context, we'd need JSZip or similar

    // For now, read as binary and let frontend handle
    try {
      const data = await Neutralino.filesystem.readBinaryFile(filePath);
      const base64 = this.arrayBufferToBase64(data);
      return {
        content: base64,
        path: filePath,
        // Mark as binary so frontend knows to handle specially
      };
    } catch (error) {
      return { content: '', path: filePath, error: String(error) };
    }
  }

  private async writeDocx(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    // Would need JSZip to properly handle DOCX writing
    // For now, treat content as base64 of the entire file
    try {
      const data = this.base64ToArrayBuffer(content);
      await Neutralino.filesystem.writeBinaryFile(filePath, data);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async readXlsx(filePath: string): Promise<FileReadResult> {
    // Similar to DOCX - XLSX is also a ZIP archive
    try {
      const data = await Neutralino.filesystem.readBinaryFile(filePath);
      const base64 = this.arrayBufferToBase64(data);
      return { content: base64, path: filePath };
    } catch (error) {
      return { content: '', path: filePath, error: String(error) };
    }
  }

  private async writeXlsx(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const data = this.base64ToArrayBuffer(content);
      await Neutralino.filesystem.writeBinaryFile(filePath, data);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
```

### Directory Listing with Depth

```typescript
// src/FileOperations.ts (continued)

interface FolderStructure {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: FolderStructure[];
}

export async function getFolders(
  basePath: string,
  depth: number = 1
): Promise<FolderStructure[]> {
  const result: FolderStructure[] = [];

  try {
    const entries = await Neutralino.filesystem.readDirectory(basePath);

    for (const entry of entries) {
      const fullPath = `${basePath}/${entry.entry}`;
      const isDir = entry.type === 'DIRECTORY';

      const item: FolderStructure = {
        path: fullPath,
        name: entry.entry,
        type: isDir ? 'directory' : 'file'
      };

      // Recursively get children for directories if depth allows
      if (isDir && depth > 1) {
        item.children = await getFolders(fullPath, depth - 1);
      }

      result.push(item);
    }

  } catch (error) {
    console.error(`Failed to get folders at ${basePath}:`, error);
  }

  return result;
}
```

### Path Resolution

```typescript
// src/utils/pathUtils.ts

export function resolvePath(
  inputPath: string,
  workspacePaths: string[],
  currentDir?: string
): string | null {
  // Handle file:// URLs
  if (inputPath.startsWith('file://')) {
    inputPath = inputPath.replace('file://', '');
  }

  // Absolute path
  if (inputPath.startsWith('/') || /^[A-Z]:/i.test(inputPath)) {
    return inputPath;
  }

  // Relative path - try current directory first
  if (currentDir) {
    const resolved = `${currentDir}/${inputPath}`;
    // Would need to check if exists
    return resolved;
  }

  // Try each workspace
  for (const workspace of workspacePaths) {
    const resolved = `${workspace}/${inputPath}`;
    // Would need to check if exists
    return resolved;
  }

  return null;
}

export function getParentDirectory(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep > 0 ? filePath.substring(0, lastSep) : filePath;
}

export function getFileName(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep >= 0 ? filePath.substring(lastSep + 1) : filePath;
}

export function getExtension(filePath: string): string {
  const fileName = getFileName(filePath);
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(lastDot + 1).toLowerCase() : '';
}
```

## Handler Integration

```typescript
// src/handlers/FileHandler.ts
import { FileOperations, getFolders } from "../FileOperations";
import { messages } from "../messages/builders";
import { Edge } from "../Edge";

export class FileHandler {
  private fileOps: FileOperations;

  constructor(private edge: Edge) {
    this.fileOps = new FileOperations();
  }

  setWorkspacePaths(paths: string[]): void {
    this.fileOps.setWorkspacePaths(paths);
  }

  async handleFileChunkRequest(payload: {
    path: string;
    requestId: string;
  }): Promise<void> {
    const { path, requestId } = payload;

    const result = await this.fileOps.readFile(path);

    await this.edge.sendResponse(
      messages.fileChunkResult(requestId, result.path, result.content, result.error)
    );
  }

  async handleBlockSave(payload: {
    path: string;
    content: string;
    blockId: string;
  }): Promise<void> {
    const { path, content, blockId } = payload;

    const result = await this.fileOps.writeFile(path, content);

    await this.edge.sendResponse({
      type: 'block:save_result',
      payload: {
        blockId,
        success: result.success,
        error: result.error
      }
    });
  }

  async handleDirList(payload: {
    path: string;
  }): Promise<void> {
    const { path } = payload;

    const entries = await this.fileOps.listDirectory(path);

    await this.edge.sendResponse({
      type: 'edge:dir_list_response',
      payload: { path, entries }
    });
  }

  async handleGetFolders(payload: {
    path: string;
    depth?: number;
  }): Promise<void> {
    const { path, depth = 1 } = payload;

    const folders = await getFolders(path, depth);

    await this.edge.sendResponse({
      type: 'edge:folders_response',
      payload: { path, folders }
    });
  }
}
```

## API Comparison

| Operation | Python | Neutralino.js |
|-----------|--------|---------------|
| Read text file | `open(path).read()` | `Neutralino.filesystem.readFile(path)` |
| Read binary | `open(path, 'rb').read()` | `Neutralino.filesystem.readBinaryFile(path)` |
| Write text | `open(path, 'w').write(data)` | `Neutralino.filesystem.writeFile(path, data)` |
| Write binary | `open(path, 'wb').write(data)` | `Neutralino.filesystem.writeBinaryFile(path, data)` |
| List directory | `os.listdir(path)` | `Neutralino.filesystem.readDirectory(path)` |
| File stats | `os.stat(path)` | `Neutralino.filesystem.getStats(path)` |
| Create directory | `os.makedirs(path)` | `Neutralino.filesystem.createDirectory(path)` |
| Delete file | `os.remove(path)` | `Neutralino.filesystem.removeFile(path)` |
| Delete directory | `os.rmdir(path)` | `Neutralino.filesystem.removeDirectory(path)` |
| Check exists | `os.path.exists(path)` | Try `getStats`, catch error |
| Copy file | `shutil.copy(src, dst)` | `Neutralino.filesystem.copyFile(src, dst)` |
| Move file | `shutil.move(src, dst)` | `Neutralino.filesystem.moveFile(src, dst)` |

## Neutralino Filesystem API Reference

```typescript
// Available Neutralino.filesystem methods:

// Reading
Neutralino.filesystem.readFile(path: string): Promise<string>
Neutralino.filesystem.readBinaryFile(path: string): Promise<ArrayBuffer>
Neutralino.filesystem.readDirectory(path: string): Promise<DirectoryEntry[]>
Neutralino.filesystem.getStats(path: string): Promise<Stats>

// Writing
Neutralino.filesystem.writeFile(path: string, data: string): Promise<void>
Neutralino.filesystem.writeBinaryFile(path: string, data: ArrayBuffer): Promise<void>
Neutralino.filesystem.appendFile(path: string, data: string): Promise<void>
Neutralino.filesystem.appendBinaryFile(path: string, data: ArrayBuffer): Promise<void>

// Directory operations
Neutralino.filesystem.createDirectory(path: string): Promise<void>
Neutralino.filesystem.removeDirectory(path: string): Promise<void>

// File operations
Neutralino.filesystem.removeFile(path: string): Promise<void>
Neutralino.filesystem.copyFile(src: string, dst: string): Promise<void>
Neutralino.filesystem.moveFile(src: string, dst: string): Promise<void>

// Watching (see file-sync.md for details)
Neutralino.filesystem.createWatcher(path: string): Promise<number>
Neutralino.filesystem.removeWatcher(id: number): Promise<void>
```

## Handling DOCX/XLSX Files

For full DOCX/XLSX support, you'll need a library like JSZip:

```typescript
// With JSZip loaded
import JSZip from 'jszip';

async function extractDocxContent(filePath: string): Promise<string> {
  const data = await Neutralino.filesystem.readBinaryFile(filePath);
  const zip = await JSZip.loadAsync(data);

  // DOCX stores content in word/document.xml
  const documentXml = await zip.file('word/document.xml')?.async('string');
  return documentXml || '';
}

async function saveDocxContent(filePath: string, xmlContent: string): Promise<void> {
  // Read existing file
  const data = await Neutralino.filesystem.readBinaryFile(filePath);
  const zip = await JSZip.loadAsync(data);

  // Update document.xml
  zip.file('word/document.xml', xmlContent);

  // Generate new zip
  const newData = await zip.generateAsync({ type: 'arraybuffer' });
  await Neutralino.filesystem.writeBinaryFile(filePath, newData);
}
```

## Error Handling

```typescript
// Common error codes from Neutralino
const NE_FS_FILRDER = 'NE_FS_FILRDER'; // File read error
const NE_FS_FILWRER = 'NE_FS_FILWRER'; // File write error
const NE_FS_NOPATHE = 'NE_FS_NOPATHE'; // Path doesn't exist
const NE_FS_COPYFER = 'NE_FS_COPYFER'; // Copy failed
const NE_FS_MOVEFER = 'NE_FS_MOVEFER'; // Move failed

try {
  const content = await Neutralino.filesystem.readFile(path);
} catch (error: any) {
  if (error.code === 'NE_FS_NOPATHE') {
    console.error('File not found:', path);
  } else if (error.code === 'NE_FS_FILRDER') {
    console.error('Permission denied:', path);
  } else {
    console.error('Unknown error:', error);
  }
}
```
