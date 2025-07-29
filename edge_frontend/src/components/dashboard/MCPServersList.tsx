import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Icon } from '@iconify/react';
import type { MCPInstance, MCPJSON, MCPRunningStatus } from '../../shared/REST_types_shared';
import { MOCK_MCP_REGISTRY } from './data/mcpServersData';
import { MCPServerCard } from './MCPServerCard';
import { MCPServerSettingsModal } from './MCPServerSettingsModal';
import { MCPServerLogsModal } from './MCPServerLogsModal';
import { MCPServerInstallModal } from './MCPServerInstallModal';
import { MCPServerJSONView } from './MCPServerJSONView';
import { AddExtensionCard } from './AddExtensionCard';
import { ActionBar } from './ActionBar';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';
import { getServerInfoFromRegistry } from '../../utils/mcpDataConverter';

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
  const { getMCPInstances, config } = useEdgeConfigStore();
  const [instances, setInstances] = useState<MCPInstance[]>([]);
  const [registryServers, setRegistryServers] = useState<MCPJSON[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showInstallModal, setShowInstallModal] = useState<MCPJSON | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<MCPInstance | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<MCPInstance | null>(null);
  const [showExtensionsModal, setShowExtensionsModal] = useState<boolean>(false);

  // Load real MCP data from edge config and mock registry data
  useEffect(() => {
    const mcpInstances = getMCPInstances();
    console.log("MCP Instances:", mcpInstances);
    
    // Use mock registry data
    setRegistryServers(MOCK_MCP_REGISTRY);
    setInstances(mcpInstances);
    
    console.log('MCP instances loaded:', mcpInstances);
    console.log('Mock registry servers:', MOCK_MCP_REGISTRY);
  }, [config.MCPs, getMCPInstances]);

  const handleStatusChange = (instanceId: string, newStatus: MCPRunningStatus) => {
    setInstances(prev => prev.map(instance => 
      instance.id === instanceId 
        ? { ...instance, session: { ...instance.session, status: newStatus } }
        : instance
    ));
  };

  const handleViewLogs = (instance: MCPInstance) => {
    setShowLogsModal(instance);
  };

  const handleOpenSettings = (instance: MCPInstance) => {
    setShowSettingsModal(instance);
  };

  const handleSaveInstance = (updatedInstance: MCPInstance) => {
    setInstances(prev => prev.map(instance => 
      instance.id === updatedInstance.id ? updatedInstance : instance
    ));
  };

  const handleInstallServer = (customId: string) => {
    if (showInstallModal) {
      const newInstance: MCPInstance = {
        id: customId || `${showInstallModal.id}-${Date.now()}`,
        serverId: showInstallModal.id,
        MCPRegistryID: showInstallModal.id,
        tools: showInstallModal.tools || [],
        env: showInstallModal.env ? Object.fromEntries(showInstallModal.env.map(key => [key, ''])) : {},
        conf: showInstallModal.conf ? Object.fromEntries(showInstallModal.conf.map(key => [key, ''])) : {},
        session: {
          id: `session-${Date.now()}`,
          MCPInstanceID: customId || `${showInstallModal.id}-${Date.now()}`,
          status: 'STOPPED' as MCPRunningStatus
        },
        enabled: true
      };
      
      setInstances(prev => [...prev, newInstance]);
      setShowInstallModal(null);
    }
  };

  // Get unique categories from instances
  const getInstanceCategories = useMemo(() => {
    const categories = instances.map(instance => {
      const serverInfo = getServerInfoFromRegistry(instance.serverId);
      return serverInfo.category?.[0] || 'Unknown';
    });
    return ['All', ...Array.from(new Set(categories))];
  }, [instances]);

  // Filter instances
  const filteredInstances = instances.filter(instance => {
    const serverInfo = getServerInfoFromRegistry(instance.serverId);
    const category = serverInfo.category?.[0] || 'Unknown';
    const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
    const matchesSearch = 
      serverInfo.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      serverInfo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instance.serverId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Available servers for installation (from registry)
  const availableServers = useMemo(() => 
    registryServers.filter(registry => 
      !instances.some(instance => instance.serverId === registry.id)
    ), [registryServers, instances]);

  const availableCategories = useMemo(() => 
    ['All', ...Array.from(new Set(availableServers.flatMap(s => s.category || ['Other'])))], 
    [availableServers]);

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
          categories={getInstanceCategories}
          onCategoryChange={setSelectedCategory}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          showViewPicker={true}
        />
      </Controls>

      {viewMode === 'json' ? (
        <MCPServerJSONView 
          instances={instances} 
          onInstancesChange={setInstances} 
        />
      ) : (
        <ServersGrid>
          {filteredInstances.map((instance, index) => (
            <MCPServerCard
              key={`${instance.id}-${index}`}
              instance={instance}
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
          instance={showSettingsModal}
          onClose={() => setShowSettingsModal(null)}
          onSave={handleSaveInstance}
        />
      )}

      {showLogsModal && (
        <MCPServerLogsModal
          instance={showLogsModal}
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
          servers={availableUninstalledServers}
          categories={availableCategories}
          onClose={() => setShowExtensionsModal(false)}
          onInstall={(registry) => {
            setShowInstallModal(registry);
            setShowExtensionsModal(false);
          }}
        />
      )}
    </Container>
  );
};

// Extensions Modal Component
const ExtensionsModal: React.FC<{
  servers: MCPJSON[];
  categories: string[];
  onClose: () => void;
  onInstall: (server: MCPJSON) => void;
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
    const serverCategories = server.category || ['Other'];
    const matchesCategory = selectedCategory === 'All' || serverCategories.includes(selectedCategory);
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
            {filteredServers.map((server, index) => (
              <ExtensionCard key={server.id || `server-${index}`}>
                <ExtensionIcon>
                  <Icon 
                    icon={typeof server.icon === 'string' ? server.icon : server.icon?.light || 'lucide:server'} 
                    width={32} 
                    height={32} 
                  />
                </ExtensionIcon>
                <ExtensionInfo>
                  <ExtensionName>{server.name}</ExtensionName>
                  <ExtensionDescription>{server.description}</ExtensionDescription>
                  <ExtensionCategory>{server.category?.[0] || 'Other'}</ExtensionCategory>
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