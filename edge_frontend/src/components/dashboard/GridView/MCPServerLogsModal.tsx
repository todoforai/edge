import React from 'react';
import { styled } from '../../../../styled-system/jsx';
import { Trash2, Download, CheckCircle, XCircle } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../types';
import { useMCPLogStore } from '../../../store/mcpLogStore';
import { Modal } from '../../ui/Modal';

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
  const logs = getLogsForServer(instance.serverId || instance.id || '');

  const clearServerLogs = () => {
    clearLogs(instance.serverId || instance.id || '');
  };

  const downloadLogs = () => {
    const logText = logs.map(log => {
      const status = log.success ? 'SUCCESS' : 'ERROR';
      const result = log.success ? log.result : log.error;
      return `${log.timestamp.toISOString()} [${status}] Tool: ${log.toolName}
Arguments: ${JSON.stringify(log.arguments, null, 2)}
Result: ${result}
---`;
    }).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-${instance.serverId || instance.id || 'unknown'}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title={`Tool Call Logs - ${instance.serverId}`} onClose={onClose}>
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
          {logs.length === 0 ? (
            <EmptyState>No tool calls yet for this server</EmptyState>
          ) : (
            logs.map((log) => (
              <LogEntryComponent key={log.id} isError={!log.success}>
                <LogTimestamp>{log.timestamp.toLocaleTimeString()}</LogTimestamp>
                <LogStatus isError={!log.success}>
                  {log.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {log.success ? 'SUCCESS' : 'ERROR'}
                </LogStatus>
                <LogContent>
                  <ToolName>{log.toolName}</ToolName>
                  <ToolArgs>
                    Args: {JSON.stringify(log.arguments)}
                  </ToolArgs>
                  <ToolResult isError={!log.success}>
                    {log.success ? `Result: ${log.result}` : `Error: ${log.error}`}
                  </ToolResult>
                </LogContent>
              </LogEntryComponent>
            ))
          )}
        </LogsTerminal>
      </LogsContainer>
    </Modal>
  );
};