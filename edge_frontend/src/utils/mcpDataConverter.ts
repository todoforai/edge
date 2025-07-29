import type { MCPInstance, MCPJSON } from '../shared/REST_types_shared';
import { MOCK_MCP_REGISTRY } from '../components/dashboard/data/mcpServersData';

// No conversion needed - just use MCPInstance directly
export const getMCPInstances = (instances: MCPInstance[]): MCPInstance[] => {
  return instances;
};

// Helper function to get server metadata from registry
export const getServerInfoFromRegistry = (serverId: string): Partial<MCPJSON> => {
  const registryEntry = MOCK_MCP_REGISTRY.find(server => server.id === serverId);
  
  if (registryEntry) {
    return registryEntry;
  }

  // Fallback for unknown servers
  return {
    name: `${serverId} MCP`,
    description: `MCP server for ${serverId}`,
    icon: 'lucide:server',
    command: 'npx',
    args: [`@${serverId}/mcp-server`],
    category: ['Unknown']
  };
};

