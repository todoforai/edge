import React from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import { MCPRunningStatus, type MCPEdgeExecutable } from '../../shared/REST_types_shared';
import { getMCPByCommandArgs } from '../../utils/mcpRegistry';

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
  margin-bottom: 12px;
  align-items: flex-start;
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
  gap: 12px;
  flex: 1;
  align-items: flex-start;
`;

const ServerName = styled.h3`
  display: flex;
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0;
  flex: 1;
  min-height: 44px;
  align-items: center;
  word-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
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
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
`;

const ActionButtonsRow = styled.div`
  display: flex;
  gap: 8px;
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

const UninstallButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid #ef4444;
  border-radius: ${props => props.theme.radius.sm};
  color: #ef4444;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
  }
`;

const ServerDescription = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.mutedForeground};
  line-height: 1.5;
  margin: 0;
`;

interface MCPServerCardProps {
  instance: MCPEdgeExecutable;
  onUninstall: (instanceId: string) => void;
  onViewLogs: (instance: MCPEdgeExecutable) => void;
  onOpenSettings: (instance: MCPEdgeExecutable) => void;
  showCategory?: boolean;
}

export const MCPServerCard: React.FC<MCPServerCardProps> = ({
  instance,
  onUninstall,
  onViewLogs,
  onOpenSettings,
  showCategory = false
}) => {
  // Get registry data based on command and args
  const registryServer = getMCPByCommandArgs(instance.command, instance.args);
  
  const displayName = registryServer?.name || `${instance.command} ${instance.args?.join(' ') || ''}`;
  const displayDescription = registryServer?.description || 'No description available';
  const displayIcon = registryServer?.icon 
    ? (typeof registryServer.icon === 'string' ? registryServer.icon : registryServer.icon.light || 'lucide:server')
    : 'lucide:server';
  console.log('displayIcon:', displayIcon)

  const displayCategory = registryServer?.category?.[0] || 'Unknown';

  return (
    <ServerCard>
      <ServerHeader>
        <ServerIcon>
          <Icon icon={displayIcon} width={24} height={24} />
        </ServerIcon>
        <ServerTitleRow>
          <ServerName>{displayName}</ServerName>
          {showCategory && <ServerCategory>{displayCategory}</ServerCategory>}
          <ServerActions>
            <ActionButtonsRow>
              <ActionButton onClick={() => onViewLogs(instance)} title="View Logs">
                <Icon icon="lucide:terminal" width={16} height={16} />
              </ActionButton>
              <ActionButton onClick={() => onOpenSettings(instance)} title="Settings">
                <Icon icon="lucide:settings" width={16} height={16} />
              </ActionButton>
            </ActionButtonsRow>
            <UninstallButton onClick={() => onUninstall(instance.serverId)} title="Uninstall">
              <Icon icon="lucide:trash-2" width={14} height={14} />
              Remove
            </UninstallButton>
          </ServerActions>
        </ServerTitleRow>
      </ServerHeader>
      <ServerDescription>{displayDescription}</ServerDescription>
    </ServerCard>
  );
};