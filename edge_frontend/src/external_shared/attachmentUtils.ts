import type { AttachmentData, AttachmentFrame } from '../edge/types';

// ===== CENTRALIZED ATTACHMENT TYPE SYSTEM =====
export enum AttachmentType {
  IMAGE = 'image',
  AUDIO = 'audio', 
  VIDEO = 'video',
  PDF = 'pdf',
  DOCUMENT = 'document', // Word, PowerPoint, etc.
  SPREADSHEET = 'spreadsheet', // Excel, CSV
  TEXT = 'text', // Plain text, code files
  ARCHIVE = 'archive', // ZIP, RAR, etc.
  UNKNOWN = 'unknown',
  // MCP-specific types
  MCP_TEXT = 'mcp_text',
  MCP_IMAGE = 'mcp_image', // note we actually convert it to IMAGE type... maybe TODO to keep it?
  MCP_AUDIO = 'mcp_audio',
  MCP_RESOURCE = 'mcp_resource',
  // Business context snapshot
  BUSINESS_CONTEXT = 'business_context'
}

/**
 * Determines MIME type from file extension
 */
export function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'json': 'application/json',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'html': 'text/html',
    'css': 'text/css',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'csv': 'text/csv',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'zip': 'application/zip',
    'xml': 'text/xml',
    'py': 'text/x-python',
    'java': 'text/x-java-source',
    'cpp': 'text/x-c++src',
    'c': 'text/x-csrc',
    'h': 'text/x-chdr',
    'doc': 'application/msword',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'rar': 'application/vnd.rar',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    '7z': 'application/x-7z-compressed',
    'yml': 'text/yaml',
    'yaml': 'text/yaml',
  };
  return mimeTypes[ext || ''] || '';
}

// Constants for text-based application MIME types
const TEXT_APPLICATION_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/typescript',
  'application/x-typescript',
  'application/yaml',
  'application/x-yaml',
  // Support both text/x-* and application/x-* variants
  'application/x-python',
  'text/x-python',
  'application/x-java-source',
  'text/x-java-source',
  'application/x-c++src',
  'text/x-c++src',
  'application/x-csrc',
  'text/x-csrc',
  'application/x-chdr',
  'text/x-chdr'
]);

/**
 * Extract original MIME type from MCP resource format (resource/mcp+original)
 */
export function extractMimeTypeFromMcpResource(mimeType?: string): string {
  if (!mimeType) return '';
  if (mimeType.startsWith('resource/mcp+')) return mimeType.substring(13); // Remove 'resource/mcp+' prefix
  return mimeType;
}

/**
 * Check if a MIME type represents a text-based file
 */
export function isTextMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  
  const mime = mimeType.toLowerCase();
  
  // Direct text MIME types
  if (mime.startsWith('text/')) return true;
  
  // Handle MCP text types
  if (mime === 'text/mcp') return true;
  
  // ✅ Handle MCP resource types that contain text
  if (mime.startsWith('resource/mcp+')) {
    const originalMimeType = extractMimeTypeFromMcpResource(mime);
    return isTextMimeType(originalMimeType);
  }
  
  // Check against known text application types
  return TEXT_APPLICATION_TYPES.has(mime);
}


/**
 * Check if a MIME type represents an image file
 */
export function isImageMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  return mimeType.toLowerCase().startsWith('image/');
}

/**
 * Check if a MIME type represents an audio file
 */
export function isAudioMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  return mimeType.toLowerCase().startsWith('audio/');
}

/**
 * Check if a MIME type represents a video file
 */
export function isVideoMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  return mimeType.toLowerCase().startsWith('video/');
}

/**
 * Check if a MIME type represents a PDF file
 */
export function isPdfMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  return mimeType.toLowerCase() === 'application/pdf';
}

/**
 * Check if a MIME type represents a document file (Word, PowerPoint)
 */
export function isDocumentMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return mime.includes('word') || 
         mime.includes('powerpoint') || 
         mime.includes('presentation');
}

/**
 * Check if a MIME type represents a DOCX file specifically
 */
export function isDocxMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return mime.includes('wordprocessingml') || 
         mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

/**
 * Check if a MIME type represents a spreadsheet file (Excel, CSV)
 */
export function isSpreadsheetMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return mime.includes('excel') || 
         mime.includes('sheet') || 
         mime === 'text/csv';
}

/**
 * Check if a MIME type represents an archive file
 */
export function isArchiveMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return mime.includes('zip') || 
         mime.includes('rar') || 
         mime.includes('tar') ||
         mime.includes('gzip') ||
         mime.includes('7z');
}

/**
 * Check if a MIME type represents a specific MCP type
 */
function isMcpMimeType(mimeType: string | undefined, type: string): boolean {
  return mimeType?.toLowerCase() === type;
}

/**
 * Check if a MIME type represents an MCP text file
 */
export function isMcpTextMimeType(mimeType?: string): boolean {
  return isMcpMimeType(mimeType, 'text/mcp');
}

/**
 * Check if a MIME type represents an MCP image file
 */
export function isMcpImageMimeType(mimeType?: string): boolean {
  return isMcpMimeType(mimeType, 'image/mcp');
}

/**
 * Check if a MIME type represents an MCP audio file
 */
export function isMcpAudioMimeType(mimeType?: string): boolean {
  return isMcpMimeType(mimeType, 'audio/mcp');
}

/**
 * Check if a MIME type represents an MCP resource file
 */
export function isMcpResourceMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  return mimeType.toLowerCase().startsWith('resource/mcp+');
}

/**
 * Check if a MIME type represents a business context attachment
 */
export function isBusinessContextMimeType(mimeType?: string): boolean {
  return mimeType?.toLowerCase() === 'application/x-business-context+json';
}

/**
 * Get MIME type with fallback to filename-based detection
 */
function getMimeTypeWithFallback(fileName: string, mimeType?: string): string {
  return mimeType || (fileName ? getMimeTypeFromFilename(fileName) : '');
}

/**
 * Determines the attachment type based on MIME type and filename
 */
export function getAttachmentType(attachment: AttachmentFrame): AttachmentType {
  const mimeType = attachment.mimeType?.toLowerCase();
  const fileName = attachment.originalName?.toLowerCase() || '';

  return getAttachmentTypeMCP(fileName, mimeType);
}

export function getAttachmentTypeMCP(fileName: string, mimeType?: string): AttachmentType {
  
  // Business context (check first)
  if (isBusinessContextMimeType(mimeType))     return AttachmentType.BUSINESS_CONTEXT;
  
  // MCP-specific content types
  if (isMcpTextMimeType(mimeType))             return AttachmentType.MCP_TEXT;
  if (isMcpImageMimeType(mimeType))            return AttachmentType.MCP_IMAGE;
  if (isMcpAudioMimeType(mimeType))            return AttachmentType.MCP_AUDIO;
  if (isMcpResourceMimeType(mimeType))         return AttachmentType.MCP_RESOURCE;

  // Use the direct type detection for everything else
  return getAttachmentTypeDirectly(fileName, mimeType);
}

export function getAttachmentTypeDirectly(fileName: string, mimeType?: string): AttachmentType {
  const resolvedMimeType = getMimeTypeWithFallback(fileName, mimeType);
  
  if (isImageMimeType(resolvedMimeType))       return AttachmentType.IMAGE;
  if (isAudioMimeType(resolvedMimeType))       return AttachmentType.AUDIO;
  if (isVideoMimeType(resolvedMimeType))       return AttachmentType.VIDEO;
  if (isPdfMimeType(resolvedMimeType))         return AttachmentType.PDF;
  if (isDocumentMimeType(resolvedMimeType))    return AttachmentType.DOCUMENT;
  if (isSpreadsheetMimeType(resolvedMimeType)) return AttachmentType.SPREADSHEET;
  if (isTextMimeType(resolvedMimeType))        return AttachmentType.TEXT;
  if (isArchiveMimeType(resolvedMimeType))     return AttachmentType.ARCHIVE;
  return AttachmentType.UNKNOWN;
}

/**
 * Get appropriate icon for attachment type
 */
export function getAttachmentIcon(type: AttachmentType): string {
  switch (type) {
    case AttachmentType.IMAGE:
      return 'mdi:file-image-outline';
    case AttachmentType.AUDIO:
      return 'mdi:file-music-outline';
    case AttachmentType.VIDEO:
      return 'mdi:file-video-outline';
    case AttachmentType.PDF:
      return 'mdi:file-pdf-box-outline';
    case AttachmentType.DOCUMENT:
      return 'mdi:file-word-outline';
    case AttachmentType.SPREADSHEET:
      return 'mdi:file-excel-outline';
    case AttachmentType.TEXT:
      return 'mdi:file-code-outline';
    case AttachmentType.ARCHIVE:
      return 'mdi:file-zip-outline';
    // MCP-specific icons
    case AttachmentType.MCP_TEXT:
      return 'mdi:robot-outline';
    case AttachmentType.MCP_IMAGE:
      return 'mdi:robot-outline';
    case AttachmentType.MCP_AUDIO:
      return 'mdi:robot-outline';
    case AttachmentType.MCP_RESOURCE:
      return 'mdi:cloud-outline';
    case AttachmentType.BUSINESS_CONTEXT:
      return 'mdi:briefcase-outline';
    case AttachmentType.UNKNOWN:
    default:
      return 'mdi:file-outline';
  }
}

/**
 * Get appropriate icon for attachment based on its data
 * This is a convenience function that determines the type first, then gets the icon
 */
export function getAttachmentIconFromData(attachment: AttachmentData): string {
  const attachmentType = getAttachmentType(attachment);
  return getAttachmentIcon(attachmentType);
}

/**
 * Get appropriate icon for MCP resource attachment
 * Handles the special case where MCP resources might have specific MIME types
 * but should still show content type icons when possible
 */
export function getMCPResourceIcon(attachment: AttachmentFrame): string {
  // For MCP resources, show the content type icon if we can determine it
  const attachmentType = getAttachmentType(attachment);
  
  // If we got a specific content type (not MCP_RESOURCE), use it
  if (attachmentType !== AttachmentType.MCP_RESOURCE) {
    return getAttachmentIcon(attachmentType);
  }
  
  // Try to extract content type from MCP resource prefix
  if (isMcpResourceMimeType(attachment.mimeType)) {
    const originalMimeType = extractMimeTypeFromMcpResource(attachment.mimeType);
    const virtualType = getAttachmentTypeDirectly(attachment.originalName || '', originalMimeType);
    if (virtualType !== AttachmentType.UNKNOWN) {
      return getAttachmentIcon(virtualType);
    }
  }
  
  // Fallback to MCP resource icon
  return getAttachmentIcon(AttachmentType.MCP_RESOURCE);
}

/**
 * Get color for attachment type (for FileUploadPreview compatibility)
 */
export function getAttachmentColor(type: AttachmentType): 'red' | 'green' | 'blue' | 'yellow' | 'white' | 'purple' | 'grey' {
  switch (type) {
    case AttachmentType.PDF:
      return 'red';
    case AttachmentType.SPREADSHEET:
      return 'green';
    case AttachmentType.DOCUMENT:
      return 'blue';
    case AttachmentType.IMAGE:
    case AttachmentType.VIDEO:
      return 'yellow';
    case AttachmentType.TEXT:
      return 'white';
    case AttachmentType.ARCHIVE:
      return 'purple';
    // MCP-specific colors
    case AttachmentType.MCP_TEXT:
      return 'purple'; // Purple to indicate MCP origin
    case AttachmentType.MCP_IMAGE:
      return 'purple';
    case AttachmentType.MCP_AUDIO:
      return 'purple';
    case AttachmentType.MCP_RESOURCE:
      return 'purple';
    case AttachmentType.BUSINESS_CONTEXT:
      return 'blue';
    case AttachmentType.AUDIO:
    case AttachmentType.UNKNOWN:
    default:
      return 'grey';
  }
}

/**
 * Check if attachment type needs object URL for display
 */
export function needsObjectUrl(type: AttachmentType): boolean {
  return [
    AttachmentType.IMAGE,
    AttachmentType.AUDIO,
    AttachmentType.VIDEO,
    AttachmentType.PDF,
    // MCP types that need object URLs
    AttachmentType.MCP_IMAGE,
    AttachmentType.MCP_AUDIO
  ].includes(type);
}

/**
 * Extract display text from URI for UI purposes
 */
export function getUriDisplayText(uri: string): string {
  try {
    if (uri.startsWith('file://')) {
      // For file URIs, show just the filename or last part of path
      const path = uri.replace('file://', '');
      const filename = path.split('/').pop() || path;
      return `📁 ${filename}`;
    }
    
    const url = new URL(uri);
    return url.hostname + (url.pathname !== '/' ? url.pathname : '');
  } catch {
    // If not a valid URL, show first 50 chars
    return uri.length > 50 ? uri.substring(0, 50) + '...' : uri;
  }
}

/**
 * Exhaustiveness helper to ensure all enum cases are handled in switch statements
 */
export function assertExhaustive(x: never): never {
  throw new Error('Unhandled case: ' + x);
}

