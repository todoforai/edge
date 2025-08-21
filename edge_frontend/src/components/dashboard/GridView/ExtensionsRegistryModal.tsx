import React, { useState } from 'react';
import styled from 'styled-components';
import { Download } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Grid } from '../../ui/Grid';
import { ActionBar } from '../ActionBar';
import { getMCPByServerId } from '../../../data/mcpServersData';
import type { MCPJSON } from '../../../types';

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
  
  img {
    border-radius: ${props => props.theme.radius.sm};
  }
`;

const ExtensionInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ExtensionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
`;

const ExtensionName = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0;
`;

const ExtensionDescription = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.mutedForeground};
  margin: 0;
  line-height: 1.4;
`;

const ExtensionCategory = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.primary};
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: ${props => props.theme.radius.md2};
  flex-shrink: 0;
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

interface ExtensionsRegistryModalProps {
  servers: MCPJSON[];
  onClose: () => void;
  onInstall?: (server: MCPJSON) => void;
}

export const ExtensionsRegistryModal: React.FC<ExtensionsRegistryModalProps> = ({ 
  servers, 
  onClose, 
  onInstall 
}) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = React.useMemo(() => 
    ['All', ...Array.from(new Set(servers.flatMap(s => {
      const registry = getMCPByServerId(s.serverId);
      return registry?.category || ['Other'];
    })))], 
    [servers]
  );

  const filteredServers = servers.filter(server => {
    const registry = getMCPByServerId(server.serverId);
    const serverCategories = registry?.category || ['Other'];
    const matchesCategory = selectedCategory === 'All' || serverCategories.includes(selectedCategory);
    const matchesSearch = 
      (registry?.name || server.serverId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (registry?.description || '').toLowerCase().includes(searchTerm.toLowerCase());
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
        {filteredServers.map((server, index) => {
          const registry = getMCPByServerId(server.serverId);
          return (
            <ExtensionCard key={server.serverId || `server-${index}`}>
              <ExtensionIcon>
                <img 
                  src={registry?.icon || '/logos/default.png'} 
                  alt={registry?.name || server.serverId}
                  width={48} height={48}
                />
              </ExtensionIcon>
              <ExtensionInfo>
                <ExtensionHeader>
                  <ExtensionName>{registry?.name || server.serverId}</ExtensionName>
                  <ExtensionCategory>{registry?.category?.[0] || 'Other'}</ExtensionCategory>
                </ExtensionHeader>
                <ExtensionDescription>{registry?.description || 'No description available'}</ExtensionDescription>
              </ExtensionInfo>
              <InstallButton onClick={() => handleInstall(server)}>
                <Download size={16} />
                Install
              </InstallButton>
            </ExtensionCard>
          );
        })}
      </Grid>
    </Modal>
  );
};