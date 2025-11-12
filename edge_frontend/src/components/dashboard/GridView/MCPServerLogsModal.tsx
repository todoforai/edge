import React from 'react';
import { Trash2, Download, CheckCircle, XCircle } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../types';
import { useMCPLogStore } from '../../../store/mcpLogStore';
import { cva } from "class-variance-authority";
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';

const logTypeTag = cva([
  "inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase mr-2"
], {
  variants: {
    type: {
      tool_call: "bg-sky-400 text-black",
      log: "bg-green-400 text-black",
      stdout_error: "bg-orange-500 text-black",
      notification: "bg-purple-600 text-white",
      request: "bg-slate-600 text-white"
    }
  }
});

const logLevel = cva([
  "text-[10px] font-semibold uppercase mr-2"
], {
  variants: {
    level: {
      debug: "text-gray-500",
      info: "text-sky-400",
      warning: "text-orange-500",
      error: "text-red-400",
      critical: "text-red-700"
    }
  }
});

const logsActions = cva([
  "flex items-center gap-2 mb-4"
]);

const logsContainer = cva([
  "flex-1 overflow-hidden flex flex-col"
]);

const logsTerminal = cva([
  "flex-1 overflow-y-auto bg-gray-900 text-white font-mono text-[13px] leading-relaxed p-4 rounded-md max-h-[60vh]"
]);

const emptyState = cva([
  "text-gray-500 text-center p-10 italic"
]);

const logEntry = cva([
  "flex items-start gap-3 mb-3 p-2 rounded bg-white/5 hover:bg-white/10"
], {
  variants: {
    isError: {
      true: "border-l-4 border-red-400",
      false: "border-l-4 border-sky-400"
    }
  }
});

const logTimestamp = cva([
  "text-gray-500 flex-shrink-0 text-xs w-20"
]);

const logStatus = cva([
  "flex items-center gap-1 font-semibold flex-shrink-0 text-xs w-20"
], {
  variants: {
    isError: {
      true: "text-red-400",
      false: "text-sky-400"
    }
  }
});

const logContent = cva([
  "flex-1"
]);

const toolName = cva([
  "text-white font-semibold mb-1"
]);

const toolArgs = cva([
  "text-gray-500 text-xs mb-1 break-all"
]);

const toolResult = cva([
  "text-xs break-all"
], {
  variants: {
    isError: {
      true: "text-red-400",
      false: "text-green-400"
    }
  }
});

interface MCPServerLogsModalProps {
  instance: MCPEdgeExecutable;
  isOpen: boolean;
  onClose: () => void;
}

export const MCPServerLogsModal: React.FC<MCPServerLogsModalProps> = ({
  instance,
  isOpen,
  onClose
}) => {
  const { getLogsForServer, clearLogs } = useMCPLogStore();

  // Try multiple possible server ID variations to match logs
  const possibleServerIds = [
    instance.serverId,
    instance.id,
    (instance as any).registryId,
    // Also try with underscores converted to hyphens and vice versa
    instance.serverId?.replace('_', '-'),
    instance.serverId?.replace('-', '_'),
    instance.id?.replace('_', '-'),
    instance.id?.replace('-', '_'),
  ].filter(Boolean) as string[];

  // Get logs for any of the possible server IDs
  const logs = possibleServerIds.reduce((allLogs, serverId) => {
    const serverLogs = getLogsForServer(serverId);
    return [...allLogs, ...serverLogs];
  }, [] as any[]); // MCPLogEntry[] assumed

  // Remove duplicates based on log ID
  const uniqueLogs = logs.filter((log, index, arr) =>
    arr.findIndex(l => l.id === log.id) === index
  );

  // Sort by timestamp (newest first)
  const sortedLogs = uniqueLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const clearServerLogs = () => {
    // Clear logs for all possible server IDs
    possibleServerIds.forEach(serverId => clearLogs(serverId));
  };

  const downloadLogs = () => {
    const logText = sortedLogs.map(log => {
      if (log.type === 'tool_call') {
        const status = log.success ? 'SUCCESS' : 'ERROR';
        const result = log.success ? log.result : log.error;
        return `${log.timestamp.toISOString()} [TOOL_CALL-${status}] ${log.toolName}
Arguments: ${JSON.stringify(log.arguments, null, 2)}
Result: ${result}
---`;
      } else {
        return `${log.timestamp.toISOString()} [${log.type?.toUpperCase()}-${log.level?.toUpperCase()}] ${log.logger}
Message: ${log.message}
${log.extra ? `Extra: ${JSON.stringify(log.extra, null, 2)}` : ''}
---`;
      }
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-${instance.serverId || instance.id || 'unknown'}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderLogEntry = (log: any) => {
    if (log.type === 'tool_call') {
      return (
        <div key={log.id} className={logEntry({ isError: !log.success })}>
          <span className={logTimestamp()}>{log.timestamp.toLocaleTimeString()}</span>
          <div className={logStatus({ isError: !log.success })}>
            {log.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {log.success ? 'SUCCESS' : 'ERROR'}
          </div>
          <div className={logContent()}>
            <div className={toolName()}>
              <span className={logTypeTag({ type: "tool_call" })}>TOOL</span>
              {log.toolName}
            </div>
            <div className={toolArgs()}>
              Args: {JSON.stringify(log.arguments)}
            </div>
            <div className={toolResult({ isError: !log.success })}>
              {log.success ? `Result: ${log.result}` : `Error: ${log.error}`}
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div key={log.id} className={logEntry({ isError: log.level === 'error' || log.level === 'critical' })}>
          <span className={logTimestamp()}>{log.timestamp.toLocaleTimeString()}</span>
          <div className={logStatus({ isError: log.level === 'error' || log.level === 'critical' })}>
            <span className={logTypeTag({ type: log.type })}>{log.type}</span>
            {log.level && <span className={logLevel({ level: log.level })}>{log.level}</span>}
          </div>
          <div className={logContent()}>
            <div className={toolName()}>{log.logger}</div>
            <div className={toolResult({ isError: log.level === 'error' || log.level === 'critical' })}>
              {log.message}
            </div>
            {log.extra && (
              <div className={toolArgs()}>
                Extra: {JSON.stringify(log.extra)}
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>All Logs - {instance.serverId || instance.id} ({sortedLogs.length} entries)</DialogTitle>
          <DialogDescription>
            View and manage server logs
          </DialogDescription>
        </DialogHeader>

        <div className={logsActions()}>
          <Button variant="outline" size="icon" title="Clear Logs" onClick={clearServerLogs}>
            <Trash2 size={16} />
          </Button>
          <Button variant="outline" size="icon" title="Download Logs" onClick={downloadLogs}>
            <Download size={16} />
          </Button>
        </div>

        <div className={logsContainer()}>
          <div className={logsTerminal()}>
            {sortedLogs.length === 0 ? (
              <div className={emptyState()}>
                No logs yet for this server
                <br />
                <small style={{ color: '#666', fontSize: '11px' }}>
                  Looking for logs with server IDs: {possibleServerIds.join(', ')}
                </small>
              </div>
            ) : (
              sortedLogs.map(renderLogEntry)
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};