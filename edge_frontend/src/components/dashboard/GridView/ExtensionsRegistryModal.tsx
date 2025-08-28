import React, { useState, useMemo } from 'react';
import styled from '@emotion/styled';
import { Download } from 'lucide-react';
import { getMCPByRegistryID } from '../../../data/mcpServersRegistry';
import type { MCPRegistry } from '../../../types/mcp.types';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ModalCard = styled.div`
  background: var(--background);
  color: var(--foreground);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: min(900px, 90vw);
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
`;

const CloseButton = styled.button`
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--foreground);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;

  &:hover {
    background: var(--background-secondary);
  }
`;

const ModalBody = styled.div`
  padding: 20px;
`;

const Grid = styled.div<{ minWidth?: string; gap?: string }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${(props) => props.minWidth || '400px'}, 1fr));
  gap: ${(props) => props.gap || '20px'};
`;

const Controls = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;

  input,
  select {
    border: 1px solid var(--border-color);
    background: var(--background-secondary);
    color: var(--foreground);
    border-radius: 8px;
    padding: 8px 10px;

    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }
`;

const ExtensionCard = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--background);
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--primary);
  }
`;

const ExtensionIcon = styled.div`
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 1px var(--border-color);

  img {
    border-radius: 8px;
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
  color: var(--foreground);
  margin: 0;
`;

const ExtensionDescription = styled.p`
  font-size: 14px;
  color: var(--muted);
  margin: 0;
  line-height: 1.4;
`;

const ExtensionCategory = styled.span`
  font-size: 12px;
  color: var(--primary);
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: 6px;
  flex-shrink: 0;
`;

const InstallButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    opacity: 0.9;
  }
`;

interface ExtensionsRegistryModalProps {
  servers: MCPRegistry[];
  onClose: () => void;
  onInstall?: (server: MCPRegistry) => void;
}

export const ExtensionsRegistryModal: React.FC<ExtensionsRegistryModalProps> = ({ servers, onClose, onInstall }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          servers.flatMap((s) => {
            const registry = getMCPByRegistryID(s.registryId);
            return registry?.category || ['Other'];
          })
        )
      ),
    ],
    [servers]
  );

  const filteredServers = servers.filter((server) => {
    const registry = getMCPByRegistryID(server.registryId);
    const serverCategories = registry?.category || ['Other'];
    const matchesCategory = selectedCategory === 'All' || serverCategories.includes(selectedCategory);
    const matchesSearch =
      (registry?.name || server.registryId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (registry?.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInstall = (server: MCPRegistry) => {
    onInstall?.(server);
    onClose();
  };

  return (
    <Overlay>
      <ModalCard>
        <ModalHeader>
          <div>Add New Extensions</div>
          <CloseButton onClick={onClose}>Close</CloseButton>
        </ModalHeader>
        <ModalBody>
          <Controls>
            <input placeholder="Search available extensions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Controls>

          <Grid minWidth="400px" gap="24px">
            {filteredServers.map((server, index) => {
              const registry = getMCPByRegistryID(server.registryId);
              const serverId = server.registryId || `server-${index}`;
              return (
                <ExtensionCard key={serverId}>
                  <ExtensionIcon>
                    <img src={registry?.icon || '/logos/default.png'} alt={registry?.name || serverId} width={48} height={48} />
                  </ExtensionIcon>
                  <ExtensionInfo>
                    <ExtensionHeader>
                      <ExtensionName>{registry?.name || server.registryId}</ExtensionName>
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
        </ModalBody>
      </ModalCard>
    </Overlay>
  );
};
