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
// kéne bele még konfigurálhatóság RAG vagy nem RAg... workflow... start
export interface MCPRegistry {
  id: string; // MCP ID
  name: string;
  description: string;
  command: string;
  args?: string[];
  icon?: string | { dark: string; light: string };
  env?: string[]; // list of ENV keys
  conf?: string[]; // list of CONFIGUREABELE keys

  category?: string[];
}

export interface MCPEnv {
  [envName: string]: any;
}
export interface MCPInstance {
  id: string;
  serverId: string;
  MCPRegistryID: string;
  tools: MCPToolSkeleton[];
  env: MCPEnv;
  conf: MCPEnv;
  runs: MCPSession[];
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
export interface MCPEdgesConfig {
  [edgeId: string]: MCPServersConfig;
}
export interface MCPServersConfig {
  [serverId: string]: MCPConfig;
}
export interface MCPConfig {
  isActive: boolean;
  [toolName: string]: boolean | { // MCPToolSkeleton.name can be found here and see if it is enabled or not
    isActive: boolean;
  } | any; // env, env, env... anything can be configured (overwritten) by the agentsettings in the long term future...
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
