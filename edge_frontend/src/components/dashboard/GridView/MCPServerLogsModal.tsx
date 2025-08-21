import React from 'react';
import styled from 'styled-components';
import { X, Trash2, Download, CheckCircle, XCircle } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../types';
import { useMCPLogStore } from '../../../store/mcpLogStore';

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
    <ModalOverlay onClick={onClose}>
      <LogsModal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Tool Call Logs - {instance.serverId}</ModalTitle>
          <LogsActions>
            <ActionButton title="Clear Logs" onClick={clearServerLogs}>
              <Trash2 size={16} />
            </ActionButton>
            <ActionButton title="Download Logs" onClick={downloadLogs}>
              <Download size={16} />
            </ActionButton>
            <CloseButton onClick={onClose}>
              <X size={20} />
            </CloseButton>
          </LogsActions>
        </ModalHeader>

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
      </LogsModal>
    </ModalOverlay>
  );
};

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const LogsModal = styled.div`
  background: ${props => props.theme.colors.background};
  border-radius: 12px;
  width: 90%;
  max-width: 1000px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0;
`;

const LogsActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
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

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: ${props => props.theme.colors.mutedForeground};
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
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