import React from 'react';
import { styled } from '../../../../styled-system/jsx';
import { Trash2, Download, CheckCircle, XCircle } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../types';
import { useMCPLogStore } from '../../../store/mcpLogStore';
import { Modal } from '../../ui/Modal';

// New styled components from patch
const LogTypeTag = styled('span', {
  base: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginRight: '8px',
  },
  variants: {
    type: {
      tool_call: {
        background: '#4fc3f7',
        color: '#000',
      },
      log: {
        background: '#81c784',
        color: '#000',
      },
      stdout_error: {
        background: '#ff9800',
        color: '#000',
      },
      notification: {
        background: '#9c27b0',
        color: '#fff',
      },
      request: {
        background: '#607d8b',
        color: '#fff',
      },
    },
  },
});

const LogLevel = styled('span', {
  base: {
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginRight: '8px',
  },
  variants: {
    level: {
      debug: { color: '#888' },
      info: { color: '#4fc3f7' },
      warning: { color: '#ff9800' },
      error: { color: '#ff6b6b' },
      critical: { color: '#d32f2f' },
    },
  },
});

// Existing styled components
const LogsActions = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
});

const ActionButton = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    padding: '0',
    background: 'transparent',
    border: '1px solid token(colors.borderColor)',
    borderRadius: '6px',
    color: 'token(colors.mutedForeground)',
    cursor: 'pointer',
    transition: 'all 0.2s',

    '&:hover': {
      background: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'token(colors.primary)',
      color: 'token(colors.primary)',
    },
  },
});

const LogsContainer = styled('div', {
  base: {
    flex: '1',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
});

const LogsTerminal = styled('div', {
  base: {
    flex: '1',
    overflowY: 'auto',
    background: '#1a1a1a',
    color: '#ffffff',
    fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
    fontSize: '13px',
    lineHeight: '1.4',
    padding: '16px',
    borderRadius: '6px',
    maxHeight: '60vh',
  },
});

const EmptyState = styled('div', {
  base: {
    color: '#888',
    textAlign: 'center',
    padding: '40px',
    fontStyle: 'italic',
  },
});

const LogEntryComponent = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px',
    padding: '8px',
    borderRadius: '4px',
    background: 'rgba(255, 255, 255, 0.02)',

    '&:hover': {
      background: 'rgba(255, 255, 255, 0.05)',
    },
  },
  variants: {
    isError: {
      true: {
        borderLeft: '3px solid #ff6b6b',
      },
      false: {
        borderLeft: '3px solid #4fc3f7',
      },
    },
  },
});

const LogTimestamp = styled('span', {
  base: {
    color: '#888',
    flexShrink: '0',
    fontSize: '12px',
    width: '80px',
  },
});

const LogStatus = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: '600',
    flexShrink: '0',
    fontSize: '12px',
    width: '80px',
  },
  variants: {
    isError: {
      true: {
        color: '#ff6b6b',
      },
      false: {
        color: '#4fc3f7',
      },
    },
  },
});

const LogContent = styled('div', {
  base: {
    flex: '1',
  },
});

const ToolName = styled('div', {
  base: {
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: '4px',
  },
});

const ToolArgs = styled('div', {
  base: {
    color: '#888',
    fontSize: '12px',
    marginBottom: '4px',
    wordBreak: 'break-all',
  },
});

const ToolResult = styled('div', {
  base: {
    fontSize: '12px',
    wordBreak: 'break-all',
  },
  variants: {
    isError: {
      true: {
        color: '#ff6b6b',
      },
      false: {
        color: '#81c784',
      },
    },
  },
});

interface MCPServerLogsModalProps {
  instance: MCPEdgeExecutable;
  onClose: () => void;
}

export const MCPServerLogsModal: React.FC<MCPServerLogsModalProps> = ({
  instance,
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
        <LogEntryComponent key={log.id} isError={!log.success}>
          <LogTimestamp>{log.timestamp.toLocaleTimeString()}</LogTimestamp>
          <LogStatus isError={!log.success}>
            {log.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {log.success ? 'SUCCESS' : 'ERROR'}
          </LogStatus>
          <LogContent>
            <ToolName>
              <LogTypeTag type="tool_call">TOOL</LogTypeTag>
              {log.toolName}
            </ToolName>
            <ToolArgs>
              Args: {JSON.stringify(log.arguments)}
            </ToolArgs>
            <ToolResult isError={!log.success}>
              {log.success ? `Result: ${log.result}` : `Error: ${log.error}`}
            </ToolResult>
          </LogContent>
        </LogEntryComponent>
      );
    } else {
      return (
        <LogEntryComponent key={log.id} isError={log.level === 'error' || log.level === 'critical'}>
          <LogTimestamp>{log.timestamp.toLocaleTimeString()}</LogTimestamp>
          <LogStatus isError={log.level === 'error' || log.level === 'critical'}>
            <LogTypeTag type={log.type}>{log.type}</LogTypeTag>
            {log.level && <LogLevel level={log.level}>{log.level}</LogLevel>}
          </LogStatus>
          <LogContent>
            <ToolName>{log.logger}</ToolName>
            <ToolResult isError={log.level === 'error' || log.level === 'critical'}>
              {log.message}
            </ToolResult>
            {log.extra && (
              <ToolArgs>
                Extra: {JSON.stringify(log.extra)}
              </ToolArgs>
            )}
          </LogContent>
        </LogEntryComponent>
      );
    }
  };

  return (
    <Modal title={`All Logs - ${instance.serverId || instance.id} (${sortedLogs.length} entries)`} onClose={onClose}>
      <LogsActions>
        <ActionButton title="Clear Logs" onClick={clearServerLogs}>
          <Trash2 size={16} />
        </ActionButton>
        <ActionButton title="Download Logs" onClick={downloadLogs}>
          <Download size={16} />
        </ActionButton>
      </LogsActions>

      <LogsContainer>
        <LogsTerminal>
          {sortedLogs.length === 0 ? (
            <EmptyState>
              No logs yet for this server
              <br />
              <small style={{ color: '#666', fontSize: '11px' }}>
                Looking for logs with server IDs: {possibleServerIds.join(', ')}
              </small>
            </EmptyState>
          ) : (
            sortedLogs.map(renderLogEntry)
          )}
        </LogsTerminal>
      </LogsContainer>
    </Modal>
  );
};