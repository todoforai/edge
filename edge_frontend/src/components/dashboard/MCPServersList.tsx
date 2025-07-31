import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Icon } from '../../utils/iconMapper';
import { MCPRunningStatus, type MCPJSON, type MCPEdgeExecutable } from '../../shared/REST_types_shared';
import { MOCK_MCP_REGISTRY } from './data/mcpServersData';
import { MCPServerCard } from './MCPServerCard';
import { MCPServerSettingsModal } from './MCPServerSettingsModal';
import { MCPServerLogsModal } from './MCPServerLogsModal';
import { MCPServerInstallModal } from './MCPServerInstallModal';
import { MCPServerJSONView } from './MCPServerJSONView';
import { AddExtensionCard } from './AddExtensionCard';
import { ActionBar } from './ActionBar';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';
import { getMCPIcon, getMCPName, getMCPDescription, getMCPCategory, getMCPByCommandArgs } from '../../utils/mcpRegistry';

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
  const { config, getMCPInstances } = useEdgeConfigStore();
  const [registryServers, setRegistryServers] = useState<MCPJSON[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showInstallModal, setShowInstallModal] = useState<MCPJSON | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<MCPEdgeExecutable | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<MCPEdgeExecutable | null>(null);
  const [showExtensionsModal, setShowExtensionsModal] = useState<boolean>(false);

  // Use the store's method to get properly formatted instances
  const instances: MCPEdgeExecutable[] = useMemo(() => {
    return getMCPInstances();
  }, [getMCPInstances, config.installedMCPs, config.mcp_json]);

  // Load mock registry data
  useEffect(() => {
    setRegistryServers(MOCK_MCP_REGISTRY);
    console.log('MCP instances from mcp_json:', instances);
    console.log('Mock registry servers:', MOCK_MCP_REGISTRY);
  }, [instances]);

  const handleViewLogs = (instance: MCPEdgeExecutable) => {
    setShowLogsModal(instance);
  };

  const handleOpenSettings = (instance: MCPEdgeExecutable) => {
    setShowSettingsModal(instance);
  };

  console.log('currentMcpJson', config.mcp_json);
  const handleInstallServer = async (customId: string) => {
    if (showInstallModal) {
      try {
        // Use the custom ID as the server key, not the original serverId
        const serverKey = customId || showInstallModal.serverId;
        
        // Create the new server configuration for mcp_json
        const serverConfig = {
          command: showInstallModal.command,
          args: showInstallModal.args || [],
          env: showInstallModal.env || {}
        };

        // Update mcp_json by adding the new server
        const currentMcpJson = config.mcp_json || {};
        const updatedMcpJson = {
          ...currentMcpJson,
          mcpServers: {
            ...currentMcpJson.mcpServers,
            [serverKey]: serverConfig
          }
        };

        // Save to backend - this will trigger the observer pattern to reload tools
        await useEdgeConfigStore.getState().saveConfigToBackend({
          mcp_json: updatedMcpJson
        });

        console.log(`Installed MCP server: ${serverKey}`);
        setShowInstallModal(null);
      } catch (error) {
        console.error('Failed to install MCP server:', error);
        // Could add error toast here
      }
    }
  };

  // Replace the install modal with settings modal for new installations
  const handleInstallFromRegistry = (server: MCPJSON) => {
    // Create a temporary MCPEdgeExecutable for the settings modal
    const tempInstance: MCPEdgeExecutable = {
      id: `temp-${Date.now()}`,
      serverId: server.serverId,
      command: server.command,
      args: server.args || [],
      env: server.env || {},
      enabled: true
    };
    
    setShowSettingsModal(tempInstance);
    setShowExtensionsModal(false);
  };

  const handleSaveInstance = async (updatedInstance: MCPEdgeExecutable) => {
    try {
      // Check if this is a new installation (temp ID)
      const isNewInstallation = updatedInstance.id.startsWith('temp-');
      
      if (isNewInstallation) {
        // This is a new installation, add to mcp_json
        const currentMcpJson = config.mcp_json || {};
        const updatedMcpJson = {
          ...currentMcpJson,
          mcpServers: {
            ...currentMcpJson.mcpServers,
            [updatedInstance.serverId]: {
              command: updatedInstance.command,
              args: updatedInstance.args || [],
              env: updatedInstance.env || {}
            }
          }
        };

        await useEdgeConfigStore.getState().saveConfigToBackend({
          mcp_json: updatedMcpJson
        });

        console.log(`Installed new MCP server: ${updatedInstance.serverId}`);
      } else {
        // This is an existing instance update
        const currentMcpJson = config.mcp_json || {};
        const updatedMcpJson = {
          ...currentMcpJson,
          mcpServers: {
            ...currentMcpJson.mcpServers,
            [updatedInstance.serverId]: {
              command: updatedInstance.command,
              args: updatedInstance.args || [],
              env: updatedInstance.env || {}
            }
          }
        };

        // Also update installedMCPs 
        const updatedInstalledMCPs = {
          ...config.installedMCPs,
          [updatedInstance.id]: {
            ...updatedInstance
          }
        };

        await useEdgeConfigStore.getState().saveConfigToBackend({
          mcp_json: updatedMcpJson,
          installedMCPs: updatedInstalledMCPs
        });

        console.log(`Updated MCP server config: ${updatedInstance.serverId}`);
      }
    } catch (error) {
      console.error('Failed to save MCP server config:', error);
    }
  };

  const handleRemoveInstance = async (serverId: string) => {
    try {
      // Remove server from mcp_json
      const currentMcpJson = config.mcp_json || {};
      const { [serverId]: removed, ...remainingServers } = currentMcpJson.mcpServers || {};
      
      const updatedMcpJson = {
        ...currentMcpJson,
        mcpServers: remainingServers
      };

      // Save to backend
      await useEdgeConfigStore.getState().saveConfigToBackend({
        mcp_json: updatedMcpJson
      });

      console.log(`Removed MCP server: ${serverId}`);
    } catch (error) {
      console.error('Failed to remove MCP server:', error);
    }
  };

  // Get unique categories from instances using helper function
  const getInstanceCategories = useMemo(() => {
    const categories = instances.map(instance => {
      const registryServer = getMCPByCommandArgs(instance.command, instance.args);
      return registryServer?.category?.[0] || 'Unknown';
    });
    return ['All', ...Array.from(new Set(categories))];
  }, [instances]);

  // Filter instances using helper functions
  const filteredInstances = instances.filter(instance => {
    const registryServer = getMCPByCommandArgs(instance.command, instance.args);
    const category = registryServer?.category?.[0] || 'Unknown';
    const name = registryServer?.name || `${instance.command} ${instance.args?.join(' ') || ''}`;
    const description = registryServer?.description || '';
    
    const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
    const matchesSearch = 
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instance.serverId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Available servers for installation (from registry, excluding already installed)
  const availableServers = useMemo(() => 
    registryServers.filter(registry => 
      !instances.some(instance => instance.serverId === registry.serverId)
    ), [registryServers, instances]);

  const availableCategories = useMemo(() => 
    ['All', ...Array.from(new Set(availableServers.flatMap(s => getMCPCategory(s.serverId) || ['Other'])))], 
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
          onInstancesChange={() => console.warn("onInstancesChange: Direct state update for instances is deprecated. Update config.mcp_json instead.")} 
        />
      ) : (
        <ServersGrid>
          {filteredInstances.map((instance, index) => (
            <MCPServerCard
              key={`${instance.id}-${index}`}
              instance={instance}
              onUninstall={handleRemoveInstance}
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

      {showExtensionsModal && (
        <ExtensionsModal
          servers={availableServers}
          categories={availableCategories}
          onClose={() => setShowExtensionsModal(false)}
          onInstall={handleInstallFromRegistry}
        />
      )}

      {/* Remove the MCPServerInstallModal since we're using settings modal */}
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
    const serverCategories = getMCPCategory(server.serverId) || ['Other'];
    const matchesCategory = selectedCategory === 'All' || serverCategories.includes(selectedCategory);
    const matchesSearch = (getMCPName(server.serverId).toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
                         (getMCPDescription(server.serverId).toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    return matchesCategory && matchesSearch;
  });

  return (
    <ModalOverlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Add New Extensions</ModalTitle>
          <CloseButton onClick={onClose}>
            <Icon icon="lucide:x" size={20} />
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
              <ExtensionCard key={server.serverId || `server-${index}`}>
                <ExtensionIcon>
                  <Icon 
                    icon={getMCPIcon(server.serverId || '')} 
                    size={32}
                  />
                </ExtensionIcon>
                <ExtensionInfo>
                  <ExtensionName>{getMCPName(server.serverId)}</ExtensionName>
                  <ExtensionDescription>{getMCPDescription(server.serverId)}</ExtensionDescription>
                  <ExtensionCategory>{getMCPCategory(server.serverId)?.[0] || 'Other'}</ExtensionCategory>
                </ExtensionInfo>
                <InstallButton onClick={() => onInstall(server)}>
                  <Icon icon="lucide:download" size={16} />
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