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


export type InstalledMCP = MCPJSON & {  // somewhat STATIC MCP data that has to be stored in the cloud database and reloaded from there!
  id: string; 
  installed: boolean; // always true... as if it's not installed, it's not in the list
  enabled: boolean;
};

export type MCPEdgeExecutable = InstalledMCP & {
  status: MCPRunningStatus;
  results?: any;
  error?: string;
};

export interface EdgeData {
  id: string;
  name: string;
  ownerId: string;
  status: EdgeStatus;
  installedMCPs: Record<string, InstalledMCP>; // Changed from MCPinstances to installedMCPs
  workspacepaths: string[];
  isShellEnabled: boolean;
  isFileSystemEnabled: boolean;
  createdAt: number;
}
export interface MCPEdgesSettings {
  [edgeId: string]: MCPSettings;
}
export interface MCPSettings {
   [serverId: string]: ServerSettings;
}
export type ServerSettings = {
  isActive?: boolean;
  [key: string]: any;
} & {
  [K in string as K extends 'isActive' ? never : K]: ToolConfiguration | undefined;
};

export interface ToolConfiguration {
  isActive?: boolean;
  // env, conf, and other configurable properties can be added here
  [configKey: string]: any;
}

