import {
  Front2Agent,
  SR,
  Edge2Front,
  Front2Edge,
  Agent2Front,
  Edge2Agent,
  Agent2Edge,
  Front2Front,
  Edge2FrontAgent,
  Server2Front,
  Server2Edge,
  Front2Server,
} from './constants';
import { CreateFileResult, TaskStatus, TodoStatus } from './enums';
import type { RunMeta, RunResult } from './blocks';
import { BlockType, BlockStatus } from './blocks';
import type { AgentSettings, ApprovalDecision } from './REST_types';
import type { MCPJSON, MCPToolSkeleton, InstalledMCP, CallToolResult } from './mcpTypes';
import type { AttachmentWire, AttachmentWireCreate, AttachmentFrame } from './attachmentTypes';
import { EdgeStatus } from './edgeTypes';
import type { BusinessFull } from './context_schema';

// ============================================================================
// 1. CONNECTION & STATUS MESSAGES
// ============================================================================

export interface ConnectedFrontendMessage {
  type: typeof SR.CONNECTED_FRONTEND;
  payload: {
    userId: string;
  };
}

export interface EdgeDisconnectedMessage {
  type: Edge2Agent.EDGE_DISCONNECTED;
  payload: {
    edgeId: string;
    userId: string;
  };
}

export interface EdgeStatusMessage {
  type: Edge2Front.EDGE_STATUS;
  payload: {
    userId: string;
    edgeId: string;
    status: EdgeStatus;
  };
}

export interface ProjectStatusMessage {
  type: Agent2Front.PROJECT_STATUS;
  payload: {
    projectId: string;
    todoId: string;
    status: string;
  };
}

export interface TodoStatusMessage {
  type: Server2Front.TODO_STATUS;
  payload: {
    todoId: string;
    status: string;
  };
}

export interface TaskActionUpdateMessage {
  type: Edge2Front.TASK_ACTION_UPDATE;
  payload: {
    userId: string;
    taskId: string;
    edgeId: string;
    status: string;
  };
}

// ============================================================================
// 2. BLOCK OPERATIONS
// ============================================================================

// Block Start Messages
export interface BlockStartTextMessage {
  type: Agent2Front.BLOCK_START_TEXT;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
  };
}

export interface BlockStartUniversalMessage {
  type: Agent2Front.BLOCK_START_UNIVERSAL;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    block_type: BlockType;
    title?: string;
    url?: string;    // For WEBCONTENT blocks
    query?: string;  // For GOOGLERAG blocks
    [key: string]: any; // Allow any additional fields
  };
}

// Block Update Messages
export interface BlockUpdateMessage {
  type: Agent2Front.BLOCK_UPDATE;
  payload: {
    userId?: string;
    todoId: string;
    messageId: string;
    blockId: string;
    updates: {
      runMeta?: RunMeta[];
      [key: string]: any;
    };
  };
}

export interface BlockRefreshMessage {
  type: Front2Edge.BLOCK_REFRESH;
  payload: {
    blockId: string;
    data: string;
  };
}

export interface BlockMessageMessage {
  type: Agent2Front.BLOCK_MESSAGE;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    content: string;
  };
}

// Block End Messages
export interface BlockEndMessage {
  type: Agent2Front.BLOCK_END;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    tag: string;
    userId: string;
    metadata?: Record<string, string>;
  };
}

// Block Result Messages
export interface BlockMessageResultMessage {
  type: Edge2Front.BLOCK_SH_MSG_RESULT;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    content: string;
  };
}

export interface BlockStartResultMessage {
  type: Edge2Front.BLOCK_SH_MSG_START;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    mode: string;
  };
}

export interface BlockDoneResultMessage {
  type: Edge2Front.BLOCK_SH_DONE;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    attachmentId?: string;
    mode: string;
  };
}

// MCP execution request (fire-and-forget, like shell)
export interface BlockMcpExecuteMessage {
  type: Front2Edge.BLOCK_MCP_EXECUTE;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    edgeId: string;
    userId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  };
}

// MCP execution result (sent by edge through backend)
export interface BlockMcpResultMessage {
  type: Edge2Front.BLOCK_MCP_RESULT;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    userId: string;
    success: boolean;
    result?: CallToolResult;
    error?: string;
  };
}

export interface BlockSaveResultMessage {
  type: Edge2Front.BLOCK_SAVE_RESULT;
  payload: {
    requestId: string;
    blockId: string;
    todoId: string;
    messageId?: string;
    result: CreateFileResult;
  };
}

export interface BlockErrorResultMessage {
  type: Edge2Front.BLOCK_ERROR_RESULT;
  payload: {
    blockId: string;
    todoId: string;
    error: string;
  };
}

export interface BlockMetaResultMessage {
  type: Edge2Front.BLOCK_META_RESULT;
  payload: {
    blockId: string;
    runMeta?: RunMeta[];
  };
}

export interface BlockDiffResultMessage {
  type: Agent2Front.BLOCK_DIFF_RESULT;
  payload: {
    userId: string;
    todoId: string;
    messageId: string;
    blockId: string;
    originalContent: string;
    aiGeneratedContent: string;
    result?: string;
    $append?: {
      runMeta?: RunMeta[];
    };
  };
}

// Block Actions
export interface BlockExecuteMessage {
  type: Front2Edge.BLOCK_EXECUTE;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    edgeId: string;
    content: string;
    rootPath: string;
    timeout?: number;
  };
}

export interface BlockSaveMessage {
  type: Front2Edge.BLOCK_SAVE;
  payload: {
    requestId: string;
    blockId: string;
    edgeId: string;
    todoId: string;
    rootPath: string;
    fallbackRootPaths?: string[];
    filepath: string;
    content: string;
  };
}

export interface BlockKeyboardMessage {
  type: Front2Edge.BLOCK_KEYBOARD;
  payload: {
    blockId: string;
    edgeId: string;
    content: string;
  };
}

export interface BlockSignalMessage {
  type: Front2Edge.BLOCK_SIGNAL;
  payload: {
    blockId: string;
    edgeId: string;
  };
}

export interface BlockDiffMessage {
  type: Front2Agent.BLOCK_DIFF;
  payload: {
    requestId: string;
    userId: string;
    edgeId: string;
    todoId: string;
    messageId: string;
    blockId: string;
    rootPath: string;
    fallbackRootPaths?: string[];
    filepath: string;
    changes: string;
  };
}

export interface BlockDiffFileRequestMessage {
  type: Agent2Edge.DIFF_FILE_REQUEST;
  payload: {
    requestId: string;
    edgeId: string;
    agentId: string;
    todoId: string;
    blockId: string;
    rootPath: string;
    filepath: string;
  };
}

// Frontend -> Server block updates
export interface FrontBlockUpdateMessage {
  type: Front2Server.BLOCK_UPDATE;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    updates: { // TODO this could be some partial messageBlock maybe?
      // Only allow appending to results array - prevent other modifications
      $append?: {
        results?: RunResult[];
      };
      // Explicitly prevent these fields from being modified by frontend
      runMeta?: never;
      content?: never;
      status?: never;
    };
  };
}

// Frontend -> Server block approval intent (user approves or denies a block)
export interface FrontBlockApprovalIntentMessage {
  type: Front2Server.BLOCK_APPROVAL_INTENT;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    /** User's decision: allow/deny with optional remember */
    decision: ApprovalDecision;
  };
}

// ============================================================================
// 3. TODO & MESSAGE OPERATIONS
// ============================================================================
export interface TodoMsgStartMessage {
  type: Agent2Front.TODO_MSG_START;
  payload: {
    todoId: string;
    messageId: string;
    userMessageId: string;
    mode: string;
  };
}

export interface TodoMsgDoneMessage {
  type: Agent2Front.TODO_MSG_DONE;
  payload: {
    todoId: string;
    messageId: string;
    userMessageId: string;
    mode: string;
  };
}

export interface TodoMsgErrorMessage {
  type: Agent2Front.TODO_MSG_ERROR;
  payload: {
    todoId: string;
    messageId: string;
    userMessageId: string;
    error: string;
  };
}

export interface TodoMsgStopSequenceMessage {
  type: Agent2Front.TODO_MSG_STOP_SEQUENCE;
  payload: {
    todoId: string;
    messageId: string;
    stop_sequence: string;
  };
}

export interface NewTodo {
  type: Server2Front.NEW_TODO;
  payload: {
    todoId: string;
    projectId: string;
    todo: {
      id: string;
      projectId: string;
      status: TodoStatus;
      content: string;
      messageIds: string[];
      createdAt: number;
      lastActivityAt: number;
      agentSettingsId: string;
      scheduledTimestamp?: number;
    };
  };
}

export interface NewTodoMessage {
  type: Agent2Front.TODO_NEW_MESSAGE;
  payload: {
    todoId: string;
    messageId: string;
    role: string;
    status: TodoStatus;
  };
}

export interface NewTodoMessageCreated {
  type: Agent2Front.TODO_NEW_MESSAGE_CREATED;
  payload: {
    todoId: string;
    messageId: string;
    content: string;
    attachments: AttachmentFrame[];
    role: string;
    status: TodoStatus;
    scheduledTimestamp?: number;
  };
}

export interface NewProjectTodoMessage {
  type: Front2Front.TASK_NEW;
  payload: {
    taskId: string;
    userId: string;
    todoId: string;
    projectId: string;
  };
}

export interface TodoInterruptSignalMessage {
  type: Front2Agent.TODO_INTERRUPT_SIGNAL;
  payload: {
    projectId: string;
    todoId: string;
    userMessageId?: string;
  };
}

export interface TodoGracefulStopMessage {
  type: Front2Agent.TODO_INTERRUPT_SIGNAL;
  payload: {
    projectId: string;
    todoId: string;
    userMessageId?: string;
  };
}

// Todo Metadata
export interface TodoMsgMetaUsrMessage {
  type: Agent2Front.TODO_MSG_META_USR;
  payload: {
    todoId: string;
    messageId: string;
    userMessageId: string;
    userId: string;
    $append?: {
      runMeta?: RunMeta[];
    };
  };
}

export interface TodoMsgMetaAiMessage {
  type: Agent2Front.TODO_MSG_META_AI;
  payload: {
    todoId: string;
    messageId: string;
    userId: string;
    $append?: {
      runMeta?: RunMeta[];
    };
  };
}

// Message Updates (agent -> backend: raw attachments)
export interface MessageUpdateMessage {
  type: Agent2Front.MESSAGE_UPDATE;
  payload: {
    todoId: string;
    messageId: string;
    userMessageId?: string;
    updates: {
      $append?: {
        runMeta?: RunMeta[];
        attachments?: AttachmentWireCreate[]; // New attachments from agent (no id/uri yet)
      };
    };
    userId: string;
  };
}

// Message Updates (backend -> frontend: processed attachments with id/uri)
export interface MessageUpdateMessageProcessed {
  type: Agent2Front.MESSAGE_UPDATE;
  payload: {
    todoId: string;
    messageId: string;
    userMessageId?: string;
    updates: {
      $append?: {
        runMeta?: RunMeta[];
        attachments?: AttachmentFrame[]; // Registered attachments with id/uri
      };
    };
    userId: string;
  };
}

// ============================================================================
// 4. FILE OPERATIONS
// ============================================================================

// File Requests
export interface FrontendFileChunkRequestMessage {
  type: Front2Edge.FRONTEND_FILE_CHUNK_REQUEST;
  payload: {
    requestId: string;
    edgeId: string;
    path: string;
    rootPath?: string;
    fallbackRootPaths?: string[];
    todoId: string;
    messageId: string | null;
    blockId?: string;
  };
}

export interface FileChunkRequestMessage {
  type: Agent2Edge.FILE_CHUNK_REQUEST;
  payload: {
    requestId: string;
    edgeId: string;
    agentId: string;
    path: string;
  };
}

// File Results
export interface FrontendFileChunkResultMessage {
  type: Edge2Front.FRONTEND_FILE_CHUNK_RESULT;
  payload: {
    requestId: string;
    content: string;
    initialOriginalContent?: string;
    todoId: string;
    messageId: string;
    blockId: string;
    error?: string;
  };
}

export interface FileChunkResultMessage {
  type: Edge2Agent.FILE_CHUNK_RESULT;
  payload: {
    requestId: string;
    agentId: string;
    content: string;
    path: string;
    error?: string;
  };
}

// File Watching
export interface BlockFileWatchMessage {
  type: Front2Edge.BLOCK_FILE_WATCH;
  payload: {
    edgeId: string;
    filePath: string;
  };
}

export interface BlockFileChangedMessage {
  type: Edge2Front.BLOCK_FILE_CHANGED;
  payload: {
    edgeId: string;
    filePath: string;
    todoId: string;
    content: string;
  };
}

// ============================================================================
// 5. WORKSPACE OPERATIONS
// ============================================================================

// Workspace Requests
export interface WorkspaceRequestMessage {
  type: Agent2Edge.CTX_WORKSPACE_REQUEST;
  payload: {
    requestId: string;
    userId: string;
    edgeId: string;
    agentId: string;
    path: string;
    excludePaths: string[];
  };
}

// Workspace Results
export interface WorkspaceResultMessage {
  type: Edge2Agent.CTX_WORKSPACE_RESULT;
  payload: {
    requestId: string;
    userId: string;
    agentId: string;
    project_files: string[];
    filtered_files: string[];
    filtered_dirs: string[];
    cost: number;
    elapsed: number;
  };
}

// Workspace Sync
export interface WorkspaceFileCreateSyncMessage {
  type: Edge2FrontAgent.WORKSPACE_FILE_CREATE_SYNC;
  payload: {
    path: string;
    content: string;
    edgeId: string;
    userId: string;
  };
}

export interface WorkspaceFileModifySyncMessage {
  type: Edge2FrontAgent.WORKSPACE_FILE_MODIFY_SYNC;
  payload: {
    path: string;
    content: string;
    edgeId: string;
    userId: string;
  };
}

export interface WorkspaceFileDeleteSyncMessage {
  type: Edge2FrontAgent.WORKSPACE_FILE_DELETE_SYNC;
  payload: {
    path: string;
    edgeId: string;
    userId: string;
  };
}

export interface WorkspaceFileDoneMessage {
  type: Edge2FrontAgent.WORKSPACE_FILE_DONE;
  payload: {
    path: string;
    edgeId: string;
    userId: string;
  };
}



// ============================================================================
// 6. EDGE OPERATIONS
// ============================================================================

// Edge Navigation
export interface EdgeCDMessage {
  type: Front2Edge.EDGE_CD;
  payload: {
    edgeId: string;
    path: string;
    requestId: string;
  };
}

export interface EdgeCDResponseMessage {
  type: Edge2Front.EDGE_CD_RESPONSE;
  payload: {
    edgeId: string;
    path: string;
    success: boolean;
    requestId: string;
  };
}

export interface EdgeGetFoldersMessage {
  type: Front2Edge.EDGE_GET_FOLDERS;
  payload: {
    edgeId: string;
    path: string;
    requestId: string;
  };
}

export interface EdgeGetFoldersResponseMessage {
  type: Edge2Front.EDGE_GET_FOLDERS_RESPONSE;
  payload: {
    edgeId: string;
    requestId: string;
    folders: string[];
    files: string[];
    error: string;
    actualPath?: string;
  };
}

// Edge Config
export interface EdgeConfigUpdateMessage {
  type: Edge2Front.EDGE_CONFIG_UPDATE;
  payload: {
    edgeId: string;
    workspacepaths: string[];
    name: string;
    installedMCPs?: Record<string, InstalledMCP>;
    ownerId?: string;
    status?: EdgeStatus;
    createdAt?: number;
  };
}

export interface ServerEdgeConfigUpdateMessage {
  type: Server2Edge.EDGE_CONFIG_UPDATE;
  payload: {
    edgeId: string;
    workspacepaths: string[];
    name: string;
    createdAt?: number;
    ownerId: string;
  };
}

// ============================================================================
// 7. FUNCTION CALLS
// ============================================================================

// Frontend-Agent Function Calls
export interface FunctionCallF2ARequestMessage {
  type: Front2Agent.FUNCTION_CALL_F2A_REQUEST;
  payload: {
    requestId: string;
    functionName: string;
    args?: any[];
    kwargs?: Record<string, any>;
    // Context info for side-effects:
    todoId?: string;
    blockId?: string;
    messageId?: string;
    // User balance for cost pre-checks (attached by backend)
    user_balance?: number;
  };
}

export interface FunctionCallF2AResultMessage {
  type: Agent2Front.FUNCTION_CALL_F2A_RESULT;
  payload: {
    requestId: string;
    success: boolean;
    result?: any;
    error?: string;
    userId: string;
  };
}

// Frontend-Edge Function Calls
export interface FrontendFunctionCallRequestMessage {
  type: Front2Edge.FUNCTION_CALL_REQUEST_FRONT;
  payload: {
    requestId: string; // Make optional - will be added by sendWebSocketRequest
    edgeId: string;
    functionName: string;
    args?: Record<string, any>;
  };
}

export interface FrontendFunctionCallResultMessage {
  type: Edge2Front.FUNCTION_CALL_RESULT_FRONT;
  payload: {
    requestId: string;
    edgeId: string;
    success: boolean;
    result?: CallToolResult | {
      error: string;
      success: boolean;
    } | {
      path: string;
    };
  };
}

// Agent-Edge Function Calls
export interface FunctionCallRequestAgentMessage {
  type: Agent2Edge.FUNCTION_CALL_REQUEST_AGENT;
  payload: {
    requestId: string;
    edgeId: string;
    agentId: string;
    functionName: string;
    args?: Record<string, any>;
  };
}

export interface FunctionCallResultAgentMessage {
  type: Edge2Agent.FUNCTION_CALL_RESULT_AGENT; // TODO ! this should be similar to!! FUNCTION_CALL_RESULT_FRONT right???
  payload: {
    agentId: string;
    requestId: string;
    result?: any;
    error?: string;
  };
}

// ============================================================================
// 8. MCP OPERATIONS
// ============================================================================

export interface AgentMCPListMessage {
  type: Agent2Front.AGENT_MCP_LIST;
  payload: {
    agentId: string;
    mcps: Record<string, MCPJSON>;
  };
}

// ============================================================================
// 9. PAYMENT OPERATIONS
// ============================================================================

export interface PaymentStatusMessage {
  type: Agent2Front.PAYMENT_STATUS;
  payload: {
    status: string;
    paymentMethodId: string;
    error?: string;
  };
}

export interface PaymentWebhookMessage {
  type: Agent2Front.PAYMENT_WEBHOOK;
  payload: {
    status: 'payment_succeeded' | 'payment_processing_failed';
    paymentIntentId: string;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    newBalance?: number;
    invoiceId?: string;
    error?: string;
  };
}

// ============================================================================
// 9.5. BUSINESS CONTEXT OPERATIONS
// ============================================================================

export interface BusinessContextUpdatedMessage {
  type: Server2Front.BUSINESS_CONTEXT_UPDATED;
  payload: {
    userId: string;
    context: BusinessFull;
  };
}

// ============================================================================
// 9.6. CONTEXT OPERATIONS
// ============================================================================

export interface ContextCompactRequestMessage {
  type: Front2Agent.CONTEXT_COMPACT_REQUEST;
  payload: {
    requestId: string;
    todoId: string;
    keep?: number;
  };
}

export interface ContextCompactResultMessage {
  type: Agent2Front.CONTEXT_COMPACT_RESULT;
  payload: {
    requestId: string;
    todoId: string;
    success: boolean;
    message: string;
    originalMessages: number;
    compactedMessages: number;
  };
}

// ============================================================================
// 9.7. TOOL APPROVAL OPERATIONS
// ============================================================================

/** Sent to agent when user approves a tool - contains all data needed to execute */
export interface ToolApprovalResponseMessage {
  type: Front2Agent.TOOL_APPROVAL_RESPONSE;
  payload: {
    todoId: string;
    messageId: string;
    blockId: string;
    userId: string;
    toolType: string;
    toolParams: Record<string, any>;  // Block fields (path, command, content, etc.)
    projectId: string;
    agentSettingsData: Record<string, any>;
  };
}

/** Sent by backend when all pending tool approvals in a message are resolved */
export interface ToolsResolvedMessage {
  type: Front2Agent.TOOLS_RESOLVED;
  payload: {
    todoId: string;
    messageId: string;
    /** Results from all resolved tools */
    results: Array<{
      blockId: string;
      blockType: string;
      status: 'COMPLETED' | 'DENIED' | 'ERROR';
      result: string;
      filePath?: string;
    }>;
  };
}

// ============================================================================
// 10. TASK OPERATIONS
// ============================================================================

export interface TaskNewMessage {
  type: Front2Agent.TASK_NEW;
  payload: {
    taskId: string;
    status: TaskStatus;
    userId: string;
    userMessageId: string;
    todoId: string;
    projectId: string;
    content: string;
    agentSettingsData: AgentSettings;
    mcpsEnv: Record<string, Record<string, string>>;
    filteredEdgeTools?: Record<string, MCPToolSkeleton[]>;
    createdAt: number;
    attachments: AttachmentWire[];
    businessContextId?: string;
  };
}

// ============================================================================
// TYPE UNIONS
// ============================================================================

export type WebSocketRequestMessage =
  | BlockSaveResultMessage               // requestId: string
  | BlockDiffMessage                     // requestId: string
  | BlockDiffFileRequestMessage          // requestId: string
  | BlockSaveMessage                     // requestId: string
  | EdgeCDMessage                        // requestId: string
  | EdgeCDResponseMessage                // requestId: string
  | EdgeGetFoldersMessage                // requestId: string
  | EdgeGetFoldersResponseMessage        // requestId: string
  | WorkspaceRequestMessage              // requestId: string
  | WorkspaceResultMessage               // requestId: string
  // | WorkspaceResultMetaMessage           // requestId: string
  | FrontendFileChunkRequestMessage      // requestId: string
  | FrontendFileChunkResultMessage       // requestId: string
  | FileChunkRequestMessage              // requestId: string
  | FileChunkResultMessage               // requestId: string
  | FunctionCallF2ARequestMessage        // requestId: string
  | FunctionCallF2AResultMessage         // requestId: string
  | FunctionCallRequestAgentMessage      // requestId: string
  | FunctionCallResultAgentMessage       // requestId: string
  | FrontendFunctionCallRequestMessage   // requestId: string
  | FrontendFunctionCallResultMessage;   // requestId: string

export type WebSocketMessage =
  | FrontBlockUpdateMessage
  | FrontBlockApprovalIntentMessage
  | AgentMCPListMessage
  | TodoMsgStartMessage
  | TodoMsgDoneMessage
  | TodoMsgErrorMessage
  | TodoMsgStopSequenceMessage
  | TodoMsgMetaUsrMessage
  | TodoMsgMetaAiMessage
  | NewTodo
  | BlockStartUniversalMessage
  | BlockStartTextMessage
  | BlockUpdateMessage
  | MessageUpdateMessage
  | MessageUpdateMessageProcessed
  | BlockMessageMessage
  | BlockEndMessage
  | BlockMessageResultMessage
  | BlockStartResultMessage
  | BlockDoneResultMessage
  | BlockMcpExecuteMessage
  | BlockMcpResultMessage
  | BlockSaveResultMessage
  | BlockErrorResultMessage
  | BlockMetaResultMessage
  | BlockDiffResultMessage
  // | TodoDirResultMessage
  | TaskNewMessage
  | BlockRefreshMessage
  | BlockExecuteMessage
  | BlockSaveMessage
  | BlockKeyboardMessage
  | BlockSignalMessage
  | BlockDiffMessage
  | BlockFileWatchMessage
  | BlockFileChangedMessage
  | EdgeCDMessage
  | EdgeCDResponseMessage
  | ProjectStatusMessage
  | TodoStatusMessage
  // | TaskActionNewMessage
  | EdgeStatusMessage
  | EdgeConfigUpdateMessage
  | ServerEdgeConfigUpdateMessage
  | TaskActionUpdateMessage
  | ConnectedFrontendMessage
  // | ConnectedAgentMessage
  // | ConnectedEdgeMessage
  | WorkspaceRequestMessage
  | BlockDiffFileRequestMessage
  | FrontendFileChunkRequestMessage
  | FrontendFileChunkResultMessage
  | FileChunkRequestMessage
  | FileChunkResultMessage
  | WorkspaceResultMessage
  | EdgeGetFoldersMessage
  | EdgeGetFoldersResponseMessage
  | WorkspaceFileCreateSyncMessage
  | WorkspaceFileModifySyncMessage
  | WorkspaceFileDeleteSyncMessage
  | WorkspaceFileDoneMessage
  // | WorkspaceResultMetaMessage
  | NewTodoMessage
  | NewTodoMessageCreated
  | NewProjectTodoMessage
  | TodoInterruptSignalMessage
  | TodoGracefulStopMessage
  | PaymentStatusMessage
  | PaymentWebhookMessage
  | EdgeDisconnectedMessage
  | FrontendFunctionCallRequestMessage
  | FrontendFunctionCallResultMessage
  | FunctionCallRequestAgentMessage
  | FunctionCallResultAgentMessage
  | FunctionCallF2ARequestMessage
  | FunctionCallF2AResultMessage
  | BusinessContextUpdatedMessage
  | ContextCompactRequestMessage
  | ContextCompactResultMessage
  | ToolApprovalResponseMessage
  | ToolsResolvedMessage;
