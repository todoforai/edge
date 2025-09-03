export enum MCPRunningStatus {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
  UNINSTALLED = 'UNINSTALLED',
  INSTALLED = 'INSTALLED',
  INSTALLING = 'INSTALLING',
  STARTING = 'STARTING',
  CRASHED = 'CRASHED',
  READY = 'READY',
}

export interface MCPToolSkeleton {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPEnv {
  [envName: string]: any;
}

export interface MCPJSON {
  command: string;
  args?: string[];
  env?: MCPEnv;
}

export interface MCPRegistry extends MCPJSON {
  registryId?: string;
  icon?: string;
  name?: string;
  description?: string;
  tools?: MCPToolSkeleton[];
  category?: string[];
  aliases?: string[];
  repository?: {
    url: string;
    source: string;
    id: string;
  };
  version_detail?: {
    version: string;
    release_date: string;
    is_latest: boolean;
  };
  setup?: {
    instructions?: string;
  };
}

export interface InstalledMCP extends MCPJSON {
  id?: string;
  registryId?: string; // Only if we are creating it.
  serverId: string;
  tools?: MCPToolSkeleton[];
  status?: string; // Add status field
}

export type MCPEdgeExecutable = InstalledMCP;