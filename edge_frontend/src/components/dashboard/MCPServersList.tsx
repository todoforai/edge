import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import type { MCPServer } from './types/MCPServer';
import { FAKE_MCP_SERVERS } from './data/mcpServersData';
import { MCPServerCard } from './MCPServerCard';
import { MCPServerSettingsModal } from './MCPServerSettingsModal';
import { MCPServerLogsModal } from './MCPServerLogsModal';
import { MCPServerInstallModal } from './MCPServerInstallModal';
import { MCPServerJSONView } from './MCPServerJSONView';
import { AddExtensionCard } from './AddExtensionCard';
import { ActionBar } from './ActionBar';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';
import { convertEdgeMCPsToServers } from '../../utils/mcpDataConverter';

// Styled Components
const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 30px;
  text-align: center;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0 0 8px 0;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.mutedForeground};
  margin: 0;
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 30px;
`;



const ServersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
`;



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

const Modal = styled.div`
  background: ${props => props.theme.colors.background};
  border-radius: ${props => props.theme.radius.lg};
  border: 1px solid ${props => props.theme.colors.borderColor};
  width: 90%;
  max-width: 1200px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: ${props => props.theme.colors.mutedForeground};
  cursor: pointer;
  padding: 8px;
  border-radius: ${props => props.theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
  }
`;

const ModalContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const ModalControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
`;

const ExtensionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
`;

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
  width: 44px;
  height: 44px;
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

interface MCPServersListProps {
  viewMode: 'visual' | 'json';
  onViewModeChange: (mode: 'visual' | 'json') => void;
}

const MCPServersList: React.FC<MCPServersListProps> = ({ viewMode, onViewModeChange }) => {
  const { getMCPServers, config } = useEdgeConfigStore();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showInstallModal, setShowInstallModal] = useState<MCPServer | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<MCPServer | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<MCPServer | null>(null);
  const [showExtensionsModal, setShowExtensionsModal] = useState<boolean>(false);

  // Load real MCP data from edge config - refresh when config changes
  useEffect(() => {
    const edgeMCPs = getMCPServers();
    const realServers = convertEdgeMCPsToServers(edgeMCPs);
    
    // Combine real servers with fake ones (fake ones as uninstalled)
    const fakeServersAsUninstalled = FAKE_MCP_SERVERS.map(server => ({
      ...server,
      status: 'uninstalled' as const
    }));
    
    // Filter out fake servers that have real counterparts
    const filteredFakeServers = fakeServersAsUninstalled.filter(
      fakeServer => !realServers.some(realServer => realServer.id === fakeServer.id)
    );
    
    const allServers = [...realServers, ...filteredFakeServers];
    setServers(allServers);
    
    console.log('Real MCP servers loaded:', realServers);
    console.log('All servers (real + fake):', allServers);
  }, [config.MCPs, getMCPServers]); // React to changes in MCPs

  const handleStatusChange = (serverId: string, newStatus: MCPServer['status']) => {
    setServers(prev => prev.map(server => 
      server.id === serverId ? { ...server, status: newStatus } : server
    ));
  };

  const handleViewLogs = (server: MCPServer) => {
    setShowLogsModal(server);
  };

  const handleOpenSettings = (server: MCPServer) => {
    setShowSettingsModal(server);
  };

  const handleSaveServer = (updatedServer: MCPServer) => {
    setServers(prev => prev.map(server => 
      server.id === updatedServer.id ? updatedServer : server
    ));
  };

  const handleInstallServer = (customId: string) => {
    if (showInstallModal) {
      const newServer = {
        ...showInstallModal,
        id: customId || showInstallModal.id,
        status: 'installed' as const
      };
      
      setServers(prev => [...prev.filter(s => s.id !== newServer.id), newServer]);
      setShowInstallModal(null);
    }
  };

  // Filter installed servers only for main view
  const installedServers = servers.filter(server => server.status !== 'uninstalled');
  
  // Get unique categories from installed servers
  const categories = ['All', ...Array.from(new Set(installedServers.map(s => s.category)))];

  // Filter installed servers
  const filteredServers = installedServers.filter(server => {
    const matchesCategory = selectedCategory === 'All' || server.category === selectedCategory;
    const matchesSearch = server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         server.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Available servers for installation (uninstalled ones)
  const availableServers = servers.filter(server => server.status === 'uninstalled');
  const availableCategories = ['All', ...Array.from(new Set(availableServers.map(s => s.category)))];

  return (
    <Container>
      <Header>
        <Title>AI Extensions</Title>
        <Subtitle>Extend agent capabilities with integrations along the internet and your PC. Discover and install!</Subtitle>
      </Header>

      <Controls>
        <ActionBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search MCP servers..."
          selectedCategory={selectedCategory}
          categories={categories}
          onCategoryChange={setSelectedCategory}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          showViewPicker={true}
        />
      </Controls>

      {viewMode === 'json' ? (
        <MCPServerJSONView 
          servers={servers} 
          onServersChange={setServers} 
        />
      ) : (
        <ServersGrid>
          {filteredServers.map(server => (
            <MCPServerCard
              key={server.id}
              server={server}
              onStatusChange={handleStatusChange}
              onViewLogs={handleViewLogs}
              onOpenSettings={handleOpenSettings}
              showCategory={selectedCategory !== 'All'}
            />
          ))}
          
          <AddExtensionCard onClick={() => setShowExtensionsModal(true)} />
        </ServersGrid>
      )}

      {showSettingsModal && (
        <MCPServerSettingsModal
          server={showSettingsModal}
          onClose={() => setShowSettingsModal(null)}
          onSave={handleSaveServer}
        />
      )}

      {showLogsModal && (
        <MCPServerLogsModal
          server={showLogsModal}
          onClose={() => setShowLogsModal(null)}
        />
      )}

      {showInstallModal && (
        <MCPServerInstallModal
          server={showInstallModal}
          onClose={() => setShowInstallModal(null)}
          onInstall={handleInstallServer}
        />
      )}

      {showExtensionsModal && (
        <ExtensionsModal
          servers={availableServers}
          categories={availableCategories}
          onClose={() => setShowExtensionsModal(false)}
          onInstall={(server) => {
            setShowInstallModal(server);
            setShowExtensionsModal(false);
          }}
        />
      )}
    </Container>
  );
};

// Extensions Modal Component
const ExtensionsModal: React.FC<{
  servers: MCPServer[];
  categories: string[];
  onClose: () => void;
  onInstall: (server: MCPServer) => void;
}> = ({ servers, categories, onClose, onInstall }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Add escape key handler
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const filteredServers = servers.filter(server => {
    const matchesCategory = selectedCategory === 'All' || server.category === selectedCategory;
    const matchesSearch = server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         server.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <ModalOverlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Add New Extensions</ModalTitle>
          <CloseButton onClick={onClose}>
            <Icon icon="lucide:x" />
          </CloseButton>
        </ModalHeader>

        <ModalContent>
          <ModalControls>
            <ActionBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search available extensions..."
              selectedCategory={selectedCategory}
              categories={categories}
              onCategoryChange={setSelectedCategory}
            />
          </ModalControls>

          <ExtensionsGrid>
            {filteredServers.map(server => (
              <ExtensionCard key={server.id}>
                <ExtensionIcon>
                  <Icon icon={server.icon} width={32} height={32} />
                </ExtensionIcon>
                <ExtensionInfo>
                  <ExtensionName>{server.name}</ExtensionName>
                  <ExtensionDescription>{server.description}</ExtensionDescription>
                  <ExtensionCategory>{server.category}</ExtensionCategory>
                </ExtensionInfo>
                <InstallButton onClick={() => onInstall(server)}>
                  <Icon icon="lucide:download" />
                  Install
                </InstallButton>
              </ExtensionCard>
            ))}
          </ExtensionsGrid>
        </ModalContent>
      </Modal>
    </ModalOverlay>
  );
};

export default MCPServersList;