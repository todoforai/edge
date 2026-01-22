# File Synchronization

## Overview

The Python edge uses `watchfiles` (Rust-based) for high-performance file watching with sophisticated batching, hash-based change detection, and gitignore filtering. Neutralino.js provides `filesystem.createWatcher` with a simpler event model.

## Python Implementation

Location: `/edge/todoforai_edge/handlers/file_sync.py`

### Key Features

```python
class WorkspaceSyncManager:
    def __init__(self, edge, workspace_dir):
        self.edge = edge
        self.workspace_dir = workspace_dir
        self.file_cache: Dict[str, FileState] = {}  # Hash-based cache
        self.batch_interval = 0.5  # 500ms batching
        self.pending_changes = {}

    async def _watch_files(self):
        async for changes in awatch(
            self.workspace_dir,
            recursive=True,
            step=50,  # 50ms poll interval
        ):
            for change, path in changes:
                self.pending_changes[path] = (change, time.time())

    async def _batch_processor(self):
        while self.is_running:
            await asyncio.sleep(self.batch_interval)
            if self.pending_changes:
                changes = self.pending_changes.copy()
                self.pending_changes.clear()
                await self._process_batch(changes)
```

### Features
- Recursive watching
- 50ms poll interval
- 500ms batch processing
- MD5 hash-based change detection
- `.gitignore` and `.aishignore` filtering
- Max 2000 files limit
- Max 100KB per file sync
- Thread pool for hash computation

## Neutralino.js Implementation

### File Sync Manager

```typescript
// src/FileSyncManager.ts

interface FileState {
  mtime: number;
  size: number;
  hash: string;
}

interface SyncStats {
  filesSynced: number;
  filesSkipped: number;
  syncErrors: number;
  bytesSynced: number;
}

const MAX_SYNC_BYTES = 100 * 1024;  // 100KB
const MAX_SYNC_FILES = 2000;
const BATCH_INTERVAL = 500;  // 500ms

export class FileSyncManager {
  private watcherId: number | null = null;
  private fileCache: Map<string, FileState> = new Map();
  private pendingChanges: Map<string, { action: string; timestamp: number }> = new Map();
  private batchTimer: number | null = null;
  private isRunning = false;
  private projectFiles: Set<string> = new Set();
  private filteredDirs: Set<string> = new Set();
  private eventHandler: ((evt: CustomEvent) => void) | null = null;

  stats: SyncStats = {
    filesSynced: 0,
    filesSkipped: 0,
    syncErrors: 0,
    bytesSynced: 0
  };

  constructor(
    private edge: Edge,
    private workspaceDir: string
  ) {}

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    // Initialize file lists with filtering
    await this.initializeFileLists();

    // Check file count
    if (this.projectFiles.size > MAX_SYNC_FILES) {
      throw new Error(
        `Workspace has ${this.projectFiles.size} files, exceeds limit of ${MAX_SYNC_FILES}`
      );
    }

    // Start file watcher
    this.watcherId = await Neutralino.filesystem.createWatcher(this.workspaceDir);

    // Set up event handler
    this.eventHandler = (evt: CustomEvent) => this.handleWatchEvent(evt.detail);
    Neutralino.events.on('watchFile', this.eventHandler);

    // Start batch processor
    this.startBatchProcessor();

    // Perform initial sync
    await this.initialSync();

    console.log(`Started file sync for ${this.workspaceDir}`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Stop watcher
    if (this.watcherId !== null) {
      await Neutralino.filesystem.removeWatcher(this.watcherId);
      this.watcherId = null;
    }

    // Remove event handler
    if (this.eventHandler) {
      Neutralino.events.off('watchFile', this.eventHandler);
      this.eventHandler = null;
    }

    // Stop batch timer
    if (this.batchTimer !== null) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    console.log(`Stopped file sync for ${this.workspaceDir}`);
  }

  private async initializeFileLists(): Promise<void> {
    // Load gitignore patterns
    const ignorePatterns = await this.loadIgnorePatterns();

    // Scan directory and filter
    const files = await this.scanDirectory(this.workspaceDir, ignorePatterns);

    this.projectFiles = new Set(files);

    console.log(`Found ${this.projectFiles.size} files to sync`);
  }

  private async loadIgnorePatterns(): Promise<string[]> {
    const patterns: string[] = [
      // Default ignored directories
      'node_modules',
      '.git',
      '__pycache__',
      '.venv',
      'venv',
      '.idea',
      '.vscode',
      'dist',
      'build',
      '.next',
      'target'
    ];

    // Try to load .gitignore
    try {
      const gitignorePath = `${this.workspaceDir}/.gitignore`;
      const content = await Neutralino.filesystem.readFile(gitignorePath);
      const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
      patterns.push(...lines);
    } catch {
      // No .gitignore
    }

    // Try to load .aishignore
    try {
      const aishignorePath = `${this.workspaceDir}/.aishignore`;
      const content = await Neutralino.filesystem.readFile(aishignorePath);
      const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
      patterns.push(...lines);
    } catch {
      // No .aishignore
    }

    return patterns;
  }

  private async scanDirectory(
    dir: string,
    ignorePatterns: string[],
    files: string[] = []
  ): Promise<string[]> {
    try {
      const entries = await Neutralino.filesystem.readDirectory(dir);

      for (const entry of entries) {
        const fullPath = `${dir}/${entry.entry}`;
        const relativePath = fullPath.replace(this.workspaceDir + '/', '');

        // Check if ignored
        if (this.shouldIgnore(relativePath, ignorePatterns)) {
          if (entry.type === 'DIRECTORY') {
            this.filteredDirs.add(fullPath);
          }
          continue;
        }

        if (entry.type === 'DIRECTORY') {
          await this.scanDirectory(fullPath, ignorePatterns, files);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning ${dir}:`, error);
    }

    return files;
  }

  private shouldIgnore(path: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      // Simple pattern matching (not full glob support)
      if (pattern.endsWith('/')) {
        // Directory pattern
        if (path.startsWith(pattern) || path.includes('/' + pattern)) {
          return true;
        }
      } else if (pattern.startsWith('*.')) {
        // Extension pattern
        if (path.endsWith(pattern.slice(1))) {
          return true;
        }
      } else {
        // Exact or partial match
        if (path === pattern || path.includes('/' + pattern) || path.startsWith(pattern + '/')) {
          return true;
        }
      }
    }
    return false;
  }

  private handleWatchEvent(detail: {
    id: number;
    action: string;
    dir: string;
    filename: string;
  }): void {
    if (detail.id !== this.watcherId) return;

    const fullPath = `${detail.dir}/${detail.filename}`;

    // Check if in filtered directory
    for (const filtered of this.filteredDirs) {
      if (fullPath.startsWith(filtered)) return;
    }

    // Add to pending changes
    this.pendingChanges.set(fullPath, {
      action: detail.action,
      timestamp: Date.now()
    });
  }

  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      this.processBatch();
    }, BATCH_INTERVAL) as unknown as number;
  }

  private async processBatch(): Promise<void> {
    if (this.pendingChanges.size === 0) return;

    // Copy and clear pending changes
    const changes = new Map(this.pendingChanges);
    this.pendingChanges.clear();

    // Group by action type
    const creates: string[] = [];
    const modifies: string[] = [];
    const deletes: string[] = [];

    for (const [path, { action }] of changes) {
      switch (action) {
        case 'add':
          creates.push(path);
          this.projectFiles.add(path);
          break;
        case 'modified':
          modifies.push(path);
          break;
        case 'delete':
          deletes.push(path);
          this.projectFiles.delete(path);
          this.fileCache.delete(path);
          break;
      }
    }

    // Process creates and modifies
    for (const path of [...creates, ...modifies]) {
      await this.syncFile(path, creates.includes(path) ? 'create' : 'modify');
    }

    // Process deletes
    for (const path of deletes) {
      await this.sendDelete(path);
    }
  }

  private async syncFile(filePath: string, action: 'create' | 'modify'): Promise<void> {
    try {
      // Get file stats
      const stats = await Neutralino.filesystem.getStats(filePath);

      // Skip oversized files
      if (stats.size > MAX_SYNC_BYTES) {
        console.warn(`Skipping oversized file: ${filePath} (${stats.size} bytes)`);
        this.stats.filesSkipped++;
        return;
      }

      // Read file
      const content = await Neutralino.filesystem.readFile(filePath);

      // Compute hash
      const hash = await this.computeHash(content);

      // Check cache
      const cached = this.fileCache.get(filePath);
      if (cached && cached.hash === hash) {
        this.stats.filesSkipped++;
        return;
      }

      // Update cache
      this.fileCache.set(filePath, {
        mtime: stats.modifiedAt || Date.now(),
        size: stats.size,
        hash
      });

      // Send sync message
      const messageType = action === 'create'
        ? 'workspace:file_create_sync'
        : 'workspace:file_modify_sync';

      await this.edge.sendResponse({
        type: messageType,
        payload: {
          path: filePath,
          content,
          edgeId: this.edge.edgeId,
          userId: this.edge.userId
        }
      });

      this.stats.filesSynced++;
      this.stats.bytesSynced += stats.size;

    } catch (error) {
      console.error(`Error syncing ${filePath}:`, error);
      this.stats.syncErrors++;
    }
  }

  private async sendDelete(filePath: string): Promise<void> {
    await this.edge.sendResponse({
      type: 'workspace:file_delete_sync',
      payload: {
        path: filePath,
        edgeId: this.edge.edgeId,
        userId: this.edge.userId
      }
    });
  }

  private async initialSync(): Promise<void> {
    console.log('Starting initial sync...');

    const batchSize = 50;
    const files = Array.from(this.projectFiles);

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      await Promise.all(
        batch.map(path => this.syncFile(path, 'create'))
      );

      // Small delay between batches
      if (i + batchSize < files.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Send completion signal
    await this.edge.sendResponse({
      type: 'workspace:file_done',
      payload: {
        path: this.workspaceDir,
        edgeId: this.edge.edgeId,
        userId: this.edge.userId,
        stats: this.stats
      }
    });

    console.log(`Initial sync complete: ${this.stats.filesSynced} files`);
  }

  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('MD5', data).catch(() => {
      // MD5 not available in all browsers, use SHA-256
      return crypto.subtle.digest('SHA-256', data);
    });
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

### Sync Manager Registry

```typescript
// src/FileSyncRegistry.ts

const activeSyncs: Map<string, FileSyncManager> = new Map();

export async function startWorkspaceSync(
  edge: Edge,
  workspaceDir: string
): Promise<FileSyncManager> {
  // Check if already syncing
  if (activeSyncs.has(workspaceDir)) {
    return activeSyncs.get(workspaceDir)!;
  }

  const manager = new FileSyncManager(edge, workspaceDir);
  activeSyncs.set(workspaceDir, manager);

  try {
    await manager.start();
    return manager;
  } catch (error) {
    activeSyncs.delete(workspaceDir);
    throw error;
  }
}

export async function stopWorkspaceSync(workspaceDir: string): Promise<boolean> {
  const manager = activeSyncs.get(workspaceDir);
  if (!manager) return false;

  await manager.stop();
  activeSyncs.delete(workspaceDir);
  return true;
}

export async function stopAllSyncs(): Promise<void> {
  for (const manager of activeSyncs.values()) {
    await manager.stop();
  }
  activeSyncs.clear();
}

export function getActiveSyncs(): string[] {
  return Array.from(activeSyncs.keys());
}
```

## Neutralino Watcher API

```typescript
// Available events from Neutralino.filesystem.createWatcher

interface WatchFileEvent {
  id: number;       // Watcher ID
  action: string;   // 'add' | 'delete' | 'modified' | 'moved'
  dir: string;      // Directory path
  filename: string; // File name
}

// Create watcher
const watcherId = await Neutralino.filesystem.createWatcher('/path/to/watch');

// Listen for events
Neutralino.events.on('watchFile', (evt: CustomEvent<WatchFileEvent>) => {
  console.log(evt.detail);
});

// Remove watcher
await Neutralino.filesystem.removeWatcher(watcherId);
```

## Feature Comparison

| Feature | Python (watchfiles) | Neutralino |
|---------|---------------------|------------|
| Recursive watching | Built-in | Built-in |
| Poll interval control | Yes (step=50ms) | No |
| Event types | add, modify, delete | add, modified, delete, moved |
| Batch events | Manual (500ms) | Manual |
| Debouncing | Manual | Manual |
| Gitignore support | Manual | Manual |
| Hash-based dedup | MD5 + threading | Web Crypto API |
| Max file limit | Configurable | Manual |
| Timeout yield | Yes | No |

## Limitations

1. **No poll interval control** - Neutralino uses OS-level watching, can't tune timing
2. **Simpler event model** - Less granular than watchfiles
3. **No stop event** - Must remove watcher explicitly
4. **Platform differences** - Behavior may vary across OS

## Handling Edge Cases

```typescript
// Handle rapid successive changes
private handleWatchEvent(detail: WatchFileEvent): void {
  const fullPath = `${detail.dir}/${detail.filename}`;

  // Debounce: if same file changed within 100ms, update timestamp only
  const existing = this.pendingChanges.get(fullPath);
  if (existing && Date.now() - existing.timestamp < 100) {
    existing.timestamp = Date.now();
    // Keep the latest action
    if (detail.action === 'delete') {
      existing.action = 'delete';
    }
    return;
  }

  this.pendingChanges.set(fullPath, {
    action: detail.action,
    timestamp: Date.now()
  });
}

// Handle moved files
private handleMoved(from: string, to: string): void {
  // Treat as delete + create
  this.pendingChanges.set(from, { action: 'delete', timestamp: Date.now() });
  this.pendingChanges.set(to, { action: 'add', timestamp: Date.now() });
}
```

## Testing

```typescript
async function testFileSync() {
  const manager = new FileSyncManager(mockEdge, '/tmp/test-workspace');

  await manager.start();

  // Create a file
  await Neutralino.filesystem.writeFile('/tmp/test-workspace/test.txt', 'Hello');

  // Wait for sync
  await new Promise(r => setTimeout(r, 1000));

  // Modify file
  await Neutralino.filesystem.writeFile('/tmp/test-workspace/test.txt', 'Hello World');

  // Wait for sync
  await new Promise(r => setTimeout(r, 1000));

  // Delete file
  await Neutralino.filesystem.removeFile('/tmp/test-workspace/test.txt');

  // Wait for sync
  await new Promise(r => setTimeout(r, 1000));

  console.log('Stats:', manager.stats);

  await manager.stop();
}
```
