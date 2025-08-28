import React from 'react';
import styled from '@emotion/styled';
import { Trash2, Download, CheckCircle, XCircle } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../types';
import { useMCPLogStore } from '../../../store/mcpLogStore';
import { Modal } from '../../ui/Modal';

const LogsActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 6px;
  color: ${props => props.theme.colors.mutedForeground};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(59, 130, 246, 0.1);
    border-color: ${props => props.theme.colors.primary};
    color: ${props => props.theme.colors.primary};
  }
`;

const LogsContainer = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const LogsTerminal = styled.div`
  flex: 1;
  overflow-y: auto;
  background: #1a1a1a;
  color: #ffffff;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
  padding: 16px;
  border-radius: 6px;
  max-height: 60vh;
`;

const EmptyState = styled.div`
  color: #888;
  text-align: center;
  padding: 40px;
  font-style: italic;
`;

const LogEntryComponent = styled.div<{ $isError: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid ${props => props.$isError ? '#ff6b6b' : '#4fc3f7'};
  background: rgba(255, 255, 255, 0.02);

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
`;

const LogTimestamp = styled.span`
  color: #888;
  flex-shrink: 0;
  font-size: 12px;
  width: 80px;
`;

const LogStatus = styled.div<{ $isError: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${props => props.$isError ? '#ff6b6b' : '#4fc3f7'};
  font-weight: 600;
  flex-shrink: 0;
  font-size: 12px;
  width: 80px;
`;

const LogContent = styled.div`
  flex: 1;
`;

const ToolName = styled.div`
  color: #ffffff;
  font-weight: 600;
  margin-bottom: 4px;
`;

const ToolArgs = styled.div`
  color: #888;
  font-size: 12px;
  margin-bottom: 4px;
  word-break: break-all;
`;

const ToolResult = styled.div<{ $isError: boolean }>`
  color: ${props => props.$isError ? '#ff6b6b' : '#81c784'};
  font-size: 12px;
  word-break: break-all;
`;

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
              <LogEntryComponent key={log.id} $isError={!log.success}>
                <LogTimestamp>{log.timestamp.toLocaleTimeString()}</LogTimestamp>
                <LogStatus $isError={!log.success}>
                  {log.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {log.success ? 'SUCCESS' : 'ERROR'}
                </LogStatus>
                <LogContent>
                  <ToolName>{log.toolName}</ToolName>
                  <ToolArgs>
                    Args: {JSON.stringify(log.arguments)}
                  </ToolArgs>
                  <ToolResult $isError={!log.success}>
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