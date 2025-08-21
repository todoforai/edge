export enum MCPRunningStatus {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
  UNINSTALLED = 'UNINSTALLED',
  INSTALLED = 'INSTALLED',
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
  serverId: string;
  command: string;
  args?: string[];
  env?: MCPEnv;
}

export interface MCPRegistry extends MCPJSON {
  icon?: string | { dark: string; light: string };
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
}

export interface InstalledMCP extends MCPJSON {
  id?: string;
  tools?: MCPToolSkeleton[];
}

export type MCPEdgeExecutable = InstalledMCP;