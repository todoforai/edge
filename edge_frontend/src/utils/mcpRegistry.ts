import { MOCK_MCP_REGISTRY } from '../data/mcpServersData';
import type { MCPRegistry } from '../types';


// Create global registry maps for efficient lookups
const global_registry = new Map<string, MCPRegistry>();
const command_args_registry = new Map<string, MCPRegistry>();

// Initialize registries
MOCK_MCP_REGISTRY.forEach(server => {
  if (server.serverId) {
    global_registry.set(server.serverId, server);
  }
  const key = `${server.command}|${(server.args || []).join('|')}`;
  command_args_registry.set(key, server);
});

export { global_registry, command_args_registry };

// Helper to find registry entry by command and args
export const getMCPByCommandArgs = (command: string, args: string[] = []): MCPRegistry | undefined => {
  const key = `${command}|${args.join('|')}`;
  return command_args_registry.get(key);
};



export const getMCPIcon = (serverId: string): string => {
  const server = global_registry.get(serverId);
  const icon = server?.icon;
  
  if (typeof icon === 'string') {
    return icon;
  } else if (icon && typeof icon === 'object' && 'dark' in icon) {
    return icon.dark;
  }
  return '/logos/default.png';
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

