// Server Response Types
export const SR = {
  CONNECTED_FRONTEND: "connected_frontend",
  CONNECTED_AGENT: "connected_agent",
  CONNECTED_EDGE: "connected_edge",
} as const;

// Edge Status
export const EdgeStatus = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  CONNECTING: "CONNECTING",
  ERROR: "ERROR",
} as const;

// Frontend to Edge
export const FE = {
  TASK_ACTION_NEW: "task_action:new",
  EDGE_CD: "edge:cd",
  GET_FOLDERS: "edge:get_folders",
  BLOCK_EXECUTE: "block:execute",
  BLOCK_SAVE: "block:save",
  BLOCK_KEYBOARD: "block:keyboard",
  BLOCK_SIGNAL: "block:signal",
  FRONTEND_FILE_CHUNK_REQUEST: "frontend:file_chunk_request",
  FUNCTION_CALL_REQUEST_FRONT: "FUNCTION_CALL_REQUEST_FRONT",
} as const;

// Agent to Edge
export const AE = {
  CTX_JULIA_REQUEST: "ctx:julia_request",
  FILE_CHUNK_REQUEST: "file:chunk_request",
  FUNCTION_CALL_REQUEST_AGENT: "FUNCTION_CALL_REQUEST_AGENT",
} as const;

// Edge to Agent
export const EA = {
  CTX_JULIA_RESULT: "ctx:julia_result",
  FILE_CHUNK_RESULT: "file:chunk_result",
  EDGE_DISCONNECTED: "edge:disconnected",
  FUNCTION_CALL_RESULT_AGENT: "FUNCTION_CALL_RESULT_AGENT",
} as const;

// Edge to Frontend
export const EF = {
  TASK_ACTION_UPDATE: "task_action:update",
  EDGE_STATUS: "edge:status",
  EDGE_CD_RESPONSE: "edge:cd_response",
  EDGE_GET_FOLDERS_RESPONSE: "edge:get_folders_response",
  BLOCK_SAVE_RESULT: "block:save_result",
  BLOCK_ERROR_RESULT: "block:error_result",
  BLOCK_META_RESULT: "block:meta_result",
  BLOCK_FILE_CHANGED: "block:file_changed",
  FUNCTION_CALL_RESULT_FRONT: "FUNCTION_CALL_RESULT_FRONT",
  BLOCK_SH_MSG_RESULT: "block:sh_msg_result",
  BLOCK_SH_MSG_START: "block:sh_msg_start",
  BLOCK_SH_DONE: "block:sh_done",
  FRONTEND_FILE_CHUNK_RESULT: "frontend:file_chunk_result",
} as const;

// Edge to Frontend+Agent
export const EFA = {} as const;

// Server to Edge
export const S2E = {
  EDGE_CONFIG_UPDATE: "edge:config_update",
} as const;

// ── Message builders ──

export type WsMessage = { type: string; payload: Record<string, any> };

export const msg = {
  edgeStatus(edgeId: string, status: string): WsMessage {
    return { type: EF.EDGE_STATUS, payload: { edgeId, status } };
  },

  shellBlockStart(todoId: string, blockId: string, mode: string, messageId: string): WsMessage {
    return { type: EF.BLOCK_SH_MSG_START, payload: { todoId, messageId, blockId, mode } };
  },

  shellBlockResult(todoId: string, blockId: string, content: string, messageId: string): WsMessage {
    return { type: EF.BLOCK_SH_MSG_RESULT, payload: { todoId, messageId, blockId, content } };
  },

  shellBlockDone(todoId: string, messageId: string, blockId: string, mode: string, returnCode: number, runMode?: string): WsMessage {
    const payload: Record<string, any> = { todoId, messageId, blockId, mode, return_code: returnCode };
    if (runMode) payload.runMode = runMode;
    return { type: EF.BLOCK_SH_DONE, payload };
  },

  blockSaveResult(blockId: string, todoId: string, result: string, requestId?: string): WsMessage {
    return { type: EF.BLOCK_SAVE_RESULT, payload: { blockId, todoId, result, requestId } };
  },

  blockError(blockId: string, todoId: string, error: string): WsMessage {
    return { type: EF.BLOCK_ERROR_RESULT, payload: { blockId, todoId, error } };
  },

  blockMeta(blockId: string, extra: Record<string, any> = {}): WsMessage {
    return { type: EF.BLOCK_META_RESULT, payload: { blockId, ...extra } };
  },

  taskActionUpdate(taskId: string, edgeId: string, status: string, message?: string): WsMessage {
    const payload: Record<string, any> = { taskId, edgeId, status };
    if (message) payload.message = message;
    return { type: EF.TASK_ACTION_UPDATE, payload };
  },

  cdResponse(edgeId: string, path: string, requestId: string, success = true, error?: string): WsMessage {
    const payload: Record<string, any> = { edgeId, path, success, requestId };
    if (error) payload.error = error;
    return { type: EF.EDGE_CD_RESPONSE, payload };
  },

  ctxJuliaResult(todoId: string, messageId: string, filepaths?: string[], contents?: string[], error?: string): WsMessage {
    const payload: Record<string, any> = { todoId, messageId };
    if (filepaths) payload.filepaths = filepaths;
    if (contents) payload.contents = contents;
    if (error) payload.error = error;
    return { type: EA.CTX_JULIA_RESULT, payload };
  },

  fileChunkResult(responseType: string, extra: Record<string, any>): WsMessage {
    return { type: responseType, payload: { ...extra } };
  },

  getFoldersResponse(requestId: string, edgeId: string, folders: string[], files: string[], error?: string, actualPath?: string): WsMessage {
    const payload: Record<string, any> = { requestId, edgeId, folders, files, error: error ?? null };
    if (actualPath != null) payload.actualPath = actualPath;
    return { type: EF.EDGE_GET_FOLDERS_RESPONSE, payload };
  },

  functionCallResult(requestId: string, edgeId: string, success: boolean, result?: any, error?: string, agentId?: string): WsMessage {
    const payload: Record<string, any> = { requestId, edgeId, success };
    if (agentId != null) payload.agentId = agentId;
    if (result != null) payload.result = result;
    if (error != null) payload.error = error;
    return { type: EA.FUNCTION_CALL_RESULT_AGENT, payload };
  },

  functionCallResultFront(requestId: string, edgeId: string, success: boolean, result?: any, error?: string, blockInfo?: Record<string, any>): WsMessage {
    const payload: Record<string, any> = { requestId, edgeId, success };
    if (result != null) payload.result = result;
    if (error != null) payload.error = error;
    if (blockInfo) payload.blockInfo = blockInfo;
    return { type: EF.FUNCTION_CALL_RESULT_FRONT, payload };
  },
};
