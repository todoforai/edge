import React, { useState } from 'react';
import styled from 'styled-components';
import { Download } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Grid } from '../ui/Grid';
import { ActionBar } from './ActionBar';
import { LogoImage } from '../LogoImage';
import { getMCPIcon, getMCPName, getMCPDescription, getMCPCategory } from '../../utils/mcpRegistry';
import type { MCPJSON } from '../../types';

const ExtensionCard = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 28px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: ${props => props.theme.radius.lg};
  background: ${props => props.theme.colors.background};
  transition: border-color 0.2s;

  &:hover {
    border-color: ${props => props.theme.colors.primary};
  }
`;

const ExtensionIcon = styled.div`
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: ${props => props.theme.radius.sm};
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.02);
  
  img {
    border-radius: ${props => props.theme.radius.sm};
  }
`;

const ExtensionInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ExtensionName = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0 0 4px 0;
`;

const ExtensionDescription = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.mutedForeground};
  margin: 0 0 8px 0;
  line-height: 1.4;
`;

const ExtensionCategory = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.primary};
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: ${props => props.theme.radius.md2};
`;

const InstallButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${props => props.theme.radius.sm};
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: ${props => props.theme.colors.primary}dd;
  }
`;

const Controls = styled.div`
  margin-bottom: 24px;
`;

interface ExtensionsModalProps {
  servers: MCPJSON[];
  onClose: () => void;
  onInstall?: (server: MCPJSON) => void;
}

export const ExtensionsModal: React.FC<ExtensionsModalProps> = ({ 
  servers, 
  onClose, 
  onInstall 
}) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = React.useMemo(() => 
    ['All', ...Array.from(new Set(servers.flatMap(s => getMCPCategory(s.serverId) || ['Other'])))], 
    [servers]
  );

  const filteredServers = servers.filter(server => {
    const serverCategories = getMCPCategory(server.serverId) || ['Other'];
    const matchesCategory = selectedCategory === 'All' || serverCategories.includes(selectedCategory);
    const matchesSearch = 
      getMCPName(server.serverId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getMCPDescription(server.serverId).toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInstall = (server: MCPJSON) => {
    onInstall?.(server);
    onClose();
  };

  return (
    <Modal title="Add New Extensions" onClose={onClose}>
      <Controls>
        <ActionBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search available extensions..."
          selectedCategory={selectedCategory}
          categories={categories}
          onCategoryChange={setSelectedCategory}
        />
      </Controls>

      <Grid minWidth="400px" gap="24px">
        {filteredServers.map((server, index) => (
          <ExtensionCard key={server.serverId || `server-${index}`}>
            <ExtensionIcon>
              <LogoImage 
                src={getMCPIcon(server.serverId || '')} 
                alt={getMCPName(server.serverId)}
                size={48}
              />
            </ExtensionIcon>
            <ExtensionInfo>
              <ExtensionName>{getMCPName(server.serverId)}</ExtensionName>
              <ExtensionDescription>{getMCPDescription(server.serverId)}</ExtensionDescription>
              <ExtensionCategory>{getMCPCategory(server.serverId)?.[0] || 'Other'}</ExtensionCategory>
            </ExtensionInfo>
            <InstallButton onClick={() => handleInstall(server)}>
              <Download size={16} />
              Install
            </InstallButton>
          </ExtensionCard>
        ))}
      </Grid>
    </Modal>
  );
};