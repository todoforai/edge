/**
 * Configuration Management for TODOforAI Edge
 *
 * Implements observable configuration pattern with server sync.
 */

import { EdgeConfigData, MCPServerStatus, MCPTool } from './types/protocol';

// ============================================================================
// Observable Implementation
// ============================================================================

type Subscriber<T> = (value: T, changes?: Partial<T>) => void;
type AsyncSubscriber<T> = (value: T, changes?: Partial<T>) => Promise<void>;
type Unsubscribe = () => void;

export class Observable<T extends object> {
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

  /**
   * Get a specific property safely
   */
  get<K extends keyof T>(key: K): T[K] {
    return this.value[key];
  }

  /**
   * Subscribe to changes (sync callback)
   */
  subscribe(callback: Subscriber<T>): Unsubscribe {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Subscribe to changes (async callback)
   */
  subscribeAsync(callback: AsyncSubscriber<T>): Unsubscribe {
    this.asyncSubscribers.add(callback);
    return () => this.asyncSubscribers.delete(callback);
  }

  /**
   * Set the entire value
   */
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

  /**
   * Update specific properties
   */
  updateValue(partial: Partial<T>, notify: boolean = true): void {
    const newValue = { ...this.value, ...partial };
    this.setValue(newValue, notify);
  }

  /**
   * Compare old and new values to find changes
   */
  private getChanges(oldValue: T, newValue: T): Partial<T> | null {
    const changes: Partial<T> = {};
    const allKeys = new Set([
      ...Object.keys(oldValue),
      ...Object.keys(newValue)
    ]) as Set<keyof T>;

    for (const key of allKeys) {
      if (!this.deepEqual(oldValue[key], newValue[key])) {
        changes[key] = newValue[key];
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => this.deepEqual(val, b[i]));
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b as object);

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

  /**
   * Notify all subscribers (debounced)
   */
  private notifySubscribers(changes: Partial<T>): void {
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

// ============================================================================
// Edge Config Implementation
// ============================================================================

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

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): string {
    return this.config.get('id');
  }

  get name(): string {
    return this.config.get('name');
  }

  get workspacePaths(): string[] {
    return this.config.get('workspacepaths');
  }

  get installedMCPs(): Record<string, MCPServerStatus> {
    return this.config.get('installedMCPs');
  }

  get status(): EdgeConfigData['status'] {
    return this.config.get('status');
  }

  get isShellEnabled(): boolean {
    return this.config.get('isShellEnabled');
  }

  get isFileSystemEnabled(): boolean {
    return this.config.get('isFileSystemEnabled');
  }

  // ============================================================================
  // Workspace Management
  // ============================================================================

  addWorkspacePath(path: string): boolean {
    const current = this.config.get('workspacepaths');

    if (current.includes(path)) {
      return false;
    }

    this.config.updateValue({
      workspacepaths: [...current, path]
    });

    return true;
  }

  removeWorkspacePath(path: string): boolean {
    const current = this.config.get('workspacepaths');
    const index = current.indexOf(path);

    if (index === -1) {
      return false;
    }

    this.config.updateValue({
      workspacepaths: current.filter(p => p !== path)
    });

    return true;
  }

  setWorkspacePaths(paths: string[]): void {
    this.config.updateValue({ workspacepaths: paths });
  }

  // ============================================================================
  // MCP Management
  // ============================================================================

  setMCPJson(mcpJson: Record<string, unknown>): void {
    this.config.updateValue({ mcp_json: mcpJson });
  }

  setMCPConfigPath(path: string): void {
    this.config.updateValue({ mcp_config_path: path });
  }

  updateInstalledMCP(serverId: string, data: Partial<MCPServerStatus>): void {
    const current = this.config.get('installedMCPs');

    this.config.updateValue({
      installedMCPs: {
        ...current,
        [serverId]: {
          serverId,
          status: 'STARTING',
          tools: [],
          env: {},
          ...current[serverId],
          ...data
        }
      }
    });
  }

  setMCPStatus(serverId: string, status: MCPServerStatus['status']): void {
    this.updateInstalledMCP(serverId, { status });
  }

  setMCPTools(serverId: string, tools: MCPTool[]): void {
    this.updateInstalledMCP(serverId, { tools, status: 'READY' });
  }

  removeInstalledMCP(serverId: string): void {
    const current = { ...this.config.get('installedMCPs') };
    delete current[serverId];

    this.config.updateValue({ installedMCPs: current });
  }

  // ============================================================================
  // Status Management
  // ============================================================================

  setStatus(status: EdgeConfigData['status']): void {
    this.config.updateValue({ status });
  }

  setName(name: string): void {
    this.config.updateValue({ name });
  }

  // ============================================================================
  // Subscriptions
  // ============================================================================

  onChange(callback: (changes: Partial<EdgeConfigData>) => void): Unsubscribe {
    return this.config.subscribe((_, changes) => {
      if (changes) callback(changes);
    });
  }

  onChangeAsync(
    callback: (changes: Partial<EdgeConfigData>) => Promise<void>
  ): Unsubscribe {
    return this.config.subscribeAsync(async (_, changes) => {
      if (changes) await callback(changes);
    });
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  update(data: Partial<EdgeConfigData>, notify: boolean = true): void {
    this.config.updateValue(data, notify);
  }

  getAll(): EdgeConfigData {
    return this.config.getValue();
  }

  toJSON(): EdgeConfigData {
    return this.getAll();
  }
}

// ============================================================================
// Config Sync with Server
// ============================================================================

const SYNCABLE_FIELDS: (keyof EdgeConfigData)[] = [
  'workspacepaths',
  'installedMCPs',
  'name',
  'isShellEnabled',
  'isFileSystemEnabled'
];

export class ConfigSync {
  private unsubscribe: Unsubscribe | null = null;
  private syncInProgress = false;

  constructor(
    private edgeConfig: EdgeConfig,
    private apiUrl: string,
    private apiKey: string
  ) {}

  start(): void {
    if (this.unsubscribe) return;

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
    // Prevent concurrent syncs
    if (this.syncInProgress) return;

    // Filter to only syncable fields
    const syncData: Partial<EdgeConfigData> = {};
    let hasSyncableChanges = false;

    for (const key of SYNCABLE_FIELDS) {
      if (key in changes) {
        (syncData as Record<string, unknown>)[key] = changes[key];
        hasSyncableChanges = true;
      }
    }

    if (!hasSyncableChanges) return;

    const edgeId = this.edgeConfig.id;
    if (!edgeId) {
      console.warn('Cannot sync config: no edge ID');
      return;
    }

    this.syncInProgress = true;

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
      } else {
        console.debug('Config synced successfully');
      }
    } catch (error) {
      console.error('Config sync error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }
}

// ============================================================================
// Persistent Storage
// ============================================================================

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
