import React from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import { MCPServer } from './types/MCPServer';

interface MCPServerLogsModalProps {
  server: MCPServer;
  onClose: () => void;
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;
}

// Mock log data - in real implementation this would come from the server
const getMockLogs = (serverId: string): LogEntry[] => [
  { timestamp: '2024-01-15 10:30:15', level: 'INFO', message: `Starting MCP server ${serverId}...` },
  { timestamp: '2024-01-15 10:30:16', level: 'INFO', message: 'Initializing connection handlers' },
  { timestamp: '2024-01-15 10:30:17', level: 'DEBUG', message: 'Loading configuration from environment' },
  { timestamp: '2024-01-15 10:30:18', level: 'INFO', message: 'Server listening on stdio' },
  { timestamp: '2024-01-15 10:30:20', level: 'INFO', message: 'Client connected successfully' },
  { timestamp: '2024-01-15 10:30:25', level: 'DEBUG', message: 'Processing tools/list request' },
  { timestamp: '2024-01-15 10:30:26', level: 'INFO', message: 'Returned 5 available tools' },
  { timestamp: '2024-01-15 10:31:10', level: 'WARN', message: 'Rate limit approaching for API calls' },
  { timestamp: '2024-01-15 10:31:15', level: 'ERROR', message: 'Failed to authenticate with external service' },
  { timestamp: '2024-01-15 10:31:16', level: 'INFO', message: 'Retrying authentication...' },
  { timestamp: '2024-01-15 10:31:18', level: 'INFO', message: 'Authentication successful' },
];

export const MCPServerLogsModal: React.FC<MCPServerLogsModalProps> = ({
  server,
  onClose
}) => {
  const logs = getMockLogs(server.id);

  return (
    <ModalOverlay onClick={onClose}>
      <LogsModal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Logs - {server.name}</ModalTitle>
          <LogsActions>
            <ActionButton title="Clear Logs">
              <Icon icon="lucide:trash-2" width={16} height={16} />
            </ActionButton>
            <ActionButton title="Download Logs">
              <Icon icon="lucide:download" width={16} height={16} />
            </ActionButton>
            <CloseButton onClick={onClose}>
              <Icon icon="lucide:x" />
            </CloseButton>
          </LogsActions>
        </ModalHeader>

        <LogsContainer>
          <LogsTerminal>
            {logs.map((log, index) => (
              <LogEntryComponent key={index} $level={log.level}>
                <LogTimestamp>{log.timestamp}</LogTimestamp>
                <LogLevel $level={log.level}>{log.level}</LogLevel>
                <LogMessage>{log.message}</LogMessage>
              </LogEntryComponent>
            ))}
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

const LogEntryComponent = styled.div<{ $level: LogEntry['level'] }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 4px;
  padding: 2px 0;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
`;

const LogTimestamp = styled.span`
  color: #888;
  flex-shrink: 0;
  font-size: 12px;
`;

const LogLevel = styled.span<{ $level: LogEntry['level'] }>`
  color: ${props => {
    switch (props.$level) {
      case 'ERROR': return '#ff6b6b';
      case 'WARN': return '#ffa726';
      case 'INFO': return '#4fc3f7';
      case 'DEBUG': return '#81c784';
      default: return '#ffffff';
    }
  }};
  font-weight: 600;
  flex-shrink: 0;
  width: 50px;
  font-size: 12px;
`;

const LogMessage = styled.span`
  color: #ffffff;
  flex: 1;
`;