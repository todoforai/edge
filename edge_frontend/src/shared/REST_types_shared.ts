
export type MCPRunningStatus = 'RUNNING' | 'STOPPED' | 'ERROR';

export enum EdgeStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}


export interface MCPToolSkeleton {
  name: string; // method name
  description: string;
  inputSchema: any;
}
export interface MCPClientSkeleton {
  serverId: string;
  tools: MCPToolSkeleton[];
  env: string[]; // required environment variables
}

// Add this new interface for MCP configuration
export interface MCPEnv {
  isActive: boolean;
  [envName: string]: any; // For any additional properties
}
export interface MCPdata {
  [serverId: string]: MCPEnv;
}

export interface EdgeMCP {
  serverId: string;
  tools: MCPToolSkeleton[];
  env: MCPEnv;
  config: MCPEnv;
  enabled: boolean;
  status: MCPRunningStatus;
  error?: string;
}

export interface EdgeData {
  id: string;
  name: string;
  ownerId: string;
  status: EdgeStatus;
  workspacepaths: string[];
  MCPs: EdgeMCP[]; // Add this field
  isShellEnabled: boolean;
  isFileSystemEnabled: boolean;
  createdAt: number;
}