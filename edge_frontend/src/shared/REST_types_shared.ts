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
export interface MCPRegistry {
  id: string; // MCP ID
  name: string;
  description: string;
  command?: string; // made optional since it's not in API response
  args?: string[];
  icon?: string | { dark: string; light: string };
  
  tools?: MCPToolSkeleton[];
  env?: string[]; // list of ENV keys
  conf?: string[]; // list of CONFIGUREABELE keys

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

export interface MCPInstance {
  id: string;
  serverId: string; // could be MCPRegistry.name 99% of the time...
  MCPRegistryID?: string;

  tools: MCPToolSkeleton[];
  env: MCPEnv;
  conf: MCPEnv;
  
  session: MCPSession; // TODO: support multiple sessions later on
  enabled: boolean;
}

export interface MCPSession {
  id: string;
  MCPInstanceID: string;
  status: MCPRunningStatus;
  results?: any;
  error?: string;
}

export interface EdgeData {
  id: string;
  name: string;
  ownerId: string;
  status: EdgeStatus;
  MCPs: MCPInstance[]; // Add this field
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

// export interface MCPServer {
//   id: string;
//   name: string;
//   status: MCPRunningStatus;
//   env: MCPEnv;
//   description: string;
//   command: string;
//   args: string[];
//   icon: string;
//   category: string;
// }
