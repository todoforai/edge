import { useState, useMemo } from 'react';
import { useEdgeConfigStore } from '../store/edgeConfigStore';
import { MCP_REGISTRY } from '../data/mcpServersRegistry';
import type { MCPJSON } from '../types';

export const useMCPRegistry = () => {
  const { getMCPInstances } = useEdgeConfigStore();
  const [registryServers] = useState<MCPJSON[]>(MCP_REGISTRY);
  const instances = getMCPInstances();

  const availableServers = useMemo(() => 
    registryServers.filter(registry => 
      !instances.some(instance => instance.serverId === registry.serverId)
    ), [registryServers, instances]);

  return { registryServers, availableServers, instances };
};