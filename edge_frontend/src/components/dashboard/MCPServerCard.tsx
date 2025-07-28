import React from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import type { MCPServer } from '../../shared/REST_types_shared';
import { MCPRunningStatus } from '../../shared/REST_types_shared';

const ServerCard = styled.div`
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: ${props => props.theme.radius.lg};
  padding: 28px;
  background: ${props => props.theme.colors.background};
  transition: all 0.2s;

  &:hover {
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const ServerHeader = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
`;

const ServerIcon = styled.div`
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${props => props.theme.radius.md};
  background: rgba(59, 130, 246, 0.1);
`;
const ServerTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
`;

const ServerName = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0;
  flex: 1;
  min-width: 0;
`;

const ServerCategory = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.mutedForeground};
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: ${props => props.theme.radius.md2};
  display: inline-block;
  flex-shrink: 0;
`;

const ServerActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;
const ActionButton = styled.button`
  display: flex;
  align-items: center;  
  justify-content: center;
  width: 44px;
  height: 44px;
  background: transparent;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: ${props => props.theme.radius.md};
  color: ${props => props.theme.colors.mutedForeground};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(59, 130, 246, 0.1);
    border-color: ${props => props.theme.colors.primary};
    color: ${props => props.theme.colors.primary};
  }
`;

const StatusDropdown = styled.div`
  position: relative;
`;

const StatusSelect = styled.select<{ $status: MCPRunningStatus }>`
  appearance: none;
  background: ${props => {
    switch (props.$status) {
      case MCPRunningStatus.RUNNING: return '#4CAF50';
      case MCPRunningStatus.INSTALLED: return '#2196F3';
      case MCPRunningStatus.STOPPED: return '#FF9800';
      case MCPRunningStatus.UNINSTALLED: return '#9E9E9E';
      default: return '#9E9E9E';
    }
  }};
  color: white;
  border: none;
  border-radius: ${props => props.theme.radius.sm};
  padding: 12px 24px 12px 12px;
  font-size: 18px;
  font-weight: 500;
  cursor: pointer;
  min-width: 90px;
  text-align: center;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 6px center;
  background-repeat: no-repeat;
  background-size: 12px;

  &:focus {
    outline: 2px solid rgba(255, 255, 255, 0.3);
    outline-offset: 1px;
  }

  option {
    background: ${props => props.theme.colors.background};
    color: ${props => props.theme.colors.foreground};
  }
`;


const ServerDescription = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.mutedForeground};
  line-height: 1.5;
  margin: 0;
`;

interface MCPServerCardProps {
  server: MCPServer;
  onStatusChange: (serverId: string, newStatus: MCPRunningStatus) => void;
  onViewLogs: (server: MCPServer) => void;
  onOpenSettings: (server: MCPServer) => void;
  showCategory?: boolean;
}

export const MCPServerCard: React.FC<MCPServerCardProps> = ({
  server,
  onStatusChange,
  onViewLogs,
  onOpenSettings,
  showCategory = false
}) => {
  return (
    <ServerCard>
      <ServerHeader>
        <ServerIcon>
          <Icon icon={server.icon} width={24} height={24} />
        </ServerIcon>
        <ServerTitleRow>
          <ServerName>{server.name}</ServerName>
          {showCategory && <ServerCategory>{server.category}</ServerCategory>}
          <ServerActions>
            <ActionButton onClick={() => onViewLogs(server)} title="View Logs">
              <Icon icon="lucide:terminal" width={16} height={16} />
            </ActionButton>
            <ActionButton onClick={() => onOpenSettings(server)} title="Settings">
              <Icon icon="lucide:settings" width={16} height={16} />
            </ActionButton>
            <StatusDropdown>
              <StatusSelect
                value={server.status}
                onChange={(e) => onStatusChange(server.id, e.target.value as MCPRunningStatus)}
                $status={server.status}
              >
                <option value={MCPRunningStatus.UNINSTALLED}>Uninstalled</option>
                <option value={MCPRunningStatus.INSTALLED}>Installed</option>
                <option value={MCPRunningStatus.RUNNING}>Running</option>
                <option value={MCPRunningStatus.STOPPED}>Stopped</option>
              </StatusSelect>
            </StatusDropdown>
          </ServerActions>
        </ServerTitleRow>
      </ServerHeader>
      <ServerDescription>{server.description}</ServerDescription>
    </ServerCard>
  );
};
