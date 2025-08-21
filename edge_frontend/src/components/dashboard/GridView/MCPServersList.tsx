import React, { useState } from 'react';
import { MCPServerCard } from './MCPServerCard';
import { MCPServerSettingsModal } from './MCPServerSettingsModal';
import { MCPServerLogsModal } from './MCPServerLogsModal';
import { ExtensionAddCard } from './ExtensionAddCard';
import { ExtensionsRegistryModal } from './ExtensionsRegistryModal';
import { Grid } from '../../ui/Grid';
import { useEdgeConfigStore } from '../../../store/edgeConfigStore';
import { useMCPRegistry } from '../../../hooks/useMCPRegistry';
import type { MCPEdgeExecutable, MCPJSON } from '../../../types';

interface MCPServersListProps {
  instances: MCPEdgeExecutable[];
  selectedCategory: string;
}

const MCPServersList: React.FC<MCPServersListProps> = ({ 
  instances, 
  selectedCategory 
}) => {
  const { config } = useEdgeConfigStore();
  const { availableServers } = useMCPRegistry();
  
  const [showSettingsModal, setShowSettingsModal] = useState<MCPEdgeExecutable | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<MCPEdgeExecutable | null>(null);
  const [showExtensionsRegistryModal, setShowExtensionsRegistryModal] = useState(false);

  const handleInstallFromRegistry = (server: MCPJSON) => {
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