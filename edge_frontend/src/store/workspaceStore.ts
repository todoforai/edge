import { create } from 'zustand';
import { createLogger } from '../utils/logger';
import pythonService from '../services/python-service';

const log = createLogger('workspaceStore');

interface WorkspaceState {
  // List of active workspaces that are currently being synced
  activeWorkspaces: string[];
  
  // Initialize the store and set up event listeners
  initialize: () => void;
  
  // Clean up event listeners
  cleanup: () => void;
  
  // Internal actions
  setActiveWorkspaces: (workspaces: string[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeWorkspaces: [],
  
  initialize: () => {
    // Set up event listener for active workspaces changes
    const unsubscribe = pythonService.addEventListener('active_workspaces_change', (event) => {
      const { activeWorkspaces } = event.payload;
      log.info('Active workspaces updated:', activeWorkspaces);
      set({ activeWorkspaces });
    });
    
    // Store the unsubscribe function for cleanup
    (get() as any).unsubscribe = unsubscribe;
    
    log.info('Workspace store initialized');
  },
  
  cleanup: () => {
    // Clean up event listeners
    const unsubscribe = (get() as any).unsubscribe;
    if (unsubscribe) {
      unsubscribe();
      (get() as any).unsubscribe = undefined;
    }
    log.info('Workspace store cleaned up');
  },
  
  setActiveWorkspaces: (workspaces: string[]) => {
    set({ activeWorkspaces: workspaces });
  },
}));

// Initialize the store when this module is imported
useWorkspaceStore.getState().initialize();