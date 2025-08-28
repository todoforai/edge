import { useState, useMemo } from 'react';
import { useEdgeConfigStore } from '../store/edgeConfigStore';
import { MCP_REGISTRY } from '../data/mcpServersRegistry';
import type { MCPRegistry } from '../types';

export const useMCPRegistry = () => {
  const { getMCPInstances } = useEdgeConfigStore();
  const [registryServers] = useState<MCPRegistry[]>(MCP_REGISTRY);
  const instances = getMCPInstances();

  const availableServers = useMemo(() => 
    registryServers.filter(registry => 
      !instances.some(instance => instance.serverId === registry.registryId)
    ), [registryServers, instances]);

  return { registryServers, availableServers, instances };
};