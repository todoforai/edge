# Configuration Management

## Overview

The Python edge uses an Observable pattern for reactive configuration updates. When config changes, subscribers are notified and the changes are synced to the server. This pattern translates well to JavaScript.

## Python Implementation

Location: `/edge/todoforai_edge/observable.py` and `/edge/todoforai_edge/edge_config.py`

### Observable Pattern

```python
class Observable:
    def __init__(self, initial_value):
        self._value = initial_value
        self._subscribers = []
        self._async_subscribers = []

    def subscribe(self, callback):
        self._subscribers.append(callback)
        return lambda: self._subscribers.remove(callback)

    def subscribe_async(self, callback):
        self._async_subscribers.append(callback)
        return lambda: self._async_subscribers.remove(callback)

    def update_value(self, new_value, notify=True):
        old_value = self._value
        self._value = new_value

        if notify:
            # Get changed fields
            changes = self._get_changes(old_value, new_value)
            if changes:
                for callback in self._subscribers:
                    callback(changes)
                for callback in self._async_subscribers:
                    asyncio.create_task(callback(changes))
```

### EdgeConfig

```python
class EdgeConfig:
    def __init__(self, initial_data=None):
        self.config = ObservableDictionary(initial_data or {})

    def add_workspace_path(self, path):
        current = self.config.get("workspacepaths", [])
        if path not in current:
            self.config["workspacepaths"] = current + [path]

    def set_mcp_json(self, mcp_json):
        self.config["mcp_json"] = mcp_json
```

## Neutralino.js Implementation

### Observable Class

```typescript
// src/Observable.ts

type Subscriber<T> = (value: T, changes?: Partial<T>) => void;
type AsyncSubscriber<T> = (value: T, changes?: Partial<T>) => Promise<void>;
type Unsubscribe = () => void;

export class Observable<T> {
  private value: T;
  private subscribers: Set<Subscriber<T>> = new Set();
  private asyncSubscribers: Set<AsyncSubscriber<T>> = new Set();
  private debounceTimer: number | null = null;
  private debounceMs: number;

  constructor(initialValue: T, debounceMs: number = 50) {
    this.value = initialValue;
    this.debounceMs = debounceMs;
  }

  getValue(): T {
    return this.value;
  }

  subscribe(callback: Subscriber<T>): Unsubscribe {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  subscribeAsync(callback: AsyncSubscriber<T>): Unsubscribe {
    this.asyncSubscribers.add(callback);
    return () => this.asyncSubscribers.delete(callback);
  }

  setValue(newValue: T, notify: boolean = true): void {
    const oldValue = this.value;
    this.value = newValue;

    if (notify) {
      const changes = this.getChanges(oldValue, newValue);
      if (changes && Object.keys(changes).length > 0) {
        this.notifySubscribers(changes);
      }
    }
  }

  updateValue(partial: Partial<T>, notify: boolean = true): void {
    const newValue = { ...this.value, ...partial };
    this.setValue(newValue as T, notify);
  }

  private getChanges(oldValue: T, newValue: T): Partial<T> | null {
    if (typeof oldValue !== 'object' || typeof newValue !== 'object') {
      return oldValue !== newValue ? newValue as Partial<T> : null;
    }

    const changes: Partial<T> = {};
    const allKeys = new Set([
      ...Object.keys(oldValue as object),
      ...Object.keys(newValue as object)
    ]);

    for (const key of allKeys) {
      const oldVal = (oldValue as Record<string, unknown>)[key];
      const newVal = (newValue as Record<string, unknown>)[key];

      if (!this.deepEqual(oldVal, newVal)) {
        (changes as Record<string, unknown>)[key] = newVal;
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!this.deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )) {
        return false;
      }
    }

    return true;
  }

  private notifySubscribers(changes: Partial<T>): void {
    // Debounce notifications
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;

      // Sync subscribers
      for (const callback of this.subscribers) {
        try {
          callback(this.value, changes);
        } catch (error) {
          console.error('Subscriber error:', error);
        }
      }

      // Async subscribers
      for (const callback of this.asyncSubscribers) {
        callback(this.value, changes).catch(error => {
          console.error('Async subscriber error:', error);
        });
      }
    }, this.debounceMs) as unknown as number;
  }
}
```

### EdgeConfig Class

```typescript
// src/EdgeConfig.ts
import { Observable } from './Observable';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface EdgeMCP {
  serverId: string;
  status: 'READY' | 'STARTING' | 'INSTALLING' | 'CRASHED' | 'STOPPED';
  tools: MCPTool[];
  env: Record<string, string>;
  registryId?: string;
}

export interface EdgeConfigData {
  id: string;
  name: string;
  workspacepaths: string[];
  installedMCPs: Record<string, EdgeMCP>;
  mcp_json: Record<string, unknown>;
  mcp_config_path: string;
  ownerId: string;
  status: 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR';
  isShellEnabled: boolean;
  isFileSystemEnabled: boolean;
  createdAt: string;
}

const DEFAULT_CONFIG: EdgeConfigData = {
  id: '',
  name: '',
  workspacepaths: [],
  installedMCPs: {},
  mcp_json: {},
  mcp_config_path: '',
  ownerId: '',
  status: 'OFFLINE',
  isShellEnabled: true,
  isFileSystemEnabled: true,
  createdAt: new Date().toISOString()
};

export class EdgeConfig {
  public readonly config: Observable<EdgeConfigData>;

  constructor(initialData?: Partial<EdgeConfigData>) {
    this.config = new Observable<EdgeConfigData>({
      ...DEFAULT_CONFIG,
      ...initialData
    });
  }

  // Getters
  get id(): string {
    return this.config.getValue().id;
  }

  get workspacePaths(): string[] {
    return this.config.getValue().workspacepaths;
  }

  get installedMCPs(): Record<string, EdgeMCP> {
    return this.config.getValue().installedMCPs;
  }

  // Workspace management
  addWorkspacePath(path: string): boolean {
    const current = this.config.getValue().workspacepaths;

    if (current.includes(path)) {
      return false;
    }

    this.config.updateValue({
      workspacepaths: [...current, path]
    });

    return true;
  }

  removeWorkspacePath(path: string): boolean {
    const current = this.config.getValue().workspacepaths;
    const index = current.indexOf(path);

    if (index === -1) {
      return false;
    }

    this.config.updateValue({
      workspacepaths: current.filter(p => p !== path)
    });

    return true;
  }

  // MCP management
  setMCPJson(mcpJson: Record<string, unknown>): void {
    this.config.updateValue({ mcp_json: mcpJson });
  }

  setMCPConfigPath(path: string): void {
    this.config.updateValue({ mcp_config_path: path });
  }

  updateInstalledMCP(serverId: string, data: Partial<EdgeMCP>): void {
    const current = this.config.getValue().installedMCPs;

    this.config.updateValue({
      installedMCPs: {
        ...current,
        [serverId]: {
          ...current[serverId],
          ...data,
          serverId
        }
      }
    });
  }

  removeInstalledMCP(serverId: string): void {
    const current = { ...this.config.getValue().installedMCPs };
    delete current[serverId];

    this.config.updateValue({ installedMCPs: current });
  }

  // Status
  setStatus(status: EdgeConfigData['status']): void {
    this.config.updateValue({ status });
  }

  // Subscribe to changes
  onChange(callback: (changes: Partial<EdgeConfigData>) => void): () => void {
    return this.config.subscribe((_, changes) => {
      if (changes) callback(changes);
    });
  }

  onChangeAsync(
    callback: (changes: Partial<EdgeConfigData>) => Promise<void>
  ): () => void {
    return this.config.subscribeAsync(async (_, changes) => {
      if (changes) await callback(changes);
    });
  }

  // Bulk update
  update(data: Partial<EdgeConfigData>, notify: boolean = true): void {
    this.config.updateValue(data, notify);
  }

  // Get full config
  getAll(): EdgeConfigData {
    return this.config.getValue();
  }
}
```

### Config Sync with Server

```typescript
// src/ConfigSync.ts
import { EdgeConfig, EdgeConfigData } from './EdgeConfig';

// Fields that should be synced to server
const SYNCABLE_FIELDS: (keyof EdgeConfigData)[] = [
  'workspacepaths',
  'installedMCPs',
  'name',
  'isShellEnabled',
  'isFileSystemEnabled'
];

export class ConfigSync {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private edgeConfig: EdgeConfig,
    private apiUrl: string,
    private apiKey: string
  ) {}

  start(): void {
    this.unsubscribe = this.edgeConfig.onChangeAsync(async (changes) => {
      await this.syncChanges(changes);
    });
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private async syncChanges(changes: Partial<EdgeConfigData>): Promise<void> {
    // Filter to only syncable fields
    const syncData: Partial<EdgeConfigData> = {};
    let hasSyncableChanges = false;

    for (const key of SYNCABLE_FIELDS) {
      if (key in changes) {
        (syncData as Record<string, unknown>)[key] = changes[key];
        hasSyncableChanges = true;
      }
    }

    if (!hasSyncableChanges) {
      return;
    }

    const edgeId = this.edgeConfig.id;
    if (!edgeId) {
      console.warn('Cannot sync config: no edge ID');
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/v1/edges/${edgeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(syncData)
      });

      if (!response.ok) {
        console.error(`Config sync failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Config sync error:', error);
    }
  }
}
```

### Persistent Storage

```typescript
// src/ConfigStorage.ts
import { EdgeConfigData } from './EdgeConfig';

const STORAGE_KEY = 'edge_config';

export class ConfigStorage {
  async save(config: Partial<EdgeConfigData>): Promise<void> {
    try {
      const data = JSON.stringify(config);
      await Neutralino.storage.setData(STORAGE_KEY, data);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  async load(): Promise<Partial<EdgeConfigData> | null> {
    try {
      const data = await Neutralino.storage.getData(STORAGE_KEY);
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      await Neutralino.storage.setData(STORAGE_KEY, '');
    } catch (error) {
      console.error('Failed to clear config:', error);
    }
  }
}
```

## Application Config

```typescript
// src/Config.ts

export interface AppConfig {
  apiUrl: string;
  apiKey: string;
  debug: boolean;
}

const DEFAULT_API_URL = 'https://api.todofor.ai';

export class Config {
  apiUrl: string;
  apiKey: string;
  debug: boolean;

  constructor() {
    this.apiUrl = DEFAULT_API_URL;
    this.apiKey = '';
    this.debug = false;
  }

  async loadFromEnv(): Promise<void> {
    // Try to load from environment
    try {
      const apiUrl = await Neutralino.os.getEnv('TODOFORAI_API_URL');
      if (apiUrl) this.apiUrl = apiUrl;
    } catch {}

    try {
      const apiKey = await Neutralino.os.getEnv('TODOFORAI_API_KEY');
      if (apiKey) this.apiKey = apiKey;
    } catch {}

    try {
      const debug = await Neutralino.os.getEnv('TODOFORAI_DEBUG');
      if (debug === '1' || debug === 'true') this.debug = true;
    } catch {}
  }

  async loadFromStorage(): Promise<void> {
    try {
      const data = await Neutralino.storage.getData('app_config');
      const parsed = JSON.parse(data);

      if (parsed.apiUrl) this.apiUrl = parsed.apiUrl;
      if (parsed.apiKey) this.apiKey = parsed.apiKey;
      if (parsed.debug !== undefined) this.debug = parsed.debug;
    } catch {
      // No stored config
    }
  }

  async save(): Promise<void> {
    await Neutralino.storage.setData('app_config', JSON.stringify({
      apiUrl: this.apiUrl,
      apiKey: this.apiKey,
      debug: this.debug
    }));
  }

  applyArgs(args: Record<string, string>): void {
    if (args['--api-url']) this.apiUrl = args['--api-url'];
    if (args['--api-key']) this.apiKey = args['--api-key'];
    if (args['--debug']) this.debug = true;
  }

  getWsUrl(): string {
    return this.apiUrl.replace(/^http/, 'ws');
  }

  validate(): { valid: boolean; error?: string } {
    if (!this.apiKey) {
      return { valid: false, error: 'API key is required' };
    }
    return { valid: true };
  }
}
```

## Integration Example

```typescript
// src/main.ts
import { Config } from './Config';
import { EdgeConfig } from './EdgeConfig';
import { ConfigSync } from './ConfigSync';
import { Edge } from './Edge';

async function main() {
  // Load app config
  const config = new Config();
  await config.loadFromEnv();
  await config.loadFromStorage();

  // Validate
  const validation = config.validate();
  if (!validation.valid) {
    console.error(validation.error);
    // Prompt user for API key...
    return;
  }

  // Create edge config
  const edgeConfig = new EdgeConfig();

  // Set up config sync
  const configSync = new ConfigSync(edgeConfig, config.apiUrl, config.apiKey);
  configSync.start();

  // Subscribe to workspace changes
  edgeConfig.onChange((changes) => {
    if (changes.workspacepaths) {
      console.log('Workspace paths changed:', changes.workspacepaths);
      // Start/stop file sync as needed
    }
  });

  // Create and start edge
  const edge = new Edge(config, edgeConfig);
  await edge.start();

  // Handle config updates from server
  edge.onConfigUpdate((serverConfig) => {
    edgeConfig.update(serverConfig, false); // Don't notify (avoid sync loop)
  });
}

Neutralino.init();
Neutralino.events.on('ready', main);
```

## Comparison

| Feature | Python | Neutralino.js |
|---------|--------|---------------|
| Observable pattern | Custom implementation | Custom implementation |
| Debouncing | 50ms default | 50ms default |
| Async subscribers | `subscribe_async` | `subscribeAsync` |
| Change detection | Deep comparison | Deep comparison |
| Persistence | None (server-side) | `Neutralino.storage` |
| Environment vars | `os.environ` | `Neutralino.os.getEnv` |
| Config sync | REST PATCH | REST PATCH |
