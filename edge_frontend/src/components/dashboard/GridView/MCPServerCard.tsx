import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Terminal, Settings, MoreVertical, ShieldCheck, Trash2 } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../types';
import { getMCPByCommandArgs } from '../../../data/mcpServersData';

const ServerCard = styled.div`
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  border-radius: ${(props) => props.theme.radius.lg};
  padding: 28px;
  background: ${(props) => props.theme.colors.background};
  transition: all 0.2s;

  &:hover {
    border-color: ${(props) => props.theme.colors.primary};
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
  border-radius: ${(props) => props.theme.radius.md};
  background: rgba(59, 130, 246, 0.1);
  overflow: hidden;
  
  img {
    border-radius: ${(props) => props.theme.radius.md};
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
  color: ${(props) => props.theme.colors.foreground};
  margin: 0 0 4px 0;
  word-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
`;

const ServerId = styled.div`
  font-size: 12px;
  color: ${(props) => props.theme.colors.mutedForeground};
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
  color: ${(props) => props.theme.colors.mutedForeground};
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: ${(props) => props.theme.radius.md2};
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
  background: transparent;
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  border-radius: ${(props) => props.theme.radius.md};
  color: ${(props) => props.theme.colors.mutedForeground};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(59, 130, 246, 0.1);
    border-color: ${(props) => props.theme.colors.primary};
    color: ${(props) => props.theme.colors.primary};
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
  background: ${(props) => props.theme.colors.background};
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  border-radius: ${(props) => props.theme.radius.md};
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
  color: ${(props) => props.danger ? '#ef4444' : props.theme.colors.foreground};
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  text-align: left;

  &:hover {
    background: ${(props) => props.danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'};
  }

  &:first-child {
    border-radius: ${(props) => props.theme.radius.md} ${(props) => props.theme.radius.md} 0 0;
  }

  &:last-child {
    border-radius: 0 0 ${(props) => props.theme.radius.md} ${(props) => props.theme.radius.md};
  }

  ${(props) => props.disabled && `
    opacity: 0.5;
    cursor: not-allowed;
    
    &:hover {
      background: transparent;
    }
  `}
`;

const ServerDescription = styled.p`
  font-size: 14px;
  color: ${(props) => props.theme.colors.mutedForeground};
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
  showCategory = true,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isBuiltIn = instance.serverId === 'todoforai';
  const registryServer = getMCPByCommandArgs(instance.command, instance.args);
  
  // All display data comes from registry now
  const displayName = registryServer?.name || instance.serverId || 'Unknown Server';
  const displayDescription = registryServer?.description || 'No description available';
  const displayIcon = registryServer?.icon || '/logos/default.png';
  const displayCategory = registryServer?.category?.[0] || 'Unknown';

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
            </ServerNameAndCategory>
            <ServerId>{instance.serverId}</ServerId>
          </ServerInfo>
          <ServerActions>
            <ActionButtonsRow>
              <ActionButton onClick={() => onViewLogs(instance)} title="View Logs">
                <Terminal size={16} />
              </ActionButton>
              <ActionButton onClick={() => onOpenSettings(instance)} title="Settings">
                <Settings size={16} />
              </ActionButton>
              <DropdownContainer ref={dropdownRef}>
                <ActionButton 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                  title="More options"
                >
                  <MoreVertical size={16} />
                </ActionButton>
                <DropdownMenu isOpen={isDropdownOpen}>
                  <DropdownItem onClick={() => onOpenSettings(instance)}>
                    <Settings size={16} />
                    Configure
                  </DropdownItem>
                  <DropdownItem onClick={() => onViewLogs(instance)}>
                    <Terminal size={16} />
                    View Logs
                  </DropdownItem>
                  <DropdownItem 
                    onClick={handleUninstall}
                    disabled={isBuiltIn}
                    danger={!isBuiltIn}
                  >
                    {isBuiltIn ? <ShieldCheck size={16} /> : <Trash2 size={16} />}
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
