import { create } from 'zustand';
import { useEffect } from 'react';
import pythonService from '../services/python-service';

export interface MCPLogEntry {
  id: string;
  timestamp: Date;
  serverId: string;
  toolName: string;
  arguments: any;
  result?: string;
  error?: string;
  success: boolean;
}

interface MCPLogStore {
  logs: MCPLogEntry[];
  addLog: (logData: any) => void;
  clearLogs: (serverId?: string) => void;
  getLogsForServer: (serverId: string) => MCPLogEntry[];
  initialize: () => void;
  cleanup: () => void;
}

let unsubscribe: (() => void) | null = null;

export const useMCPLogStore = create<MCPLogStore>((set, get) => ({
  logs: [],

  addLog: (logData) => {
    const newLog: MCPLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      serverId: logData.server_id,
      toolName: logData.call_tool,
      arguments: logData.arguments,
      result: logData.result,
      error: logData.error,
      success: logData.success,
    };

    set((state) => ({
      logs: [...state.logs, newLog],
    }));
  },

  clearLogs: (serverId) => {
    if (serverId) {
      set((state) => ({
        logs: state.logs.filter(log => log.serverId !== serverId),
      }));
    } else {
      set({ logs: [] });
    }
  },

  getLogsForServer: (serverId) => {
    return get().logs.filter(log => log.serverId === serverId);
  },

  initialize: () => {
    if (unsubscribe) return; // Already initialized

    unsubscribe = pythonService.addEventListener('mcp_tool_call', (event) => {
      get().addLog(event.payload);
    });
  },

  cleanup: () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  },
}));

export const useMCPLogEffect = () => {
  useEffect(() => {
    // Initialize MCP log store
    useMCPLogStore.getState().initialize();
    
    return () => {
      // Cleanup on unmount
      useMCPLogStore.getState().cleanup();
    };
  }, []);
};