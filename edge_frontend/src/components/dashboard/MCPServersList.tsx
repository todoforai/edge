import React, { useState } from 'react';
import styled from 'styled-components';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';
import { useMCPRegistry } from '../../hooks/useMCPRegistry';
import { useMCPFilters } from '../../hooks/useMCPFilters';
import { MCPServerCard } from './MCPServerCard';
import { MCPServerSettingsModal } from './MCPServerSettingsModal';
import { MCPServerLogsModal } from './MCPServerLogsModal';
import { MCPServerJSONView } from './MCPServerJSONView';
import { AddExtensionCard } from './AddExtensionCard';
import { ActionBar } from './ActionBar';
import { ExtensionsModal } from './ExtensionsModal';
import { Grid } from '../ui/Grid';
import pythonService from '../../services/python-service';
import type { MCPEdgeExecutable, ViewMode, MCPJSON } from '../../types';

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

interface MCPServersListProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const MCPServersList: React.FC<MCPServersListProps> = ({ viewMode, onViewModeChange }) => {
  const { config, getMCPInstances } = useEdgeConfigStore();
  const { availableServers } = useMCPRegistry();
  const { 
    searchTerm, 
    setSearchTerm, 
    selectedCategory, 
    setSelectedCategory,
    filteredInstances,
    categories 
  } = useMCPFilters(getMCPInstances());

  const [showSettingsModal, setShowSettingsModal] = useState<MCPEdgeExecutable | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<MCPEdgeExecutable | null>(null);
  const [showExtensionsModal, setShowExtensionsModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const result = await pythonService.refreshMCPConfig();
      console.log('MCP config refresh result:', result);
    } catch (error) {
      console.error('Failed to refresh MCP config:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleInstallFromRegistry = (server: MCPJSON) => {
    // Create a temporary MCPEdgeExecutable for the settings modal
    const tempInstance: MCPEdgeExecutable = {
      id: `temp-${Date.now()}`,
      serverId: server.serverId,
      command: server.command,
      args: server.args || [],
      env: server.env || {}
    };
    
    setShowSettingsModal(tempInstance);
  };

  const handleSaveInstance = async (updatedInstance: MCPEdgeExecutable) => {
    try {
      const isNewInstallation = (updatedInstance.id || '').startsWith('temp-');
      
      if (isNewInstallation) {
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

        const instanceId = updatedInstance.id || updatedInstance.serverId;
        const updatedInstalledMCPs = {
          ...config.installedMCPs,
          [instanceId]: {
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
      const currentMcpJson = config.mcp_json || {};
      const { [serverId]: removed, ...remainingServers } = currentMcpJson.mcpServers || {};
      
      const updatedMcpJson = {
        ...currentMcpJson,
        mcpServers: remainingServers
      };

      await useEdgeConfigStore.getState().saveConfigToBackend({
        mcp_json: updatedMcpJson
      });

      console.log(`Removed MCP server: ${serverId}`);
    } catch (error) {
      console.error('Failed to remove MCP server:', error);
    }
  };

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
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </Controls>

      {viewMode === 'json' ? (
        <MCPServerJSONView 
          instances={filteredInstances} 
          onInstancesChange={() => console.warn("onInstancesChange: Direct state update for instances is deprecated. Update config.mcp_json instead.")} 
        />
      ) : (
        <Grid>
          {filteredInstances.map((instance, index) => (
            <MCPServerCard
              key={`${instance.id}-${index}`}
              instance={instance}
              onUninstall={handleRemoveInstance}
              onViewLogs={setShowLogsModal}
              onOpenSettings={setShowSettingsModal}
              showCategory={selectedCategory !== 'All'}
            />
          ))}
          <AddExtensionCard onClick={() => setShowExtensionsModal(true)} />
        </Grid>
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
          onClose={() => setShowExtensionsModal(false)}
          onInstall={handleInstallFromRegistry}
        />
      )}
    </Container>
  );
};

export default MCPServersList;