import { create } from 'zustand';
import { createLogger } from '../utils/logger';
import pythonService from '../services/python-service';
import type { EdgeData, EdgeMCP } from '../shared/REST_types_shared';
import { EdgeStatus } from '../shared/REST_types_shared';

const log = createLogger('edgeConfigStore');

interface EdgeConfigState {
  // The edge configuration
  config: EdgeData;
  
  // Store the unsubscribe function properly
  unsubscribe?: () => void;

  // Initialize the store and set up event listeners
  initialize: () => void;

  // Clean up event listeners
  cleanup: () => void;

  // Update the entire config
  setConfig: (config: EdgeData) => void;

  // Getters for common properties
  getWorkspacePaths: () => string[];
  
  // Get MCP servers from the new structure
  getMCPServers: () => EdgeMCP[];
}

// Default empty config
const defaultConfig: EdgeData = {
  edgeId: '',
  name: 'Unknown Edge',
  workspacepaths: [],
  ownerId: '',
  status: EdgeStatus.OFFLINE,
  isShellEnabled: false,
  isFileSystemEnabled: false,
  createdAt: 0,
  MCPs: [],
};

export const useEdgeConfigStore = create<EdgeConfigState>((set, get) => ({
  config: defaultConfig,
  unsubscribe: undefined,

  initialize: () => {
    // Clean up any existing listener first
    const currentUnsubscribe = get().unsubscribe;
    if (currentUnsubscribe) {
      currentUnsubscribe();
    }

    // Set up event listener for edge config changes
    const unsubscribe = pythonService.addEventListener('edge:config_update', (event) => {
      const config = event.payload;
      log.info('Edge config updated:', config);
      set({ config });
    });

    // Store the unsubscribe function properly
    set({ unsubscribe });

    log.info('Edge config store initialized');
  },

  cleanup: () => {
    // Clean up event listeners
    const unsubscribe = get().unsubscribe;
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: undefined });
    }
    log.info('Edge config store cleaned up');
  },

  setConfig: (config: EdgeData) => {
    set({ config });
  },

  getWorkspacePaths: () => {
    return get().config.workspacepaths || [];
  },

  getMCPServers: () => {
    const mcps = get().config.MCPs || [];
    console.log('Edge MCPs:', mcps);
    return mcps;
  },
}));

// Initialize the store when this module is imported
useEdgeConfigStore.getState().initialize();
