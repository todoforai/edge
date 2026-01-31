/**
 * Unified Block Architecture
 *
 * This module provides type-safe block definitions aligned with Julia tool names.
 * ToolType enum values match Julia @deftool function names exactly.
 */

import { CreateFileResult } from './enums';
import type { AttachmentFrame } from './attachmentTypes';

// =============================================================================
// ENUMS
// =============================================================================

/**
 * ToolType enum - aligned with Julia @deftool function names
 */
export enum ToolType {
  // === EDGE TOOLS ===
  Read = 'read',
  Create = 'create',
  Edit = 'edit',
  Bash = 'bash',
  Search = 'search',
  Download = 'download',

  // === BROWSER TOOLS (18) ===
  BrowserInteractable = 'browser_interactable',
  BrowserDomTree = 'browser_dom_tree',
  BrowserNavigate = 'browser_navigate',
  BrowserScreenshot = 'browser_screenshot',
  BrowserClick = 'browser_click',
  BrowserType = 'browser_type',
  BrowserFill = 'browser_fill',
  BrowserScroll = 'browser_scroll',
  BrowserMouseMove = 'browser_mouse_move',
  BrowserKey = 'browser_key',
  BrowserEvaluate = 'browser_evaluate',
  BrowserSelect = 'browser_select',
  BrowserHover = 'browser_hover',
  BrowserTextContent = 'browser_text_content',
  BrowserBack = 'browser_back',
  BrowserForward = 'browser_forward',
  BrowserReload = 'browser_reload',
  BrowserUploadFile = 'browser_upload_file',

  // === API TOOLS (24) ===
  ApiGetCurrentContext = 'api_get_current_context',
  ApiGetTodo = 'api_get_todo',
  ApiAddTodoMessage = 'api_add_todo_message',
  ApiUpdateTodoStatus = 'api_update_todo_status',
  ApiDeleteTodo = 'api_delete_todo',
  ApiListProjects = 'api_list_projects',
  ApiGetProject = 'api_get_project',
  ApiCreateProject = 'api_create_project',
  ApiListProjectTodos = 'api_list_project_todos',
  ApiCreateTodo = 'api_create_todo',
  ApiListAgents = 'api_list_agents',
  ApiGetAgent = 'api_get_agent',
  ApiUpdateAgent = 'api_update_agent',
  ApiListBusinessContexts = 'api_list_business_contexts',
  ApiGetBusinessContext = 'api_get_business_context',
  ApiGetContextItem = 'api_get_context_item',
  ApiCreateContextItem = 'api_create_context_item',
  ApiUpdateContextItem = 'api_update_context_item',
  ApiDeleteContextItem = 'api_delete_context_item',
  ApiListEdges = 'api_list_edges',
  ApiGetEdge = 'api_get_edge',
  ApiListMcps = 'api_list_mcps',
  ApiGetUsage = 'api_get_usage',
  ApiGetBalance = 'api_get_balance',
  ApiGetApiSchema = 'api_get_api_schema',

  // === CLOUD TOOLS ===
  ImageGen = 'image_gen',

  // === META TOOLS ===
  Text = 'text',
  Reason = 'reason',
  Error = 'error',
  Compact = 'compact',
  RequestMcpAccess = 'request_mcp_access',
  CreateProject = 'create_project',
  EdgeNotRunning = 'edge_not_running',

  // === EXTERNAL PACKAGE TOOLS ===
  WebContent = 'web_content',
  GoogleRag = 'google_rag',
  Gitingest = 'gitingest',
  WorkspaceSearch = 'workspace_search',
  WebSearch = 'web_search',

  // === DYNAMIC TOOLS ===
  Mcp = 'mcp',
}

/**
 * BlockStatus - lifecycle states
 */
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

// =============================================================================
// TOOL TYPE SETS
// =============================================================================

export const EDGE_TOOL_TYPES = new Set([
  ToolType.Read,
  ToolType.Create,
  ToolType.Edit,
  ToolType.Bash,
  ToolType.Search,
  ToolType.Download,
]);

export const BROWSER_TOOL_TYPES = new Set([
  ToolType.BrowserInteractable,
  ToolType.BrowserDomTree,
  ToolType.BrowserNavigate,
  ToolType.BrowserScreenshot,
  ToolType.BrowserClick,
  ToolType.BrowserType,
  ToolType.BrowserFill,
  ToolType.BrowserScroll,
  ToolType.BrowserMouseMove,
  ToolType.BrowserKey,
  ToolType.BrowserEvaluate,
  ToolType.BrowserSelect,
  ToolType.BrowserHover,
  ToolType.BrowserTextContent,
  ToolType.BrowserBack,
  ToolType.BrowserForward,
  ToolType.BrowserReload,
  ToolType.BrowserUploadFile,
]);

export const API_TOOL_TYPES = new Set([
  ToolType.ApiGetCurrentContext,
  ToolType.ApiGetTodo,
  ToolType.ApiAddTodoMessage,
  ToolType.ApiUpdateTodoStatus,
  ToolType.ApiDeleteTodo,
  ToolType.ApiListProjects,
  ToolType.ApiGetProject,
  ToolType.ApiCreateProject,
  ToolType.ApiListProjectTodos,
  ToolType.ApiCreateTodo,
  ToolType.ApiListAgents,
  ToolType.ApiGetAgent,
  ToolType.ApiUpdateAgent,
  ToolType.ApiListBusinessContexts,
  ToolType.ApiGetBusinessContext,
  ToolType.ApiGetContextItem,
  ToolType.ApiCreateContextItem,
  ToolType.ApiUpdateContextItem,
  ToolType.ApiDeleteContextItem,
  ToolType.ApiListEdges,
  ToolType.ApiGetEdge,
  ToolType.ApiListMcps,
  ToolType.ApiGetUsage,
  ToolType.ApiGetBalance,
  ToolType.ApiGetApiSchema,
]);

export const FILE_TOOL_TYPES = new Set([
  ToolType.Read,
  ToolType.Create,
  ToolType.Edit,
  ToolType.Download,
]);

// =============================================================================
// SHARED PROPS
// =============================================================================

export interface FileProps {
  file_path: string;
  language?: string;
}

export interface FileContentProps {
  // snake_case (new canonical names)
  original_content?: string;
  modified_content?: string;
  initial_original_content?: string;
  // camelCase (legacy aliases for backward compatibility)
  originalContent?: string;
  modifiedContent?: string;
  initialOriginalContent?: string;
}

export interface UrlProps {
  url: string;
}

export interface QueryProps {
  query: string;
}

export interface CoordinatesProps {
  x?: number;
  y?: number;
}

export interface SelectorProps {
  selector?: string;
}

export interface AttachmentProps {
  attachment_id?: string;
  attachment_ids?: string[];
}

export interface TitleProps {
  title?: string;
}

export interface ToolNameProps {
  tool_name?: string;
}

// =============================================================================
// BASE TYPES
// =============================================================================

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
  type: ToolType;
  content: string;
  status?: BlockStatus;
  result?: string;
  results?: RunResult[];
  runMeta?: RunMeta[];
}

// =============================================================================
// EDGE BLOCKS
// =============================================================================

export interface ReadBlock extends BaseBlock, FileProps {
  type: ToolType.Read;
  limit?: number;
  offset?: number;
}

export interface CreateBlock extends BaseBlock, FileProps {
  type: ToolType.Create;
  result?: CreateFileResult;
}

export interface EditBlock extends BaseBlock, FileProps, FileContentProps {
  type: ToolType.Edit;
}

export interface BashBlock extends BaseBlock {
  type: ToolType.Bash;
  command?: string;
  timeout?: number;
  language?: string;
}

export interface DownloadBlock extends BaseBlock, FileProps, AttachmentProps {
  type: ToolType.Download;
}

export interface SearchBlock extends BaseBlock {
  type: ToolType.Search;
  pattern?: string;
  path?: string;
  file_type?: string;
  ignore_case?: boolean;
  max_results?: number;
}

// =============================================================================
// BROWSER BLOCKS
// =============================================================================

export interface BrowserClickBlock extends BaseBlock, CoordinatesProps, SelectorProps {
  type: ToolType.BrowserClick;
  button?: string;
  force?: boolean;
}

export interface BrowserKeyBlock extends BaseBlock {
  type: ToolType.BrowserKey;
  key?: string;
  text?: string;
  action?: string;
  modifiers?: string[];
}

export interface BrowserNavigateBlock extends BaseBlock, UrlProps {
  type: ToolType.BrowserNavigate;
}

// =============================================================================
// META BLOCKS
// =============================================================================

export interface TextBlock extends BaseBlock {
  type: ToolType.Text;
}

export interface ReasonBlock extends BaseBlock {
  type: ToolType.Reason;
}

export interface ErrorBlock extends BaseBlock {
  type: ToolType.Error;
  error_message?: string;
  stacktrace?: string;
}

// =============================================================================
// EXTERNAL BLOCKS
// =============================================================================

export interface WebContentBlock extends BaseBlock, UrlProps {
  type: ToolType.WebContent;
}

export interface WebSearchBlock extends BaseBlock, QueryProps {
  type: ToolType.WebSearch;
}

export interface WorkspaceSearchBlock extends BaseBlock, QueryProps {
  type: ToolType.WorkspaceSearch;
}

export interface GoogleRagBlock extends BaseBlock, QueryProps {
  type: ToolType.GoogleRag;
}

export interface GitingestBlock extends BaseBlock {
  type: ToolType.Gitingest;
  url?: string;
  path?: string;
}

// =============================================================================
// CLOUD BLOCKS
// =============================================================================

export interface ImageGenBlock extends BaseBlock, AttachmentProps {
  type: ToolType.ImageGen;
  prompt?: string;
  model?: string;
  userId?: string;
  attachmentIds?: string[];
}

// =============================================================================
// DYNAMIC BLOCKS
// =============================================================================

export interface McpBlock extends BaseBlock, TitleProps, ToolNameProps {
  type: ToolType.Mcp;
  server_name: string;
  method: string;
  name?: string;
}

export interface RequestMcpAccessBlock extends BaseBlock, ToolNameProps {
  type: ToolType.RequestMcpAccess;
  mcp_name?: string;
}

export interface CreateProjectBlock extends BaseBlock, ToolNameProps {
  type: ToolType.CreateProject;
  path?: string;
}

// =============================================================================
// MESSAGE BLOCK UNION
// =============================================================================

export type MessageBlock =
  // Edge
  | ReadBlock
  | CreateBlock
  | EditBlock
  | BashBlock
  | SearchBlock
  | DownloadBlock
  // Browser
  | BrowserClickBlock
  | BrowserKeyBlock
  | BrowserNavigateBlock
  // Meta
  | TextBlock
  | ReasonBlock
  | ErrorBlock
  // External
  | WebContentBlock
  | WebSearchBlock
  | WorkspaceSearchBlock
  | GoogleRagBlock
  | GitingestBlock
  // Cloud
  | ImageGenBlock
  // Dynamic
  | McpBlock
  | RequestMcpAccessBlock
  | CreateProjectBlock;

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isEdgeBlock(
  block: MessageBlock
): block is ReadBlock | CreateBlock | EditBlock | BashBlock | SearchBlock | DownloadBlock {
  return EDGE_TOOL_TYPES.has(block.type);
}

export function isBrowserBlock(block: MessageBlock): boolean {
  return BROWSER_TOOL_TYPES.has(block.type);
}

export function isApiBlock(block: MessageBlock): boolean {
  return API_TOOL_TYPES.has(block.type);
}

export function hasFileProps(block: MessageBlock): block is MessageBlock & FileProps {
  return 'file_path' in block;
}

// =============================================================================
// LEGACY ALIASES (for backward compatibility)
// =============================================================================

/**
 * @deprecated Use ToolType instead. BlockType is kept for backward compatibility.
 * Maps legacy SCREAMING_CASE values to new ToolType values.
 */
const BlockTypeConst = {
  // Edge tools
  TEXT: ToolType.Text,
  SHELL: ToolType.Bash,
  CATFILE: ToolType.Read,
  CREATE: ToolType.Create,
  MODIFY: ToolType.Edit,
  DOWNLOAD: ToolType.Download,
  WORKSPACE_SEARCH: ToolType.WorkspaceSearch,

  // Browser tools
  CLICK: ToolType.BrowserClick,
  SENDKEY: ToolType.BrowserKey,
  BROWSER: ToolType.BrowserNavigate, // Generic browser type maps to navigate

  // External tools
  WEBSEARCH: ToolType.WebSearch,
  WEBCONTENT: ToolType.WebContent,
  GOOGLERAG: ToolType.GoogleRag,
  GITINGEST: ToolType.Gitingest,

  // Meta tools
  ERROR: ToolType.Error,
  REASON: ToolType.Reason,
  UNIVERSAL: ToolType.Text, // Universal maps to Text as fallback
  CREATE_TODO: ToolType.Text, // Deprecated, maps to Text
  EMAIL: ToolType.Text, // Deprecated, maps to Text

  // Cloud tools
  IMAGE_GEN: ToolType.ImageGen,

  // Dynamic tools
  MCP: ToolType.Mcp,
  REQUEST_MCP_ACCESS: ToolType.RequestMcpAccess,
  UPDATE_AGENT_SETTINGS: ToolType.Text, // Deprecated, maps to Text
  CREATE_PROJECT: ToolType.CreateProject,
  EDGE_NOT_RUNNING: ToolType.Text, // Maps to Text as fallback
  BUSINESS_CONTEXT: ToolType.Text, // Deprecated, maps to Text
  TODOforAI_API: ToolType.Text, // Deprecated, maps to Text
} as const;

/** @deprecated Use ToolType instead */
export const BlockType = BlockTypeConst;

/** @deprecated Use ToolType instead. This type alias allows BlockType to be used in type positions. */
export type BlockType = ToolType;

/** @deprecated Use ReadBlock instead */
export type CatFileBlock = ReadBlock;

/** @deprecated Use CreateBlock instead */
export type CreateFileBlock = CreateBlock;

/** @deprecated Use EditBlock instead */
export type ModifyFileBlock = EditBlock;

/** @deprecated Use BashBlock instead */
export type ShellBlock = BashBlock;

/** @deprecated Use McpBlock instead */
export type MCPBlock = McpBlock;

/** @deprecated Use BrowserClickBlock instead */
export type ClickBlock = BrowserClickBlock;
