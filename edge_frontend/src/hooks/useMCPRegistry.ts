import { useState, useMemo } from 'react';
import { useEdgeConfigStore } from '../store/edgeConfigStore';
import { MOCK_MCP_REGISTRY } from '../data/mcpServersData';
import type { MCPJSON } from '../types';

export const useMCPRegistry = () => {
  const { getMCPInstances } = useEdgeConfigStore();
  const [registryServers] = useState<MCPJSON[]>(MOCK_MCP_REGISTRY);
  const instances = getMCPInstances();

  const availableServers = useMemo(() => 
    registryServers.filter(registry => 
      !instances.some(instance => instance.serverId === registry.serverId)
    ), [registryServers, instances]);

  return { registryServers, availableServers, instances };
};