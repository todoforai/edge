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

// Create a command-args based lookup map
const createCommandArgsMap = (registry: MCPRegistry[]): Map<string, MCPRegistry> => {
  const map = new Map<string, MCPRegistry>();
  registry.forEach(server => {
    const key = `${server.command}|${(server.args || []).join('|')}`;
    map.set(key, server);
  });
  return map;
};

export const global_registry = createRegistryMap(MOCK_MCP_REGISTRY);
export const command_args_registry = createCommandArgsMap(MOCK_MCP_REGISTRY);

// Helper to find registry entry by command and args
export const getMCPByCommandArgs = (command: string, args: string[] = []): MCPRegistry | undefined => {
  const key = `${command}|${args.join('|')}`;
  return command_args_registry.get(key);
};

// Helper functions
export const getMCPIcon = (serverId: string): string => {
  const server = global_registry.get(serverId);
  const icon = server?.icon;
  
  // Handle both string and object icon types
  if (typeof icon === 'string') {
    return icon;
  } else if (icon && typeof icon === 'object' && 'dark' in icon) {
    // For now, default to dark theme - could be made configurable
    return icon.dark;
  }
  
  return '/logos/default.png'; // Return image path directly
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