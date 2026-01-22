/**
 * Message Protocol Types for TODOforAI Edge
 *
 * This file contains all TypeScript type definitions for the
 * communication protocol between edge, server, frontend, and agents.
 */

// ============================================================================
// Message Type Constants
// ============================================================================

export const MessageTypes = {
  // Server responses
  CONNECTED_EDGE: 'connected_edge',
  CONNECTED_FRONTEND: 'connected_frontend',
  CONNECTED_AGENT: 'connected_agent',
  ERROR: 'error',

  // Server → Edge
  EDGE_CONFIG_UPDATE: 'edge:config_update',

  // Frontend → Edge
  EDGE_DIR_LIST: 'edge:dir_list',
  EDGE_CD: 'edge:cd',
  BLOCK_EXECUTE: 'block:execute',
  BLOCK_SAVE: 'block:save',
  BLOCK_REFRESH: 'block:refresh',
  BLOCK_KEYBOARD: 'block:keyboard',
  TASK_ACTION_NEW: 'task:action_new',
  GET_FOLDERS: 'edge:get_folders',
  FRONTEND_FILE_CHUNK_REQUEST: 'frontend:file_chunk_request',
  FUNCTION_CALL_REQUEST_FRONT: 'FUNCTION_CALL_REQUEST_FRONT',

  // Agent → Edge
  CTX_WORKSPACE_REQUEST: 'ctx:workspace_request',
  CTX_JULIA_REQUEST: 'ctx:julia_request',
  FILE_CHUNK_REQUEST: 'file:chunk_request',
  FUNCTION_CALL_REQUEST_AGENT: 'FUNCTION_CALL_REQUEST_AGENT',

  // Edge → Frontend
  EDGE_STATUS: 'edge:status',
  EDGE_CD_RESPONSE: 'edge:cd_response',
  EDGE_DIR_LIST_RESPONSE: 'edge:dir_list_response',
  EDGE_FOLDERS_RESPONSE: 'edge:folders_response',
  BLOCK_SH_MSG_START: 'block:sh_msg_start',
  BLOCK_SH_MSG_RESULT: 'block:sh_msg_result',
  BLOCK_SH_DONE: 'block:sh_done',
  BLOCK_SAVE_RESULT: 'block:save_result',
  BLOCK_ERROR_RESULT: 'block:error_result',
  FRONTEND_FILE_CHUNK_RESULT: 'frontend:file_chunk_result',
  FUNCTION_CALL_RESULT_FRONT: 'FUNCTION_CALL_RESULT_FRONT',
  TASK_ACTION_UPDATE: 'task:action_update',

  // Edge → Agent
  CTX_WORKSPACE_RESULT: 'ctx:workspace_result',
  CTX_JULIA_RESULT: 'ctx:julia_result',
  FILE_CHUNK_RESULT: 'file:chunk_result',
  FUNCTION_CALL_RESULT_AGENT: 'FUNCTION_CALL_RESULT_AGENT',

  // File sync (Edge → Both)
  WORKSPACE_FILE_CREATE_SYNC: 'workspace:file_create_sync',
  WORKSPACE_FILE_MODIFY_SYNC: 'workspace:file_modify_sync',
  WORKSPACE_FILE_DELETE_SYNC: 'workspace:file_delete_sync',
  WORKSPACE_FILE_DONE: 'workspace:file_done',
} as const;

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes];

// ============================================================================
// Base Message Interface
// ============================================================================

export interface Message<T = unknown> {
  type: string;
  payload: T;
}

// ============================================================================
// Server Response Payloads
// ============================================================================

export interface ConnectedEdgePayload {
  edgeId: string;
  userId: string;
}

export interface ErrorPayload {
  message: string;
  code?: string;
}

// ============================================================================
// Config Payloads
// ============================================================================

export interface EdgeConfigUpdatePayload {
  workspacepaths?: string[];
  installedMCPs?: Record<string, MCPServerStatus>;
  name?: string;
  isShellEnabled?: boolean;
  isFileSystemEnabled?: boolean;
}

export interface MCPServerStatus {
  serverId: string;
  status: 'READY' | 'STARTING' | 'INSTALLING' | 'CRASHED' | 'STOPPED';
  tools: MCPTool[];
  env: Record<string, string>;
  registryId?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ============================================================================
// Block Operation Payloads
// ============================================================================

export interface BlockExecutePayload {
  blockId: string;
  content: string;
  todoId?: string;
  cwd?: string;
  timeout?: number;
  requestId?: string;
}

export interface BlockSavePayload {
  blockId: string;
  path: string;
  content: string;
}

export interface BlockKeyboardPayload {
  blockId: string;
  input: string;
}

export interface BlockShellStartPayload {
  blockId: string;
}

export interface BlockShellOutputPayload {
  blockId: string;
  output: string;
}

export interface BlockShellDonePayload {
  blockId: string;
  returnCode: number;
}

export interface BlockSaveResultPayload {
  blockId: string;
  success: boolean;
  error?: string;
}

export interface BlockErrorPayload {
  blockId: string;
  error: string;
}

// ============================================================================
// File Operation Payloads
// ============================================================================

export interface DirListPayload {
  path: string;
  todoId?: string;
}

export interface CdPayload {
  path: string;
}

export interface GetFoldersPayload {
  path: string;
  depth?: number;
}

export interface FileChunkRequestPayload {
  path: string;
  requestId: string;
  agentId?: string;
}

export interface FileChunkResultPayload {
  requestId: string;
  path: string;
  content: string;
  error?: string;
  agentId?: string;
}

export interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: number;
}

export interface FolderStructure {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: FolderStructure[];
}

// ============================================================================
// Function Call Payloads
// ============================================================================

export interface FunctionCallRequestPayload {
  functionName: string;
  args: Record<string, unknown>;
  requestId: string;
  edgeId?: string;
  agentId?: string;
}

export interface FunctionCallResultPayload {
  requestId: string;
  result?: unknown;
  error?: string;
  agentId?: string;
}

// ============================================================================
// Context Payloads
// ============================================================================

export interface WorkspaceRequestPayload {
  path: string;
  agentId: string;
}

export interface WorkspaceResultPayload {
  path: string;
  files: string[];
  agentId: string;
}

export interface JuliaRequestPayload {
  agentId: string;
}

export interface JuliaResultPayload {
  agentId: string;
  // Julia-specific data
}

// ============================================================================
// File Sync Payloads
// ============================================================================

export interface FileSyncPayload {
  path: string;
  content?: string;
  edgeId: string;
  userId: string;
}

export interface FileSyncDonePayload {
  path: string;
  edgeId: string;
  userId: string;
  stats?: SyncStats;
}

export interface SyncStats {
  filesSynced: number;
  filesSkipped: number;
  syncErrors: number;
  bytesSynced: number;
}

// ============================================================================
// Task Payloads
// ============================================================================

export interface TaskActionNewPayload {
  action: string;
  todoId: string;
}

export interface TaskActionUpdatePayload {
  todoId: string;
  action: string;
  status: string;
}

// ============================================================================
// Edge Status
// ============================================================================

export interface EdgeStatusPayload {
  edgeId: string;
  status: 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR';
}

// ============================================================================
// MCP Configuration
// ============================================================================

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface MCPConfig {
  mcpServers?: Record<string, MCPServerConfig>;
  mcp?: {
    servers?: Record<string, MCPServerConfig>;
  };
}

// ============================================================================
// Edge Configuration
// ============================================================================

export interface EdgeConfigData {
  id: string;
  name: string;
  workspacepaths: string[];
  installedMCPs: Record<string, MCPServerStatus>;
  mcp_json: Record<string, unknown>;
  mcp_config_path: string;
  ownerId: string;
  status: 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR';
  isShellEnabled: boolean;
  isFileSystemEnabled: boolean;
  createdAt: string;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isConnectedEdgeMessage(msg: Message): msg is Message<ConnectedEdgePayload> {
  return msg.type === MessageTypes.CONNECTED_EDGE;
}

export function isErrorMessage(msg: Message): msg is Message<ErrorPayload> {
  return msg.type === MessageTypes.ERROR;
}

export function isBlockExecuteMessage(msg: Message): msg is Message<BlockExecutePayload> {
  return msg.type === MessageTypes.BLOCK_EXECUTE;
}

export function isFileChunkRequestMessage(msg: Message): msg is Message<FileChunkRequestPayload> {
  return msg.type === MessageTypes.FILE_CHUNK_REQUEST ||
         msg.type === MessageTypes.FRONTEND_FILE_CHUNK_REQUEST;
}

export function isFunctionCallRequestMessage(msg: Message): msg is Message<FunctionCallRequestPayload> {
  return msg.type === MessageTypes.FUNCTION_CALL_REQUEST_AGENT ||
         msg.type === MessageTypes.FUNCTION_CALL_REQUEST_FRONT;
}
