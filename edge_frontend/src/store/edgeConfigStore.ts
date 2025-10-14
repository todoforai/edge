import { create } from 'zustand';
import { createLogger } from '@/utils/logger';
import pythonService from '../services/python-service';
import type { EdgeData, MCPEdgeExecutable } from '../types';
import { EdgeStatus } from '../types';

const log = createLogger('edgeConfigStore');

interface EdgeConfigState {
  config: EdgeData;
  unsubscribe?: () => void;
  installingServerIds: Record<string, true>;
  
  // Actions
  initialize: () => void;
  cleanup: () => void;
  setConfig: (config: EdgeData) => void;
  saveConfigToBackend: (updates: Partial<EdgeData>) => Promise<void>;
  beginInstall: (serverId: string) => void;
  endInstall: (serverId: string) => void;
  
  // Computed values
  getWorkspacePaths: () => string[];
  getMCPInstances: (config: EdgeData) => MCPEdgeExecutable[];
}

// Default empty config
const defaultConfig: EdgeData = {
  id: '',
  name: 'Unknown Edge',
  workspacepaths: [],
  ownerId: '',
  status: EdgeStatus.OFFLINE,
  isShellEnabled: false,
  isFileSystemEnabled: false,
  createdAt: 0,
  installedMCPs: {},
  mcp_json: {},
  mcp_config_path: undefined,
};

export const useEdgeConfigStore = create<EdgeConfigState>((set, get) => ({
  config: defaultConfig,
  unsubscribe: undefined,
  installingServerIds: {},

  initialize: () => {
    const currentUnsubscribe = get().unsubscribe;
    if (currentUnsubscribe) currentUnsubscribe();

    const unsubscribe = pythonService.addEventListener('edge:config_update', (event) => {
      const config = event.payload;
      log.info('Edge config updated:', config);
      set({ config });
      // Clear installing flags for servers now present in mcp_json
      const installed = new Set(Object.keys(config?.mcp_json?.mcpServers || {}));
      const installing = get().installingServerIds;
      const remaining: Record<string, true> = {};
      for (const sid of Object.keys(installing)) {
        if (!installed.has(sid)) remaining[sid] = true;
      }
      if (Object.keys(remaining).length !== Object.keys(installing).length) {
        set({ installingServerIds: remaining });
      }
    });

    set({ unsubscribe });
    log.info('Edge config store initialized');
  },

  cleanup: () => {
    const unsubscribe = get().unsubscribe;
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: undefined });
    }
    log.info('Edge config store cleaned up');
  },

  setConfig: (config: EdgeData) => set({ config }),

  saveConfigToBackend: async (updates: Partial<EdgeData>) => {
    try {
      // Update local config first
      const currentConfig = get().config;
      const updatedConfig = { ...currentConfig, ...updates };
      set({ config: updatedConfig });

      await pythonService.callPython('update_edge_config', updates);
      log.info('Edge config saved to backend:', updates);
    } catch (error) {
      log.error('Failed to save config to backend:', error);
      throw error;
    }
  },

  beginInstall: (serverId) => set(state => ({ installingServerIds: { ...state.installingServerIds, [serverId]: true } })),
  endInstall: (serverId) => set(state => {
    const { [serverId]: _removed, ...rest } = state.installingServerIds;
    return { installingServerIds: rest };
  }),

  getWorkspacePaths: () => get().config.workspacepaths || [],

  getMCPInstances: (config) => {
    const { installedMCPs = {}, mcp_json = {} } = config || {};
    const mcpServers = mcp_json.mcpServers || {};
    
    const base = Object.entries(installedMCPs).map(([serverId, instance]) => {
      if (serverId === 'todoforai') {
        return {
          ...instance,
          id: instance.id || 'todoforai-builtin',
          serverId,
          command: 'builtin',
          args: [],
          env: instance.env || {},
        } as MCPEdgeExecutable;
      }
      
      const mcpConfig = mcpServers[serverId];
      return {
        ...instance,
        id: instance.id || serverId,
        serverId,
        command: mcpConfig?.command || instance.command || 'node',
        args: mcpConfig?.args || instance.args || [],
        env: { ...(instance.env || {}), ...(mcpConfig?.env || {}) },
      } as MCPEdgeExecutable;
    });

    const installing = get().installingServerIds;
    return base.map(i => ({ ...i, installing: !!installing[i.serverId] }));
  },
}));

// Initialize the store when this module is imported
useEdgeConfigStore.getState().initialize();
