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
  serverId: string; // MCP ID
  command: string; // made optional since it's not in API response
  args?: string[];
  env?: MCPEnv;
}
export type MCPRegistry = MCPJSON & {
  icon?: string | { dark: string; light: string };
  name?: string;
  description?: string;
    
  tools?: MCPToolSkeleton[];

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
};

export type InstalledMCP = MCPJSON & {  // somewhat STATIC MCP data that has to be stored in the cloud database and reloaded from there!
  id: string; 
};

export type MCPEdgeExecutable = InstalledMCP; // Simplified - no status needed

export interface EdgeData {
  id: string;
  name: string;
  workspacepaths: string[];
  installedMCPs: Record<string, InstalledMCP>;
  mcp_json?: Record<string, any>; // Add raw MCP JSON config
  ownerId: string;
  status: EdgeStatus;
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

