export enum MCPRunningStatus {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
  UNINSTALLED = 'UNINSTALLED',
  INSTALLED = 'INSTALLED',
}

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
export interface HardCodedMCP {
  mcpId: string;
  name: string;
  tools: MCPToolSkeleton[];
  description: string;
  command: string;
  args: string[];
  icon: string;
  category: string;
}
export interface EdgeMCP {
  serverId: string;
  status: MCPRunningStatus;
  tools: MCPToolSkeleton[];
  env: MCPEnv;
  config: MCPEnv;
  enabled: boolean;
  error?: string;
}

export interface EdgeData {
  edgeId: string;
  ownerId: string;
  name: string;
  status: EdgeStatus;
  MCPs: EdgeMCP[]; // Add this field
  workspacepaths: string[];
  isShellEnabled: boolean;
  isFileSystemEnabled: boolean;
  createdAt: number;
}

export interface MCPServer {
  id: string;
  name: string;
  env: Record<string, string>;
  status: MCPRunningStatus;
  description: string;
  command: string;
  args: string[];
  icon: string;
  category: string;
}
