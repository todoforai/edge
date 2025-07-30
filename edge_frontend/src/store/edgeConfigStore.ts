import { create } from 'zustand';
import { createLogger } from '../utils/logger';
import pythonService from '../services/python-service';
import type { EdgeData, MCPEdgeExecutable } from '../shared/REST_types_shared';
import { EdgeStatus, MCPRunningStatus } from '../shared/REST_types_shared';

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

  // Add new method to save config to backend
  saveConfigToBackend: (updates: Partial<EdgeData>) => Promise<void>;

  // Getters for common properties
  getWorkspacePaths: () => string[];
  
  // Get MCP instances from the new structure
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
  installedMCPs: {}, // Changed from MCPinstances array to installedMCPs Record
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

  saveConfigToBackend: async (updates: Partial<EdgeData>) => {
    try {
      // Update local config first
      const currentConfig = get().config;
      const updatedConfig = { ...currentConfig, ...updates };
      set({ config: updatedConfig });

      // Send update to backend via python service
      await pythonService.callRPC('update_edge_config', updates);
      
      log.info('Edge config saved to backend:', updates);
    } catch (error) {
      log.error('Failed to save config to backend:', error);
      throw error;
    }
  },

  getWorkspacePaths: () => {
    return get().config.workspacepaths || [];
  },

  getMCPInstances: () => {
    const installedMCPs = get().config.installedMCPs || {}; // Changed from MCPinstances
    console.log('Edge Installed MCPs:', installedMCPs);
    
    // Convert Record<string, InstalledMCP> to MCPEdgeExecutable[]
    const executableInstances: MCPEdgeExecutable[] = Object.values(installedMCPs).map(instance => ({
      ...instance,
      status: MCPRunningStatus.STOPPED // Default status for instances from config
    }));
    
    return executableInstances;
  },
}));

// Initialize the store when this module is imported
useEdgeConfigStore.getState().initialize();
