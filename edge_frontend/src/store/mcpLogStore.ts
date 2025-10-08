import { create } from 'zustand';
import { useEffect } from 'react';
import pythonService from '../services/python-service';

export interface MCPLogEntry {
  id: string;
  timestamp: Date;
  serverId: string;
  type: 'tool_call' | 'log' | 'stdout_error' | 'notification' | 'request';
  level?: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  
  // Tool call specific fields
  toolName?: string;
  arguments?: any;
  result?: string;
  error?: string;
  success?: boolean;
  
  // Log specific fields
  logger?: string;
  message?: string;
  extra?: any;
  
  // Message handler specific fields
  notificationType?: string;
  requestType?: string;
  requestId?: string;
  rawException?: string;
}

interface MCPLogStore {
  logs: MCPLogEntry[];
  addLog: (logData: any) => void;
  addToolCallLog: (logData: any) => void;
  addMCPLog: (logData: any) => void;
  clearLogs: (serverId?: string) => void;
  getLogsForServer: (serverId: string) => MCPLogEntry[];
  getLogsByType: (serverId: string, type: string) => MCPLogEntry[];
  initialize: () => void;
  cleanup: () => void;
}

let toolCallUnsubscribe: (() => void) | null = null;
let mcpLogUnsubscribe: (() => void) | null = null;

export const useMCPLogStore = create<MCPLogStore>((set, get) => ({
  logs: [],

  addLog: (logData) => {
    // Legacy method - redirect to appropriate handler
    if (logData.call_tool) {
      get().addToolCallLog(logData);
    } else {
      get().addMCPLog(logData);
    }
  },

  addToolCallLog: (logData) => {
    const newLog: MCPLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      serverId: logData.server_id,
      type: 'tool_call',
      toolName: logData.call_tool,
      arguments: logData.arguments,
      result: logData.result,
      error: logData.error,
      success: logData.success,
    };

    console.log('Adding MCP tool call log:', {
      serverId: newLog.serverId,
      toolName: newLog.toolName,
      success: newLog.success
    });

    set((state) => ({
      logs: [...state.logs, newLog],
    }));
  },

  addMCPLog: (logData) => {
    // Extract server ID - prefer explicit server_id, fallback to logger extraction
    let serverId = logData.server_id;
    if (!serverId && logData.logger) {
      // Extract from logger name (remove mcp. prefix)
      serverId = logData.logger.replace(/^mcp\./, '').replace(/^fastmcp\./, '');
      // Handle common system loggers
      if (['stdout', 'stderr', 'notifications', 'requests'].includes(serverId)) {
        serverId = 'system';
      }
    }
    serverId = serverId || 'unknown';
    
    const newLog: MCPLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      serverId,
      type: logData.type || 'log',
      level: logData.level,
      logger: logData.logger,
      message: logData.message,
      extra: logData.extra,
      notificationType: logData.notification_type,
      requestType: logData.request_type,
      requestId: logData.request_id,
      rawException: logData.raw_exception,
    };

    console.log('Adding MCP system log:', {
      serverId: newLog.serverId,
      type: newLog.type,
      level: newLog.level,
      message: newLog.message?.substring(0, 100)
    });

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
    const logs = get().logs.filter(log => log.serverId === serverId);
    console.log(`Getting logs for server ${serverId}: found ${logs.length} logs`);
    return logs;
  },

  getLogsByType: (serverId, type) => {
    return get().logs.filter(log => log.serverId === serverId && log.type === type);
  },

  initialize: () => {
    if (toolCallUnsubscribe || mcpLogUnsubscribe) return; // Already initialized

    // Subscribe to tool call events
    toolCallUnsubscribe = pythonService.addEventListener('mcp_tool_call', (event) => {
      get().addToolCallLog(event.payload);
    });

    // Subscribe to MCP log events (from MCPLogHandler)
    mcpLogUnsubscribe = pythonService.addEventListener('mcp_log', (event) => {
      get().addMCPLog(event.payload);
    });
  },

  cleanup: () => {
    if (toolCallUnsubscribe) {
      toolCallUnsubscribe();
      toolCallUnsubscribe = null;
    }
    if (mcpLogUnsubscribe) {
      mcpLogUnsubscribe();
      mcpLogUnsubscribe = null;
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