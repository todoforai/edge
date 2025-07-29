export enum MCPRunningStatus {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
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
export interface MCPEnv {
  [envName: string]: any;
}

// kéne bele még konfigurálhatóság RAG vagy nem RAg... workflow... start
export interface MCPJSON {
  serverId?: string; // MCP ID
  name?: string;
  description?: string;
  command?: string; // made optional since it's not in API response
  args?: string[];
  icon?: string | { dark: string; light: string };
  
  tools?: MCPToolSkeleton[];
  env?: MCPEnv;
  conf?: MCPEnv;

  category?: string[];
  
  // New fields from API response
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
export type MCPInstance = MCPJSON & {
  id: string; 
  installed: boolean; // always true... as if it's not installed, it's not in the list
  enabled: boolean;
  results?: any;
  error?: string;
};
export type MCPEdgeExecutable = MCPInstance & {
  status: MCPRunningStatus;
};

export interface EdgeData {
  id: string;
  name: string;
  ownerId: string;
  status: EdgeStatus;
  MCPinstances: MCPInstance[]; // Add this field
  workspacepaths: string[];
  isShellEnabled: boolean;
  isFileSystemEnabled: boolean;
  createdAt: number;
}
export interface MCPEdgesSettings {
  edgeSettings?: { [edgeId: string]: MCPSettings };
}
export interface MCPSettings {
  serverSettings?: { [serverId: string]: ServerSettings };
}
export interface ServerSettings {
  isActive?: boolean;
  toolSettings?: { [toolName: string]: ToolConfiguration };
}

export interface ToolConfiguration {
  isActive?: boolean;
  // env, conf, and other configurable properties can be added here
  [configKey: string]: any;
}

