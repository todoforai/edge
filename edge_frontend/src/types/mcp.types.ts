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
  registryId: string;
  command: string;
  args?: string[];
  env?: MCPEnv;
}

export interface MCPRegistry extends MCPJSON {
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
  serverId: string;
  tools?: MCPToolSkeleton[];
  status?: string; // Add status field
}

export type MCPEdgeExecutable = InstalledMCP;

// Types for MCP content responses
export interface TextContent {
  type: 'text';
  text: string;
  annotations?: any;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64
  mimeType: string;
  annotations?: any;
}

export interface AudioContent {
  type: 'audio';
  data: string; // base64
  mimeType: string;
  annotations?: any;
}

// NEW: support for MCP "resource" content
export interface ResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    blob?: string; // base64
  };
  annotations?: any;
}

// Basically this is for uploaded attachments (for later)
export interface MCPAttachment {
  type: 'text' | 'image' | 'audio' | 'resource';
  text?: string; // text contents are stored raw in the block
  attachmentId?: string; // MCP attachment id
}

export type MCPContent = TextContent | ImageContent | AudioContent | ResourceContent | MCPAttachment;