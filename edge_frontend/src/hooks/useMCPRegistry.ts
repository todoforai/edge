import { useState, useMemo } from 'react';
import { useEdgeConfigStore } from '../store/edgeConfigStore';
import { MCP_REGISTRY } from '../data/mcpServersRegistry';
import type { MCPRegistry } from '../types';

export const useMCPRegistry = () => {
  const config = useEdgeConfigStore(state => state.config);
  const getMCPInstances = useEdgeConfigStore(state => state.getMCPInstances);
  const [registryServers] = useState<MCPRegistry[]>(MCP_REGISTRY);
  const instances = useMemo(() => getMCPInstances(config), [config, getMCPInstances]);

  const availableServers = useMemo(() => 
    registryServers.filter(registry => 
      !instances.some(instance => instance.serverId === registry.registryId)
    ), [registryServers, instances]);

  return { registryServers, availableServers, instances };
};