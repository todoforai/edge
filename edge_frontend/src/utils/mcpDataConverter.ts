import type { MCPEdgeExecutable } from '../shared/REST_types_shared';

// No conversion needed - just use MCPEdgeExecutable directly
export const getMCPInstances = (instances: MCPEdgeExecutable[]): MCPEdgeExecutable[] => {
  return instances;
};