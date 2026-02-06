/**
 * Unified Block Architecture
 *
 * This module provides type-safe block definitions aligned with Julia tool names.
 * ToolType enum values match Julia @deftool function names exactly.
 */

import type { AttachmentFrame } from '../attachmentTypes';

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
  ModifyFile = 'modify_file',
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
 * ToolCategory - for UI grouping
 */
export enum ToolCategory {
  Edge = 'edge',
  Browser = 'browser',
  Api = 'api',
  Cloud = 'cloud',
  Meta = 'meta',
  External = 'external',
  Dynamic = 'dynamic',
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

/** Block statuses that indicate terminal/final states */
export const TERMINAL_BLOCK_STATUSES = [BlockStatus.COMPLETED, BlockStatus.DENIED, BlockStatus.ERROR];

/** Block status helpers - simplify common status checks */
export const isBlockRunning = (block: { status: BlockStatus }) => block.status === BlockStatus.RUNNING;
export const isBlockPending = (block: { status: BlockStatus }) => block.status === BlockStatus.PENDING;
export const isBlockTerminal = (block: { status: BlockStatus }) => TERMINAL_BLOCK_STATUSES.includes(block.status);
export const isBlockAwaitingApproval = (block: { status: BlockStatus }) => block.status === BlockStatus.AWAITING_APPROVAL;
export const isBlockDenied = (block: { status: BlockStatus }) => block.status === BlockStatus.DENIED;
export const isBlockError = (block: { status: BlockStatus }) => block.status === BlockStatus.ERROR;
export const isBlockCompleted = (block: { status: BlockStatus }) => block.status === BlockStatus.COMPLETED;

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

export function getToolCategory(toolType: ToolType): ToolCategory {
  if (EDGE_TOOL_TYPES.has(toolType)) return ToolCategory.Edge;
  if (BROWSER_TOOL_TYPES.has(toolType)) return ToolCategory.Browser;
  if (API_TOOL_TYPES.has(toolType)) return ToolCategory.Api;
  if (toolType === ToolType.ImageGen) return ToolCategory.Cloud;
  if (toolType === ToolType.Mcp) return ToolCategory.Dynamic;
  if (
    [
      ToolType.WebContent,
      ToolType.GoogleRag,
      ToolType.Gitingest,
      ToolType.WorkspaceSearch,
      ToolType.WebSearch,
    ].includes(toolType)
  ) {
    return ToolCategory.External;
  }
  return ToolCategory.Meta;
}

// =============================================================================
// SHARED PROPS
// =============================================================================

export interface FileProps {
  path?: string;
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
  meta: Record<string, unknown>;
}

/**
 * Block "ready" state handling
 *
 * The `ready` flag separates "streaming finished" from "status complete":
 *   - `ready: false` = content is still streaming from agent
 *   - `ready: true` = streaming/generation finished, content is complete
 *   - `status` = lifecycle state (RUNNING, COMPLETED, DENIED, ERROR, etc.)
 *
 * Frontend components use:
 *   - `!block.ready` for streaming indicators (shimmer, disable editing)
 *   - `status === RUNNING` for user-triggered execution state
 *   - `status === COMPLETED` for lifecycle completion (tool results context)
 *
 * BLOCK_END sets `ready: true` (not status=COMPLETED)
 * Status changes come via BLOCK_UPDATE or execution handlers (BLOCK_SH_DONE, etc.)
 *
 * TODO: The agent (Julia) side needs to be updated to handle this correctly
 */
export interface BaseBlock {
  id: string;
  type: ToolType;
  content: string;
  status: BlockStatus;  // Required - default PENDING when created
  ready: boolean;       // False while streaming, true when BLOCK_END received
  result?: string;
  results?: RunResult[];
  runMeta?: RunMeta[];
  /** Generalized permission pattern for "remember" feature (e.g., "BASH(command: npm *)") */
  generalized_pattern?: string;
  /** Count of used results. N = first N results used */
  usedResults: number;
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
  pattern: string;
  path?: string;
  file_type?: string;
  ignore_case?: boolean;
  max_results?: number;
}

// =============================================================================
// BROWSER BLOCKS
// =============================================================================

/** Base interface for all browser blocks - includes tool_name */
export interface BaseBrowserBlock extends BaseBlock, ToolNameProps {}

export interface BrowserInteractableBlock extends BaseBrowserBlock {
  type: ToolType.BrowserInteractable;
  roles?: string[];
}

export interface BrowserDomTreeBlock extends BaseBrowserBlock {
  type: ToolType.BrowserDomTree;
  maxDepth?: number;
  includeEmpty?: boolean;
}

export interface BrowserNavigateBlock extends BaseBrowserBlock, UrlProps {
  type: ToolType.BrowserNavigate;
}

export interface BrowserScreenshotBlock extends BaseBrowserBlock, SelectorProps {
  type: ToolType.BrowserScreenshot;
}

export interface BrowserClickBlock extends BaseBrowserBlock, CoordinatesProps, SelectorProps {
  type: ToolType.BrowserClick;
  button?: string;
  force?: boolean;
}

export interface BrowserTypeBlock extends BaseBrowserBlock, SelectorProps {
  type: ToolType.BrowserType;
  text?: string;
  pressEnter?: boolean;
}

export interface BrowserFillBlock extends BaseBrowserBlock, SelectorProps {
  type: ToolType.BrowserFill;
  text?: string;
}

export interface BrowserScrollBlock extends BaseBrowserBlock {
  type: ToolType.BrowserScroll;
  deltaX?: number;
  deltaY?: number;
}

export interface BrowserMouseMoveBlock extends BaseBrowserBlock, CoordinatesProps {
  type: ToolType.BrowserMouseMove;
}

export interface BrowserKeyBlock extends BaseBrowserBlock {
  type: ToolType.BrowserKey;
  key: string;
  action?: string;
  modifiers?: string[];
}

export interface BrowserEvaluateBlock extends BaseBrowserBlock {
  type: ToolType.BrowserEvaluate;
  script: string;
}

export interface BrowserSelectBlock extends BaseBrowserBlock, SelectorProps {
  type: ToolType.BrowserSelect;
  value: string;
}

export interface BrowserHoverBlock extends BaseBrowserBlock, SelectorProps {
  type: ToolType.BrowserHover;
}

export interface BrowserTextContentBlock extends BaseBrowserBlock, SelectorProps {
  type: ToolType.BrowserTextContent;
}

export interface BrowserBackBlock extends BaseBrowserBlock {
  type: ToolType.BrowserBack;
}

export interface BrowserForwardBlock extends BaseBrowserBlock {
  type: ToolType.BrowserForward;
}

export interface BrowserReloadBlock extends BaseBrowserBlock {
  type: ToolType.BrowserReload;
}

export interface BrowserUploadFileBlock extends BaseBrowserBlock, SelectorProps {
  type: ToolType.BrowserUploadFile;
  uri: string;
}

// =============================================================================
// API BLOCKS
// =============================================================================

export type ApiToolType =
  | ToolType.ApiGetCurrentContext
  | ToolType.ApiGetTodo
  | ToolType.ApiAddTodoMessage
  | ToolType.ApiUpdateTodoStatus
  | ToolType.ApiDeleteTodo
  | ToolType.ApiListProjects
  | ToolType.ApiGetProject
  | ToolType.ApiCreateProject
  | ToolType.ApiListProjectTodos
  | ToolType.ApiCreateTodo
  | ToolType.ApiListAgents
  | ToolType.ApiGetAgent
  | ToolType.ApiUpdateAgent
  | ToolType.ApiListBusinessContexts
  | ToolType.ApiGetBusinessContext
  | ToolType.ApiGetContextItem
  | ToolType.ApiCreateContextItem
  | ToolType.ApiUpdateContextItem
  | ToolType.ApiDeleteContextItem
  | ToolType.ApiListEdges
  | ToolType.ApiGetEdge
  | ToolType.ApiListMcps
  | ToolType.ApiGetUsage
  | ToolType.ApiGetBalance
  | ToolType.ApiGetApiSchema;

export interface ApiBlock extends BaseBlock, TitleProps, ToolNameProps {
  type: ApiToolType;
}

// =============================================================================
// CLOUD BLOCKS
// =============================================================================

export interface ImageGenBlock extends BaseBlock, AttachmentProps {
  type: ToolType.ImageGen;
  prompt?: string;
  model?: string;
  userId?: string;
  // Legacy alias for attachment_ids
  attachmentIds?: string[];
}

// =============================================================================
// META BLOCKS
// =============================================================================

export interface TextBlock extends BaseBlock {
  type: ToolType.Text;
}

/**
 * @deprecated Email blocks are deprecated. Use TextBlock instead.
 * This interface exists for backward compatibility with existing email components.
 */
export interface EmailBlock extends BaseBlock {
  type: ToolType.Text;
  to?: string;
  subject?: string;
}

export interface ReasonBlock extends BaseBlock {
  type: ToolType.Reason;
}

export interface ErrorBlock extends BaseBlock {
  type: ToolType.Error;
  error_message?: string;
  stacktrace?: string;
}

export interface CompactBlock extends BaseBlock {
  type: ToolType.Compact;
  keep?: number;
  mode?: string;
}

export interface RequestMcpAccessBlock extends BaseBlock, ToolNameProps {
  type: ToolType.RequestMcpAccess;
  mcp_name?: string;
}

export interface CreateProjectBlock extends BaseBlock, ToolNameProps {
  type: ToolType.CreateProject;
  path?: string;
}

export interface EdgeNotRunningBlock extends BaseBlock, ToolNameProps {
  type: ToolType.EdgeNotRunning;
}

// =============================================================================
// EXTERNAL BLOCKS
// =============================================================================

export interface WebContentBlock extends BaseBlock, UrlProps {
  type: ToolType.WebContent;
}

export interface GoogleRagBlock extends BaseBlock, QueryProps {
  type: ToolType.GoogleRag;
}

export interface GitingestBlock extends BaseBlock {
  type: ToolType.Gitingest;
  url?: string;
  path?: string;
}

export interface WorkspaceSearchBlock extends BaseBlock, QueryProps {
  type: ToolType.WorkspaceSearch;
}

export interface WebSearchBlock extends BaseBlock, QueryProps {
  type: ToolType.WebSearch;
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
  | BrowserInteractableBlock
  | BrowserDomTreeBlock
  | BrowserNavigateBlock
  | BrowserScreenshotBlock
  | BrowserClickBlock
  | BrowserTypeBlock
  | BrowserFillBlock
  | BrowserScrollBlock
  | BrowserMouseMoveBlock
  | BrowserKeyBlock
  | BrowserEvaluateBlock
  | BrowserSelectBlock
  | BrowserHoverBlock
  | BrowserTextContentBlock
  | BrowserBackBlock
  | BrowserForwardBlock
  | BrowserReloadBlock
  | BrowserUploadFileBlock
  // API
  | ApiBlock
  // Cloud
  | ImageGenBlock
  // Meta
  | TextBlock
  | ReasonBlock
  | ErrorBlock
  | CompactBlock
  | RequestMcpAccessBlock
  | CreateProjectBlock
  | EdgeNotRunningBlock
  // External
  | WebContentBlock
  | GoogleRagBlock
  | GitingestBlock
  | WorkspaceSearchBlock
  | WebSearchBlock
  // Dynamic
  | McpBlock;

// Browser block union (any browser tool block)
export type BrowserBlock =
  | BrowserInteractableBlock
  | BrowserDomTreeBlock
  | BrowserNavigateBlock
  | BrowserScreenshotBlock
  | BrowserClickBlock
  | BrowserTypeBlock
  | BrowserFillBlock
  | BrowserScrollBlock
  | BrowserMouseMoveBlock
  | BrowserKeyBlock
  | BrowserEvaluateBlock
  | BrowserSelectBlock
  | BrowserHoverBlock
  | BrowserTextContentBlock
  | BrowserBackBlock
  | BrowserForwardBlock
  | BrowserReloadBlock
  | BrowserUploadFileBlock;

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isEdgeBlock(
  block: MessageBlock
): block is ReadBlock | CreateBlock | EditBlock | BashBlock | SearchBlock | DownloadBlock {
  return EDGE_TOOL_TYPES.has(block.type);
}

export function isBrowserBlock(block: MessageBlock): block is BrowserBlock {
  return BROWSER_TOOL_TYPES.has(block.type);
}

export function isApiBlock(block: MessageBlock): block is ApiBlock {
  return API_TOOL_TYPES.has(block.type);
}

export function isFileBlock(block: MessageBlock): block is MessageBlock & FileProps {
  return FILE_TOOL_TYPES.has(block.type);
}

export function hasFileProps(block: MessageBlock): block is MessageBlock & FileProps {
  return 'path' in block;
}

export function hasUrlProps(block: MessageBlock): block is MessageBlock & UrlProps {
  return 'url' in block;
}

export function hasQueryProps(block: MessageBlock): block is MessageBlock & QueryProps {
  return 'query' in block;
}

export function hasCoordinates(block: MessageBlock): block is MessageBlock & CoordinatesProps {
  return 'x' in block || 'y' in block;
}

export function hasSelector(block: MessageBlock): block is MessageBlock & SelectorProps {
  return 'selector' in block;
}

// =============================================================================
// LEGACY TYPE ALIASES (for backward compatibility)
// =============================================================================

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

/** @deprecated Legacy ClickBlock - use BrowserClickBlock instead */
export interface ClickBlock extends BaseBlock, CoordinatesProps {
  type: ToolType.BrowserClick;
  button?: string;
}


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
  BROWSER: ToolType.BrowserNavigate,

  // External tools
  WEBSEARCH: ToolType.WebSearch,
  WEBCONTENT: ToolType.WebContent,
  GOOGLERAG: ToolType.GoogleRag,
  GITINGEST: ToolType.Gitingest,

  // Meta tools
  ERROR: ToolType.Error,
  REASON: ToolType.Reason,
  UNIVERSAL: ToolType.Text,
  CREATE_TODO: ToolType.Text,
  EMAIL: ToolType.Text,

  // Cloud tools
  IMAGE_GEN: ToolType.ImageGen,

  // Dynamic tools
  MCP: ToolType.Mcp,
  REQUEST_MCP_ACCESS: ToolType.RequestMcpAccess,
  UPDATE_AGENT_SETTINGS: ToolType.Text,
  CREATE_PROJECT: ToolType.CreateProject,
  EDGE_NOT_RUNNING: ToolType.Text,
  BUSINESS_CONTEXT: ToolType.Text,
  TODOforAI_API: ToolType.Text,
} as const;

/** @deprecated Use ToolType instead */
export const BlockType = BlockTypeConst;

/** @deprecated Use ToolType instead */
export type BlockType = ToolType;
