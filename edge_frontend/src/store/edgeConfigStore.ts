import { create } from 'zustand';
import { createLogger } from '../utils/logger';
import pythonService from '../services/python-service';
import type { EdgeData, MCPEdgeExecutable } from '../types';
import { EdgeStatus } from '../types';

const log = createLogger('edgeConfigStore');

interface EdgeConfigState {
  config: EdgeData;
  unsubscribe?: () => void;
  
  // Actions
  initialize: () => void;
  cleanup: () => void;
  setConfig: (config: EdgeData) => void;
  saveConfigToBackend: (updates: Partial<EdgeData>) => Promise<void>;
  
  // Computed values
  getWorkspacePaths: () => string[];
  getMCPInstances: () => MCPEdgeExecutable[];
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
};

export const useEdgeConfigStore = create<EdgeConfigState>((set, get) => ({
  config: defaultConfig,
  unsubscribe: undefined,

  initialize: () => {
    const currentUnsubscribe = get().unsubscribe;
    if (currentUnsubscribe) currentUnsubscribe();

    const unsubscribe = pythonService.addEventListener('edge:config_update', (event) => {
      const config = event.payload;
      log.info('Edge config updated:', config);
      set({ config });
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

  getWorkspacePaths: () => get().config.workspacepaths || [],

  getMCPInstances: () => {
    const { installedMCPs = {}, mcp_json = {} } = get().config;
    const mcpServers = mcp_json.mcpServers || {};
    
    return Object.values(installedMCPs).map(instance => {
      if (instance.serverId === 'todoforai') {
        return {
          ...instance,
          id: instance.id || 'todoforai-builtin',
          command: 'builtin',
          args: [],
          env: instance.env || {},
        };
      }
      
      const mcpConfig = mcpServers[instance.serverId];
      return {
        ...instance,
        command: mcpConfig?.command || instance.command || 'node',
        args: mcpConfig?.args || instance.args || [],
        env: { ...(instance.env || {}), ...(mcpConfig?.env || {}) },
      };
    });
  },
}));

// Initialize the store when this module is imported
useEdgeConfigStore.getState().initialize();
