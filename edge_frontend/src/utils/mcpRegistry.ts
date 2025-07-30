import { MOCK_MCP_REGISTRY } from '../components/dashboard/data/mcpServersData';
import type { MCPRegistry } from '../shared/REST_types_shared';

// Create a global registry map for efficient lookups
const createRegistryMap = (registry: MCPRegistry[]): Map<string, MCPRegistry> => {
  const map = new Map<string, MCPRegistry>();
  registry.forEach(server => {
    if (server.serverId) {
      map.set(server.serverId, server);
    }
  });
  return map;
};

export const global_registry = createRegistryMap(MOCK_MCP_REGISTRY);

// Helper functions
export const getMCPIcon = (serverId: string): string => {
  const server = global_registry.get(serverId);
  if (!server?.icon) return 'lucide:server';
  
  return typeof server.icon === 'string' ? server.icon : server.icon.light || 'lucide:server';
};

export const getMCPName = (serverId: string): string => {
  const server = global_registry.get(serverId);
  return server?.name || serverId;
};

export const getMCPDescription = (serverId: string): string => {
  const server = global_registry.get(serverId);
  return server?.description || 'No description available';
};

export const getMCPCategory = (serverId: string): string[] => {
  const server = global_registry.get(serverId);
  return server?.category || ['Other'];
};

export const getMCPServer = (serverId: string): MCPRegistry | undefined => {
  return global_registry.get(serverId);
};

// Helper to get all available categories
export const getAllCategories = (): string[] => {
  const categories = new Set<string>();
  global_registry.forEach(server => {
    server.category?.forEach(cat => categories.add(cat));
  });
  return Array.from(categories).sort();
};