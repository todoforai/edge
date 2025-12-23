import { assertExhaustive } from '../../external_shared/attachmentUtils';

export type AttachmentStatus = 'NEW' | 'UPDATED' | 'DELETED' | 'NONE';

export interface AttachmentFrame {
  id: string;
  originalName: string;
  uri?: string;
  mimeType?: string; // MIME type
  createdAt?: number;
  isPublic?: boolean;
  fileSize: number;
  status?: AttachmentStatus;
}

export interface AttachmentData extends AttachmentFrame {
  blob: Blob; // Always use blob for content - use blob.text() for text content
}

export interface AttachmentDataRaw extends AttachmentFrame {
  content: string; 
}

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
  uri?: string; // Add this
  annotations?: any;
}

export interface ResourceContent {
  type: 'resource';
  resource: { uri: string; mimeType?: string; text: string } | { uri: string; mimeType?: string; blob: string };
  annotations?: any;
}

// Basically this is for uploaded attachments (for later)
export interface MCPAttachment {
  type: 'text' | 'image' | 'audio' | 'resource';
  text?: string; // text contents are stored raw in the block
  attachmentId?: string; // MCP attachment id
}

export type MCPContent = TextContent | ImageContent | AudioContent | ResourceContent | MCPAttachment;

export interface CallToolResult {
  content: MCPContent[];
  isError?: boolean;
}

/**
 * Convert MCP TextContent to AttachmentData
 */
export function textContentToAttachmentData(
  textContent: TextContent,
  toolName?: string,
  timestamp?: string,
  index?: number
): AttachmentData {
  // Text content has no URI, use fallback naming
  let originalName: string;
  if (toolName && timestamp && index !== undefined) {
    originalName = `${toolName}_${timestamp}_${index}.txt`;
  } else {
    originalName = `text_${Date.now()}.txt`;
  }
  
  return {
    id: `mcp_${Date.now()}`,
    originalName,
    mimeType: 'text/mcp',
    blob: new Blob([textContent.text], { type: 'text/mcp' }),
    fileSize: textContent.text.length,
    createdAt: Date.now(),
    status: 'NONE',
  };
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = Array.from(byteCharacters, (char) => char.charCodeAt(0));
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

/**
 * Convert MCP ImageContent to AttachmentData
 */
export function imageContentToAttachmentData(
  imageContent: ImageContent,
  toolName?: string,
  timestamp?: string,
  index?: number
): AttachmentData {
  const blob = base64ToBlob(imageContent.data, imageContent.mimeType);
  const extension = imageContent.mimeType.split('/')[1] || 'png';

  // Generate filename with toolName and timestamp if provided
  let originalName: string;
  if (toolName && timestamp && index !== undefined) {
    originalName = `${toolName}_${timestamp}_${index}.${extension}`;
  } else {
    originalName = `image_${Date.now()}.${extension}`;
  }

  return {
    id: `mcp_${Date.now()}`,
    originalName,
    mimeType: imageContent.mimeType, // 'image/mcp',
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
  toolName?: string,
  timestamp?: string,
  index?: number
): AttachmentData {
  const blob = base64ToBlob(audioContent.data, audioContent.mimeType);
  const extension = audioContent.mimeType.split('/')[1] || 'wav';

  // Prioritize URI-based naming first
  let originalName: string;
  if (audioContent.uri) {
    const uriName = audioContent.uri.split('/').pop() || '';
    originalName = uriName && uriName.includes('.') ? uriName : `audio.${extension}`;
  } else if (toolName && timestamp && index !== undefined) {
    originalName = `${toolName}_${timestamp}_${index}.${extension}`;
  } else {
    originalName = `audio_${Date.now()}.${extension}`;
  }

  return {
    id: `mcp_${Date.now()}`,
    originalName,
    mimeType: 'audio/mcp',
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
  toolName?: string,
  timestamp?: string,
  index?: number
): AttachmentData {
  const resource = resourceContent.resource;
  const uriName = resource.uri?.split('/').pop() || '';
  const mime = resource.mimeType || 'application/octet-stream';

  // Prioritize URI-based naming FIRST
  let originalName: string;
  if (uriName && uriName.includes('.')) {
    // Use URI filename if it has extension
    originalName = uriName;
  } else if (uriName) {
    // URI exists but no extension, infer from mime type
    const ext = mime.includes('/') ? mime.split('/')[1] : 'bin';
    originalName = `${uriName}.${ext}`;
  } else if (toolName && timestamp && index !== undefined) {
    // Fallback to toolName/timestamp/index if no URI
    const ext = mime.includes('/') ? mime.split('/')[1] : 'bin';
    originalName = `${toolName}_${timestamp}_${index}.${ext}`;
  } else {
    // Last resort fallback
    const ext = mime.includes('/') ? mime.split('/')[1] : 'bin';
    originalName = `resource_${Date.now()}.${ext}`;
  }

  // Handle text resource
  if ('text' in resource && resource.text !== undefined) {
    return {
      id: `mcp_${Date.now()}`,
      originalName,
      mimeType: `resource/mcp+${mime}`, // Preserve original MIME type with MCP prefix
      uri: resource.uri, // Preserve URI
      blob: new Blob([resource.text], { type: mime }),
      fileSize: resource.text.length,
      createdAt: Date.now(),
      status: 'NONE',
    };
  } else if ('blob' in resource && resource.blob !== undefined) {
    const blob = base64ToBlob(resource.blob, mime);

    return {
      id: `mcp_${Date.now()}`,
      originalName,
      mimeType: `resource/mcp+${mime}`, // Preserve original MIME type with MCP prefix
      uri: resource.uri, // Preserve URI
      blob,
      fileSize: blob.size,
      createdAt: Date.now(),
      status: 'NONE',
    };
  } else {
    // Fallback for URI-only resources
    return {
      id: `mcp_${Date.now()}`,
      originalName: originalName.endsWith('.txt') ? originalName : `${originalName}.txt`,
      mimeType: `resource/mcp+${mime}`, // Preserve original MIME type with MCP prefix
      uri: resource.uri, // Preserve URI
      blob: new Blob([], { type: mime }),
      fileSize: 0,
      createdAt: Date.now(),
      status: 'NONE',
    };
  }
}

/**
 * Convert any MCPContent to AttachmentData
 */
export function mcpContentToAttachmentData(mcpContent: MCPContent, toolName?: string, timestamp?: string, index?: number): AttachmentData {
  switch (mcpContent.type) {
    case 'text':
      return textContentToAttachmentData(mcpContent as TextContent, toolName, timestamp, index);
    case 'image':
      return imageContentToAttachmentData(mcpContent as ImageContent, toolName, timestamp, index);
    case 'audio':
      return audioContentToAttachmentData(mcpContent as AudioContent, toolName, timestamp, index);
    case 'resource':
      return resourceContentToAttachmentData(mcpContent as ResourceContent, toolName, timestamp, index);
    default:
      assertExhaustive(mcpContent);
  }
}

