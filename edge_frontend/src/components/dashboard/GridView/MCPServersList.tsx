import React, { useState } from 'react';
import { MCPServerCard } from './MCPServerCard';
import { MCPServerSettingsModal, ExtensionsRegistryModal } from '@todoforai/shared-fe';
import { MCPServerLogsModal } from './MCPServerLogsModal';
import { ExtensionAddCard } from './ExtensionAddCard';
import { Grid } from '../../ui/Grid';
import { useEdgeConfigStore } from '../../../store/edgeConfigStore';
import { useMCPRegistry } from '../../../hooks/useMCPRegistry';
import type { MCPEdgeExecutable, MCPRegistry } from '@todoforai/shared-fbe';

// Helper function to build/merge InstalledMCP entry optimistically
const buildInstalledEntry = (serverId: string, mcpJson: any, prevInstalled: any, isNewInstallation: boolean = false) => {
  const cfg = (mcpJson?.mcpServers || {})[serverId] || {};
  const prevEntry = (prevInstalled || {})[serverId] || {};
  return {
    ...prevEntry,
    serverId,
    id: prevEntry.id || serverId,
    command: cfg.command ?? prevEntry.command ?? 'node',
    args: cfg.args ?? prevEntry.args ?? [],
    env: { ...(prevEntry.env || {}), ...(cfg.env || {}) },
    tools: prevEntry.tools || [],
    registryId: prevEntry.registryId || serverId,
    status: isNewInstallation ? 'INSTALLING' : 'STARTING', // Use INSTALLING for new, STARTING for existing
  };
};

interface MCPServersListProps {
  instances: MCPEdgeExecutable[];
  selectedCategory: string;
}

const MCPServersList: React.FC<MCPServersListProps> = ({ 
  instances, 
  selectedCategory 
}) => {
  const { config } = useEdgeConfigStore();
  console.log('config:', config)
  const { availableServers } = useMCPRegistry();
  
  const [showSettingsModal, setShowSettingsModal] = useState<MCPEdgeExecutable | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<MCPEdgeExecutable | null>(null);
  const [showExtensionsRegistryModal, setShowExtensionsRegistryModal] = useState(false);

  const handleInstallFromRegistry = (server: MCPRegistry) => {
    const serverId = server.registryId || `temp-${Date.now()}`;
    const tempInstance: MCPEdgeExecutable = {
      id: `temp-${Date.now()}`,
      serverId: serverId,
      command: server.command,
      args: server.args || [],
      env: server.env || {},
      registryId: serverId
    };
    
    setShowSettingsModal(tempInstance);
  };

  const handleSaveInstance = async (updatedInstance: MCPEdgeExecutable) => {
    try {
      const isNewInstallation = (updatedInstance.id || '').startsWith('temp-');
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

      // Optimistic InstalledMCPs update
      const prevInstalled = config.installedMCPs || {};
      const installedMCPs = {
        ...prevInstalled,
        [updatedInstance.serverId]: buildInstalledEntry(updatedInstance.serverId, updatedMcpJson, prevInstalled, isNewInstallation),
      };

      await useEdgeConfigStore.getState().saveConfigToBackend({
        mcp_json: updatedMcpJson,
        installedMCPs,
      });

      console.log(`${isNewInstallation ? 'Installed new' : 'Updated'} MCP server: ${updatedInstance.serverId}`);
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

      // Optimistic InstalledMCPs removal
      const { [serverId]: _removedInstalled, ...remainingInstalled } = config.installedMCPs || {};

      await useEdgeConfigStore.getState().saveConfigToBackend({
        mcp_json: updatedMcpJson,
        installedMCPs: remainingInstalled,
      });

      console.log(`Removed MCP server: ${serverId}`);
    } catch (error) {
      console.error('Failed to remove MCP server:', error);
    }
  };

  return (
    <>
      <Grid>
        {instances.map((instance, index) => (
          <MCPServerCard
            key={`${instance.id}-${index}`}
            instance={instance}
            onUninstall={handleRemoveInstance}
            onViewLogs={setShowLogsModal}
            onOpenSettings={setShowSettingsModal}
            showCategory={selectedCategory !== 'All'}
          />
        ))}
        <ExtensionAddCard onClick={() => setShowExtensionsRegistryModal(true)} />
      </Grid>

      {showSettingsModal && (
        <MCPServerSettingsModal
          instance={showSettingsModal}
          isOpen={true}
          onClose={() => setShowSettingsModal(null)}
          onSave={handleSaveInstance}
        />
      )}

      {showLogsModal && (
        <MCPServerLogsModal
          instance={showLogsModal}
          isOpen={true}
          onClose={() => setShowLogsModal(null)}
        />
      )}

      {showExtensionsRegistryModal && (
        <ExtensionsRegistryModal
          servers={availableServers}
          onClose={() => setShowExtensionsRegistryModal(false)}
          onInstall={handleInstallFromRegistry}
        />
      )}
    </>
  );
};

export default MCPServersList;