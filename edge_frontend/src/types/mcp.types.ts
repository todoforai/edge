import { AttachmentData } from "../../external_shared/REST_types";

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




/**
 * Convert MCP TextContent to AttachmentData
 */
export function textContentToAttachmentData(
  textContent: TextContent, 
): AttachmentData {
  return {
    id: `mcp_${Date.now()}`,
    originalName: `${textContent.type}_${Date.now()}.txt`,
    mimeType: textContent.type + '/mcp', // text/mcp
    content: textContent.text,
    fileSize: textContent.text.length,
    createdAt: Date.now(),
    status: 'NONE',
  };
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0));
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

/**
 * Convert MCP ImageContent to AttachmentData
 */
export function imageContentToAttachmentData(
  imageContent: ImageContent,
): AttachmentData {
  const blob = base64ToBlob(imageContent.data, imageContent.mimeType);
  
  return {
    id: `mcp_${Date.now()}`,
    originalName: `${imageContent.type}_${Date.now()}.png`,
    mimeType: imageContent.mimeType,
    blob,
    fileSize: blob.size,
    createdAt: Date.now(),
    status: 'NONE',
  };
}

/**
 * Convert MCP AudioContent to AttachmentData
 */
export function audioContentToAttachmentData(
  audioContent: AudioContent,
): AttachmentData {
  const blob = base64ToBlob(audioContent.data, audioContent.mimeType);
  
  return {
    id: `mcp_${Date.now()}`,
    originalName: `${audioContent.type}_${Date.now()}.wav`,
    mimeType: audioContent.mimeType,
    blob,
    fileSize: blob.size,
    createdAt: Date.now(),
    status: 'NONE',
  };
}

/**
 * Convert MCP ResourceContent to AttachmentData
 */
export function resourceContentToAttachmentData(
  resourceContent: ResourceContent,
): AttachmentData {
  const resourceData = JSON.stringify(resourceContent.resource);
  const blob = new Blob([resourceData], { type: 'mcp+application/json' });
    
  return {
    id: `mcp_${Date.now()}`,
    originalName: resourceContent.resource.uri.split('/').pop() || 'resource',
    mimeType: 'mcp+application/json',
    blob: blob,
    fileSize: blob.size,
    createdAt: Date.now(),
    status: 'NONE',
  };
}

/**
 * Convert any MCPContent to AttachmentData
 */
export function mcpContentToAttachmentData(
  mcpContent: MCPContent,
): AttachmentData | null {
  switch (mcpContent.type) {
    case 'text':
      return textContentToAttachmentData(mcpContent as TextContent);
    case 'image':
      return imageContentToAttachmentData(mcpContent as ImageContent);
    case 'audio':
      return audioContentToAttachmentData(mcpContent as AudioContent);
    case 'resource':
      return resourceContentToAttachmentData(mcpContent as ResourceContent);
    default:
      return null;
  }
}