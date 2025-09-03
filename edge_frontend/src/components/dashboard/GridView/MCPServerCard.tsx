import React, { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { Terminal, Settings, MoreVertical, ShieldCheck, Trash2 } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../types/mcp.types';
import { getMCPByCommandArgs } from '../../../data/mcpServersRegistry';

const ServerCard = styled.div`
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 28px;
  background: var(--background);
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary);
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
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: rgba(59, 130, 246, 0.1);
  overflow: hidden;
  
  img {
    border-radius: var(--radius-md);
  }
`;

const ServerInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
`;

const ServerName = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 4px 0;
  word-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
`;

const ServerId = styled.div`
  font-size: 12px;
  color: var(--muted);
  font-family: monospace;
  margin-bottom: 8px;
`;

const ServerTitleRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 1;
`;

const ServerNameAndCategory = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
`;

const ServerCategory = styled.span`
  font-size: 12px;
  color: var(--muted);
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: var(--radius-md-2);
  display: inline-block;
  flex-shrink: 0;
`;

const ServerActions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
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
  padding: 0;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 16px;

  &:hover {
    background: rgba(59, 130, 246, 0.1);
    border-color: var(--primary);
    color: var(--primary);
  }
`;

const DropdownContainer = styled.div`
  position: relative;
`;

const DropdownMenu = styled.div<{ isOpen: boolean }>`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  min-width: 160px;
  display: ${(props) => (props.isOpen ? 'block' : 'none')};
`;

const DropdownItem = styled.button<{ disabled?: boolean; danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: ${(props) => (props.danger ? '#ef4444' : 'var(--foreground)')};
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  text-align: left;

  &:hover {
    background: ${(props) => (props.danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)')};
  }

  &:first-child {
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  &:last-child {
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }

  ${(props) =>
    props.disabled &&
    `
    opacity: 0.5;
    cursor: not-allowed;
    
    &:hover {
      background: transparent;
    }
  `}
`;

const ServerDescription = styled.p`
  font-size: 14px;
  color: var(--muted);
  line-height: 1.5;
  margin: 0;
`;

const ServerStatus = styled.div<{ status: string }>`
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${props => {
    switch (props.status) {
      case 'READY':
        return '#10b981';
      case 'CRASHED':
        return '#ef4444';
      case 'INSTALLING':
        return '#3b82f6';
      case 'STARTING':
        return '#f59e0b';
      default:
        return 'var(--muted)';
    }
  }};
  background: ${props => {
    switch (props.status) {
      case 'READY':
        return 'rgba(16, 185, 129, 0.1)';
      case 'CRASHED':
        return 'rgba(239, 68, 68, 0.1)';
      case 'INSTALLING':
        return 'rgba(59, 130, 246, 0.1)';
      case 'STARTING':
        return 'rgba(245, 158, 11, 0.1)';
      default:
        return 'rgba(0, 0, 0, 0.05)';
    }
  }};
`;

const Spinner = styled.div`
  width: 12px;
  height: 12px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
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
  showCategory = true,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isBuiltIn = instance.serverId === 'todoforai';
  const registryServer = getMCPByCommandArgs(instance.command, instance.args);
  
  // Create fallback info if not found in registry
  const fallbackInfo = registryServer
    ? null
    : {
        name: `Custom MCP (${instance.command})`,
        description: `Unknown MCP server: ${instance.command} ${instance.args?.join(' ') || ''}`,
        icon: '/logos/default.svg',
        category: ['Custom'],
      };
  
  // Use registry data or fallback
  const displayInfo = registryServer || fallbackInfo!;
  const displayName = displayInfo.name || instance.serverId || 'Unknown Server';
  const displayDescription = displayInfo.description || 'No description available';
  const displayIcon = displayInfo.icon || '/logos/default.png';
  const displayCategory = displayInfo.category?.[0] || 'Custom';

  // Determine status inline (no helper)
  const status = instance.status || 'READY';

  const handleUninstall = () => {
    if (isBuiltIn) return;
    onUninstall(instance.serverId);
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <ServerCard>
      <ServerHeader>
        <ServerIcon>
          <img 
            src={displayIcon} 
            alt={displayName}
            width={48} height={48}
          />
        </ServerIcon>
        <ServerTitleRow>
          <ServerInfo>
            <ServerNameAndCategory>
              <ServerName>{displayName}</ServerName>
              {showCategory && <ServerCategory>{displayCategory}</ServerCategory>}
              <ServerStatus status={status}>
                {(status === 'INSTALLING' || status === 'STARTING') && <Spinner />}
                {status}
              </ServerStatus>
            </ServerNameAndCategory>
            <ServerId>{instance.serverId}</ServerId>
          </ServerInfo>
          <ServerActions>
            <ActionButtonsRow>
              <ActionButton onClick={() => onViewLogs(instance)} title="View Logs">
                <Terminal size={20} />
              </ActionButton>
              <ActionButton onClick={() => onOpenSettings(instance)} title="Settings">
                <Settings size={20} />
              </ActionButton>
              <DropdownContainer ref={dropdownRef}>
                <ActionButton 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                  title="More options"
                >
                  <MoreVertical size={20} />
                </ActionButton>
                <DropdownMenu isOpen={isDropdownOpen}>
                  <DropdownItem onClick={() => onOpenSettings(instance)}>
                    <Settings size={18} />
                    Configure
                  </DropdownItem>
                  <DropdownItem onClick={() => onViewLogs(instance)}>
                    <Terminal size={18} />
                    View Logs
                  </DropdownItem>
                  <DropdownItem 
                    onClick={handleUninstall}
                    disabled={isBuiltIn}
                    danger={!isBuiltIn}
                  >
                    {isBuiltIn ? <ShieldCheck size={18} /> : <Trash2 size={18} />}
                    {isBuiltIn ? 'Built-in' : 'Remove'}
                  </DropdownItem>
                </DropdownMenu>
              </DropdownContainer>
            </ActionButtonsRow>
          </ServerActions>
        </ServerTitleRow>
      </ServerHeader>
      <ServerDescription>{displayDescription}</ServerDescription>
    </ServerCard>
  );
};
