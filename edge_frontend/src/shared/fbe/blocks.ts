import { CreateFileResult } from './enums';
import type { AttachmentFrame } from './attachmentTypes';

export enum BlockType {
  TEXT = 'TEXT',
  SHELL = 'SHELL',
  CATFILE = 'CATFILE',
  UNIVERSAL = 'UNIVERSAL',
  CREATE = 'CREATE',
  MODIFY = 'MODIFY',
  SENDKEY = 'SENDKEY',
  WEBSEARCH = 'WEBSEARCH',
  WORKSPACE_SEARCH = 'WORKSPACE_SEARCH',
  CREATE_TODO = 'CREATE_TODO',
  CLICK = 'CLICK',
  EMAIL = 'EMAIL',
  ERROR = 'ERROR',
  MCP = 'MCP',
  WEBCONTENT = 'WEBCONTENT',
  GOOGLERAG = 'GOOGLERAG',
  GITINGEST = 'GITINGEST',
  REQUEST_MCP_ACCESS = 'REQUEST_MCP_ACCESS',
  UPDATE_AGENT_SETTINGS = 'UPDATE_AGENT_SETTINGS',
  IMAGE_GEN = 'IMAGE_GEN',
  CREATE_PROJECT = 'CREATE_PROJECT',
  EDGE_NOT_RUNNING = 'EDGE_NOT_RUNNING',
  BROWSER = 'BROWSER', // Add browser block type
  DOWNLOAD = 'DOWNLOAD',
  REASON = 'REASON',
  BUSINESS_CONTEXT = 'BUSINESS_CONTEXT',
  TODOforAI_API = 'TODOforAI_API',
}

export enum BlockStatus {
  PENDING = 'PENDING',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  PROCESSING = 'PROCESSING',
  IN_PROGRESS = 'IN_PROGRESS',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  DENIED = 'DENIED',
  ERROR = 'ERROR',
}

export interface RunMeta {
  cost: number;
  type?: string;
  description?: string;
  timestamp: number;
  elapsed?: number;
  extras?: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
}

export interface RunResult {
  attachments: AttachmentFrame[];
  meta: Record<string, any>;
}

export interface BaseBlock {
  id: string;
  type: BlockType;
  content: string;
  status?: BlockStatus;
  result?: string;

  results?: RunResult[];

  // Unified metadata tracking (block-level)
  runMeta?: RunMeta[];
}

export interface CreateFileBlock extends BaseBlock {
  type: BlockType.CREATE;
  file_path: string;
  language?: string;
  result: CreateFileResult;
}

export interface ModifyFileBlock extends BaseBlock {
  type: BlockType.MODIFY;
  file_path: string;
  language?: string;
  originalContent?: string;
  initialOriginalContent?: string; // Store the initial original content for potential reversion
  modifiedContent?: string;
}

export interface ShellBlock extends BaseBlock {
  type: BlockType.SHELL;
  language?: string;
}

export interface TextBlock extends BaseBlock {
  type: BlockType.TEXT;
}

export interface EmailBlock extends BaseBlock {
  type: BlockType.EMAIL;
  to: string;
  subject: string;
}

export interface ClickBlock extends BaseBlock {
  type: BlockType.CLICK;
  x: number;
  y: number;
  button?: string;
}

export interface CatFileBlock extends BaseBlock {
  type: BlockType.CATFILE;
  file_path: string;
}

export interface DownloadBlock extends BaseBlock {
  type: BlockType.DOWNLOAD;
  attachment_id: string;
  file_path: string;
}

export interface UniversalBlock extends BaseBlock {
  type: BlockType.UNIVERSAL;
  title: string;
}

export interface WorkspaceSearchBlock extends BaseBlock {
  type: BlockType.WORKSPACE_SEARCH;
  query: string;
}

export interface ErrorBlock extends BaseBlock {
  type: BlockType.ERROR;
}

export interface MCPBlock extends BaseBlock {
  // TODO: STANDARDIZE with server_id and registryId
  type: BlockType.MCP;
  server_name: string;
  method: string;
}

export interface WebContentBlock extends BaseBlock {
  type: BlockType.WEBCONTENT;
  url: string;
}

export interface GoogleRagBlock extends BaseBlock {
  type: BlockType.GOOGLERAG;
  query: string;
}

export interface GitingestBlock extends BaseBlock {
  type: BlockType.GITINGEST;
  url: string;
}

export interface RequestMCPAccessBlock extends BaseBlock {
  type: BlockType.REQUEST_MCP_ACCESS;
  title?: string;
  mcp?: string;
  tool_name?: string;
}

export interface CreateTodoBlock extends BaseBlock {
  type: BlockType.CREATE_TODO;
}

export interface UpdateAgentSettingsBlock extends BaseBlock {
  type: BlockType.UPDATE_AGENT_SETTINGS;
  settings?: Record<string, any>;
  tool_name?: string;
}
export interface BrowserBlock extends BaseBlock {
  type: BlockType.BROWSER;
  tool_name: string;
}

export interface ImageGenBlock extends BaseBlock {
  type: BlockType.IMAGE_GEN;
  model?: string;
  // images?: Array<{
  //   id: string;
  //   data: string;
  //   mime_type: string;
  // }>;
  attachmentIds?: string[];
  // User ID who generated the images (may be added at runtime)
  userId?: string;
}

export interface ReasonBlock extends BaseBlock {
  type: BlockType.REASON;
}

export interface BusinessContextBlock extends BaseBlock {
  type: BlockType.BUSINESS_CONTEXT;
  tool_name: string;
}

export interface CreateProjectBlock extends BaseBlock {
  type: BlockType.CREATE_PROJECT;
  tool_name?: string;
}

export interface TODOforAIApiBlock extends BaseBlock {
  type: BlockType.TODOforAI_API;
  name: string;
}

export type MessageBlock =
  | TextBlock
  | ShellBlock
  | CatFileBlock
  | DownloadBlock
  | UniversalBlock
  | CreateFileBlock
  | ModifyFileBlock
  | ClickBlock
  | EmailBlock
  | WorkspaceSearchBlock
  | CreateTodoBlock
  | ErrorBlock
  | MCPBlock
  | WebContentBlock
  | GoogleRagBlock
  | GitingestBlock
  | UpdateAgentSettingsBlock
  | RequestMCPAccessBlock
  | ImageGenBlock
  | BrowserBlock
  | ReasonBlock
  | BusinessContextBlock
  | CreateProjectBlock
  | TODOforAIApiBlock;
