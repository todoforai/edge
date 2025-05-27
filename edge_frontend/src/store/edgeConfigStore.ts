import { create } from 'zustand';
import { createLogger } from '../utils/logger';
import pythonService from '../services/python-service';

const log = createLogger('edgeConfigStore');

interface EdgeConfig {
  id: string;
  name: string;
  workspacepaths: string[];
  ownerId: string;
  status: string;
  isShellEnabled: boolean;
  isFileSystemEnabled: boolean;
  createdAt: string | null;
}

interface EdgeConfigState {
  // The edge configuration
  config: EdgeConfig;

  // Initialize the store and set up event listeners
  initialize: () => void;

  // Clean up event listeners
  cleanup: () => void;

  // Update the entire config
  setConfig: (config: EdgeConfig) => void;

  // Getters for common properties
  getWorkspacePaths: () => string[];
}

// Default empty config
const defaultConfig: EdgeConfig = {
  id: '',
  name: 'Unknown Edge',
  workspacepaths: [],
  ownerId: '',
  status: 'OFFLINE',
  isShellEnabled: false,
  isFileSystemEnabled: false,
  createdAt: null,
};

export const useEdgeConfigStore = create<EdgeConfigState>((set, get) => ({
  config: defaultConfig,

  initialize: () => {
    // Set up event listener for edge config changes
    const unsubscribe = pythonService.addEventListener('edge:config_update', (event) => {
      const config = event.payload;
      log.info('Edge config updated:', config);
      set({ config });
    });

    // Store the unsubscribe function for cleanup
    (get() as any).unsubscribe = unsubscribe;

    log.info('Edge config store initialized');
  },

  cleanup: () => {
    // Clean up event listeners
    const unsubscribe = (get() as any).unsubscribe;
    if (unsubscribe) {
      unsubscribe();
      (get() as any).unsubscribe = undefined;
    }
    log.info('Edge config store cleaned up');
  },

  setConfig: (config: EdgeConfig) => {
    set({ config });
  },

  getWorkspacePaths: () => {
    return get().config.workspacepaths || [];
  },
}));

// Initialize the store when this module is imported
useEdgeConfigStore.getState().initialize();
