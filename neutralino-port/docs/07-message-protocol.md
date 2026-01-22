# Message Protocol Reference

## Overview

This document contains all message types used in communication between the edge, server, frontend, and agents. All messages use JSON format with `type` and `payload` fields.

## Message Structure

```typescript
interface Message {
  type: string;
  payload: Record<string, unknown>;
}
```

## Message Categories

### Server → Edge (S2E)

Messages sent from the server to the edge.

```typescript
// Connection established
{
  type: 'connected_edge',
  payload: {
    edgeId: string;
    userId: string;
  }
}

// Configuration update
{
  type: 'edge:config_update',
  payload: {
    workspacepaths?: string[];
    installedMCPs?: Record<string, MCPConfig>;
    name?: string;
    isShellEnabled?: boolean;
    isFileSystemEnabled?: boolean;
  }
}

// Error message
{
  type: 'error',
  payload: {
    message: string;
    code?: string;
  }
}
```

### Frontend → Edge (F2E)

Messages from the frontend requesting edge operations.

```typescript
// Directory listing
{
  type: 'edge:dir_list',
  payload: {
    path: string;
    todoId?: string;
  }
}

// Change directory
{
  type: 'edge:cd',
  payload: {
    path: string;
  }
}

// Execute shell block
{
  type: 'block:execute',
  payload: {
    blockId: string;
    content: string;
    todoId?: string;
    cwd?: string;
    timeout?: number;
    requestId?: string;
  }
}

// Save block content
{
  type: 'block:save',
  payload: {
    blockId: string;
    path: string;
    content: string;
  }
}

// Refresh block
{
  type: 'block:refresh',
  payload: {
    blockId: string;
    path: string;
  }
}

// Send keyboard input to process
{
  type: 'block:keyboard',
  payload: {
    blockId: string;
    input: string;
  }
}

// Create new task action
{
  type: 'task:action_new',
  payload: {
    action: string;
    todoId: string;
  }
}

// Get folder structure
{
  type: 'edge:get_folders',
  payload: {
    path: string;
    depth?: number;
  }
}

// File chunk request (frontend)
{
  type: 'frontend:file_chunk_request',
  payload: {
    path: string;
    requestId: string;
  }
}

// Function call request (frontend)
{
  type: 'FUNCTION_CALL_REQUEST_FRONT',
  payload: {
    functionName: string;
    args: Record<string, unknown>;
    requestId: string;
    edgeId?: string;
  }
}
```

### Agent → Edge (A2E)

Messages from agents requesting edge operations.

```typescript
// Workspace context request
{
  type: 'ctx:workspace_request',
  payload: {
    path: string;
    agentId: string;
  }
}

// Julia context request
{
  type: 'ctx:julia_request',
  payload: {
    agentId: string;
  }
}

// File chunk request (agent)
{
  type: 'file:chunk_request',
  payload: {
    path: string;
    requestId: string;
    agentId: string;
  }
}

// Function call request (agent)
{
  type: 'FUNCTION_CALL_REQUEST_AGENT',
  payload: {
    functionName: string;
    args: Record<string, unknown>;
    requestId: string;
    edgeId: string;
    agentId: string;
  }
}
```

### Edge → Frontend (E2F)

Responses from edge to frontend.

```typescript
// Edge status
{
  type: 'edge:status',
  payload: {
    edgeId: string;
    status: 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR';
  }
}

// Directory change response
{
  type: 'edge:cd_response',
  payload: {
    path: string;
    success: boolean;
    error?: string;
  }
}

// Shell block start
{
  type: 'block:sh_msg_start',
  payload: {
    blockId: string;
  }
}

// Shell block output
{
  type: 'block:sh_msg_result',
  payload: {
    blockId: string;
    output: string;
  }
}

// Shell block completion
{
  type: 'block:sh_done',
  payload: {
    blockId: string;
    returnCode: number;
  }
}

// Block save result
{
  type: 'block:save_result',
  payload: {
    blockId: string;
    success: boolean;
    error?: string;
  }
}

// Block error
{
  type: 'block:error_result',
  payload: {
    blockId: string;
    error: string;
  }
}

// File chunk result (frontend)
{
  type: 'frontend:file_chunk_result',
  payload: {
    requestId: string;
    path: string;
    content: string;
    error?: string;
  }
}

// Function call result (frontend)
{
  type: 'FUNCTION_CALL_RESULT_FRONT',
  payload: {
    requestId: string;
    result?: unknown;
    error?: string;
  }
}

// Task action update
{
  type: 'task:action_update',
  payload: {
    todoId: string;
    action: string;
    status: string;
  }
}
```

### Edge → Agent (E2A)

Responses from edge to agents.

```typescript
// Workspace context result
{
  type: 'ctx:workspace_result',
  payload: {
    path: string;
    files: string[];
    agentId: string;
  }
}

// Julia context result
{
  type: 'ctx:julia_result',
  payload: {
    agentId: string;
    // Julia-specific data
  }
}

// File chunk result (agent)
{
  type: 'file:chunk_result',
  payload: {
    requestId: string;
    path: string;
    content: string;
    error?: string;
    agentId: string;
  }
}

// Function call result (agent)
{
  type: 'FUNCTION_CALL_RESULT_AGENT',
  payload: {
    requestId: string;
    result?: unknown;
    error?: string;
    agentId: string;
  }
}
```

### Edge → Frontend/Agent (E2FA)

File sync messages (broadcast to both).

```typescript
// File created
{
  type: 'workspace:file_create_sync',
  payload: {
    path: string;
    content: string;
    edgeId: string;
    userId: string;
  }
}

// File modified
{
  type: 'workspace:file_modify_sync',
  payload: {
    path: string;
    content: string;
    edgeId: string;
    userId: string;
  }
}

// File deleted
{
  type: 'workspace:file_delete_sync',
  payload: {
    path: string;
    edgeId: string;
    userId: string;
  }
}

// Initial sync complete
{
  type: 'workspace:file_done',
  payload: {
    path: string;
    edgeId: string;
    userId: string;
    stats?: {
      filesSynced: number;
      filesSkipped: number;
      syncErrors: number;
      bytesSynced: number;
    };
  }
}
```

## TypeScript Type Definitions

```typescript
// src/types/protocol.ts

// Message type constants
export const MessageTypes = {
  // Server responses
  CONNECTED_EDGE: 'connected_edge',
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

// Payload type definitions
export interface ConnectedEdgePayload {
  edgeId: string;
  userId: string;
}

export interface EdgeConfigUpdatePayload {
  workspacepaths?: string[];
  installedMCPs?: Record<string, MCPConfig>;
  name?: string;
  isShellEnabled?: boolean;
  isFileSystemEnabled?: boolean;
}

export interface BlockExecutePayload {
  blockId: string;
  content: string;
  todoId?: string;
  cwd?: string;
  timeout?: number;
  requestId?: string;
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

export interface FileSyncPayload {
  path: string;
  content?: string;
  edgeId: string;
  userId: string;
}

// Generic message type
export interface Message<T = unknown> {
  type: MessageType;
  payload: T;
}
```

## Message Router Implementation

```typescript
// src/MessageRouter.ts
import { MessageTypes, MessageType, Message } from './types/protocol';

type MessageHandler = (payload: unknown) => Promise<void>;

export class MessageRouter {
  private handlers: Map<MessageType, MessageHandler[]> = new Map();

  on(type: MessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index >= 0) handlers.splice(index, 1);
      }
    };
  }

  async route(message: Message): Promise<void> {
    const handlers = this.handlers.get(message.type as MessageType);

    if (!handlers || handlers.length === 0) {
      console.warn(`No handler for message type: ${message.type}`);
      return;
    }

    // Run all handlers concurrently
    await Promise.all(
      handlers.map(handler =>
        handler(message.payload).catch(error => {
          console.error(`Handler error for ${message.type}:`, error);
        })
      )
    );
  }
}
```

## Message Builders

```typescript
// src/messages/builders.ts
import { MessageTypes, Message } from '../types/protocol';

export const messages = {
  // Status messages
  edgeStatus(edgeId: string, status: string): Message {
    return {
      type: MessageTypes.EDGE_STATUS,
      payload: { edgeId, status }
    };
  },

  // Shell messages
  shellStart(blockId: string): Message {
    return {
      type: MessageTypes.BLOCK_SH_MSG_START,
      payload: { blockId }
    };
  },

  shellOutput(blockId: string, output: string): Message {
    return {
      type: MessageTypes.BLOCK_SH_MSG_RESULT,
      payload: { blockId, output }
    };
  },

  shellDone(blockId: string, returnCode: number): Message {
    return {
      type: MessageTypes.BLOCK_SH_DONE,
      payload: { blockId, returnCode }
    };
  },

  shellError(blockId: string, error: string): Message {
    return {
      type: MessageTypes.BLOCK_ERROR_RESULT,
      payload: { blockId, error }
    };
  },

  // File messages
  fileChunkResult(
    requestId: string,
    path: string,
    content: string,
    error?: string,
    agentId?: string
  ): Message {
    return {
      type: agentId ? MessageTypes.FILE_CHUNK_RESULT : MessageTypes.FRONTEND_FILE_CHUNK_RESULT,
      payload: { requestId, path, content, error, agentId }
    };
  },

  // Function call messages
  functionCallResult(
    requestId: string,
    result: unknown,
    error?: string,
    agentId?: string
  ): Message {
    return {
      type: agentId
        ? MessageTypes.FUNCTION_CALL_RESULT_AGENT
        : MessageTypes.FUNCTION_CALL_RESULT_FRONT,
      payload: { requestId, result, error, agentId }
    };
  },

  // Save result
  blockSaveResult(blockId: string, success: boolean, error?: string): Message {
    return {
      type: MessageTypes.BLOCK_SAVE_RESULT,
      payload: { blockId, success, error }
    };
  },

  // File sync messages
  fileCreateSync(path: string, content: string, edgeId: string, userId: string): Message {
    return {
      type: MessageTypes.WORKSPACE_FILE_CREATE_SYNC,
      payload: { path, content, edgeId, userId }
    };
  },

  fileModifySync(path: string, content: string, edgeId: string, userId: string): Message {
    return {
      type: MessageTypes.WORKSPACE_FILE_MODIFY_SYNC,
      payload: { path, content, edgeId, userId }
    };
  },

  fileDeleteSync(path: string, edgeId: string, userId: string): Message {
    return {
      type: MessageTypes.WORKSPACE_FILE_DELETE_SYNC,
      payload: { path, edgeId, userId }
    };
  },

  fileSyncDone(path: string, edgeId: string, userId: string, stats?: object): Message {
    return {
      type: MessageTypes.WORKSPACE_FILE_DONE,
      payload: { path, edgeId, userId, stats }
    };
  }
};
```

## Usage Example

```typescript
// Setting up message handling
const router = new MessageRouter();
const edge = new Edge(config);

// Register handlers
router.on(MessageTypes.BLOCK_EXECUTE, async (payload) => {
  const { blockId, content, cwd, timeout } = payload as BlockExecutePayload;
  await shellHandler.executeBlock({ blockId, content, cwd, timeout });
});

router.on(MessageTypes.FILE_CHUNK_REQUEST, async (payload) => {
  const { path, requestId, agentId } = payload as FileChunkRequestPayload;
  await fileHandler.handleFileChunkRequest({ path, requestId, agentId });
});

// Connect WebSocket and route messages
wsClient.onMessage((message) => router.route(message));
```
