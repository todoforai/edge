export type AttachmentStatus = 'NEW' | 'UPDATED' | 'DELETED' | 'NONE';

/**
 * Base attachment metadata type - reference only, no content.
 * URI is always required and is the source of truth reference.
 * Format: "todoforai://attachment/{id}"
 */
export interface AttachmentFrame {
  id: string;
  /** Resource URI - always required. Format: "todoforai://attachment/{id}" */
  uri: string;
  originalName: string;
  mimeType: string;
  /** In bytes */
  fileSize: number;
  createdAt?: number;
  isPublic?: boolean;
  status?: AttachmentStatus;
}

/** Attachment with binary content - for runtime processing */
export interface AttachmentData extends AttachmentFrame {
  data: Uint8Array;
}

/** Attachment with content - for JSON/WebSocket transport of existing attachments */
export interface AttachmentWire extends AttachmentFrame {
  /** Decoded text content (for text types). Mutually exclusive with contentBase64. */
  content?: string;
  /** Pure base64-encoded content for binary types like images (no data URL prefix). Mutually exclusive with content. */
  contentBase64?: string;
}

/**
 * For creating new attachments (agent -> backend).
 * No id/uri - backend assigns these after storage.
 */
export interface AttachmentWireCreate {
  originalName: string;
  mimeType: string;
  /** In bytes */
  fileSize: number;
  /** Pure base64-encoded content (no data URL prefix). Use mimeType field for MIME type. */
  contentBase64: string;
  status?: AttachmentStatus;
}
