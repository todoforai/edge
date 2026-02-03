import { Agent2Edge, Agent2Front, Edge2Agent, Edge2Front, Edge2FrontAgent, Front2Agent, Front2Edge, Front2Front, Server2Front, Server2Edge } from './constants';

export const SERVER_TO_FRONTENDS = {
  task: {
    actionUpdate: (userId: string) => `${Edge2Front.TASK_ACTION_UPDATE}:${userId}`,
  },
  businessContext: {
    updated: (userId: string) => `${Server2Front.BUSINESS_CONTEXT_UPDATED}:${userId}`,
  },
  agent: {
    status:       (userId: string) => `${Agent2Front.AGENT_STATUS}:${userId}`,
    mcpList:                    () => `${Agent2Front.AGENT_MCP_LIST}:ALL`,
  },
  edge: {
    status:           (userId: string) => `${Edge2Front.EDGE_STATUS}:${userId}`,
    configUpdate:     (userId: string) => `${Edge2Front.EDGE_CONFIG_UPDATE}:${userId}`,
    cdResult:         (edgeId: string) => `${Edge2Front.EDGE_CD_RESPONSE}:${edgeId}`,
    getFoldersResult: (edgeId: string) => `${Edge2Front.EDGE_GET_FOLDERS_RESPONSE}:${edgeId}`,
  },
  project: {
    new_message:    (projectId: string) => `${Front2Front.TASK_NEW}:${projectId}`,
    new_todo:       (projectId: string) => `${Server2Front.NEW_TODO}:${projectId}`,
    status:         (projectId: string) => `${Agent2Front.PROJECT_STATUS}:${projectId}`,
    // statusScheduledDate: (projectId: string) => `${Edge2Front.PROJECT_STATUS_SCHEDULED_DATE}:${projectId}`,
  },
  todo: {
    // juliaCtx:        (todoId: string) => `${Agent2Front.TODO_JULIA_CTX}:${todoId}`,
    msgStart:        (todoId: string) => `${Agent2Front.TODO_MSG_START}:${todoId}`,
    msgDone:         (todoId: string) => `${Agent2Front.TODO_MSG_DONE}:${todoId}`,
    msgError:        (todoId: string) => `${Agent2Front.TODO_MSG_ERROR}:${todoId}`,
    msgStopSequence: (todoId: string) => `${Agent2Front.TODO_MSG_STOP_SEQUENCE}:${todoId}`,
    msgMetaUsr:      (todoId: string) => `${Agent2Front.TODO_MSG_META_USR}:${todoId}`,
    msgMetaAi:       (todoId: string) => `${Agent2Front.TODO_MSG_META_AI}:${todoId}`,
    start_catfile:     (todoId: string) => `${Agent2Front.BLOCK_START_CATFILE}:${todoId}`,
    start_universal:   (todoId: string) => `${Agent2Front.BLOCK_START_UNIVERSAL}:${todoId}`,
    start_click:       (todoId: string) => `${Agent2Front.BLOCK_START_CLICK}:${todoId}`,
    start_createfile:  (todoId: string) => `${Agent2Front.BLOCK_START_CREATEFILE}:${todoId}`,
    start_modifyfile:  (todoId: string) => `${Agent2Front.BLOCK_START_MODIFYFILE}:${todoId}`,
    start_sendkey:     (todoId: string) => `${Agent2Front.BLOCK_START_SENDKEY}:${todoId}`,
    start_shell:       (todoId: string) => `${Agent2Front.BLOCK_START_SHELL}:${todoId}`,
    start_websearch:   (todoId: string) => `${Agent2Front.BLOCK_START_WEBSEARCH}:${todoId}`,
    start_workspace_search: (todoId: string) => `${Agent2Front.BLOCK_START_WORKSPACE_SEARCH}:${todoId}`,
    start_text:        (todoId: string) => `${Agent2Front.BLOCK_START_TEXT}:${todoId}`,
    start_error:       (todoId: string) => `${Agent2Front.BLOCK_START_ERROR}:${todoId}`,
    start_mcp:         (todoId: string) => `${Agent2Front.BLOCK_START_MCP}:${todoId}`,
    start_browser:     (todoId: string) => `${Agent2Front.BLOCK_START_BROWSER}:${todoId}`,

    message:           (todoId: string) => `${Agent2Front.BLOCK_MESSAGE}:${todoId}`,
    end:               (todoId: string) => `${Agent2Front.BLOCK_END}:${todoId}`,
    new_message:       (todoId: string) => `${Agent2Front.TODO_NEW_MESSAGE}:${todoId}`,

    sh_msg_result:        (todoId: string) => `${Edge2Front.BLOCK_SH_MSG_RESULT}:${todoId}`,
    sh_msg_start_result:  (todoId: string) => `${Edge2Front.BLOCK_SH_MSG_START}:${todoId}`,
    sh_msg_done_result:   (todoId: string) => `${Edge2Front.BLOCK_SH_DONE}:${todoId}`,

    save_result:          (todoId: string) => `${Edge2Front.BLOCK_SAVE_RESULT}:${todoId}`,
    diff_result:          (todoId: string) => `${Agent2Front.BLOCK_DIFF_RESULT}:${todoId}`,
    frontend_file_chunk_result:    (todoId: string) => `${Edge2Front.FRONTEND_FILE_CHUNK_RESULT}:${todoId}`,

    status: (todoId: string) => `todo:${todoId}:status`,
    block_update: (todoId: string) => `todo:${todoId}:block_update`,
    message_update: (todoId: string) => `todo:${todoId}:message_update`, // NEW

    error_result:         (todoId: string) => `${Edge2Front.BLOCK_ERROR_RESULT}:${todoId}`,
    meta_result:          (todoId: string) => `${Edge2Front.BLOCK_META_RESULT}:${todoId}`,

    file_changed: (edgeId: string, path: string) => `${Edge2Front.BLOCK_FILE_CHANGED}:${edgeId}:${path}`,

    mcpToolResult: (todoId: string) => `${Agent2Front.MCP_TOOL_RESULT}:${todoId}`,
  },
  payment: {
    status: (userId: string) => `${Agent2Front.PAYMENT_STATUS}:${userId}`,
  },
  functions: {
    // this is direct so no need.
    // function_call_f2a_result: (userId: string) => `${Agent2Front.FUNCTION_CALL_F2A_RESULT}:${userId}`,
  },
};

export const SERVER_TO_AGENTFRONTEND = {
  workspace: {
    file_create_sync: (userId: string, path: string) => `${Edge2FrontAgent.WORKSPACE_FILE_CREATE_SYNC}:${userId}:${path}`,
    file_modify_sync: (userId: string, path: string) => `${Edge2FrontAgent.WORKSPACE_FILE_MODIFY_SYNC}:${userId}:${path}`,

    file_done: (todoId: string) => `${Edge2FrontAgent.WORKSPACE_FILE_DONE}:${todoId}`
  }
};
export const SERVER_TO_AGENTS = {
  task: {
    new_message:           () => `${Front2Agent.TASK_NEW}:ALL`,
    todo_interrupt_signal: () => `${Front2Agent.TODO_INTERRUPT_SIGNAL}:ALL`,
  },
  block: {
    diff:            () => `${Front2Agent.BLOCK_DIFF}:ALL`,
  },
  context: {
    compact_request: () => `${Front2Agent.CONTEXT_COMPACT_REQUEST}:ALL`,
  },
  tool: {
    approval_response: () => `${Front2Agent.TOOL_APPROVAL_RESPONSE}:ALL`,
    tools_resolved: () => `${Front2Agent.TOOLS_RESOLVED}:ALL`,
  },
  ctx: {
    julia_result: (agentId: string) => `${Edge2Agent.CTX_JULIA_RESULT}:${agentId}`,
    workspace_result: (agentId: string) => `${Edge2Agent.CTX_WORKSPACE_RESULT}:${agentId}`,
  },
  functions: {
    file_chunk_result: (agentId: string) => `${Edge2Agent.FILE_CHUNK_RESULT}:${agentId}`,
    function_call_result_agent: (agentId: string) => `${Edge2Agent.FUNCTION_CALL_RESULT_AGENT}:${agentId}`,
    function_call_f2a_request: () => `${Front2Agent.FUNCTION_CALL_F2A_REQUEST}:ALL`,
  },
  workspace: {
    file_create_sync: () => `${Edge2FrontAgent.WORKSPACE_FILE_CREATE_SYNC}:ALL`,
    file_modify_sync: () => `${Edge2FrontAgent.WORKSPACE_FILE_MODIFY_SYNC}:ALL`,
    file_delete_sync: () => `${Edge2FrontAgent.WORKSPACE_FILE_DELETE_SYNC}:ALL`,
  },
  edge: {
    disconnected: () => `${Edge2Agent.EDGE_DISCONNECTED}:ALL`,
  }
};

export const SERVER_TO_EDGES = {
  task: {
    new_action: (userId: string, edgeId: string) => `${Front2Edge.TASK_ACTION_NEW}:${userId}:${edgeId}`
  },
  edge: {
    cd:         (userId: string, edgeId: string) => `${Front2Edge.EDGE_CD}:${userId}:${edgeId}`,
    getFolders: (edgeId: string)                 => `${Front2Edge.EDGE_GET_FOLDERS}:${edgeId}`,
    configUpdate: (userId: string, edgeId: string) => `${Server2Edge.EDGE_CONFIG_UPDATE}:${userId}:${edgeId}`,
  },
  block: {
    refresh: (userId: string, edgeId: string) => `${Front2Edge.BLOCK_REFRESH}:${userId}:${edgeId}`,
    execute: (userId: string, edgeId: string) => `${Front2Edge.BLOCK_EXECUTE}:${userId}:${edgeId}`,
    save:    (userId: string, edgeId: string) => `${Front2Edge.BLOCK_SAVE}:${userId}:${edgeId}`,
    keyboard:(userId: string, edgeId: string) => `${Front2Edge.BLOCK_KEYBOARD}:${userId}:${edgeId}`,
    signal:  (userId: string, edgeId: string) => `${Front2Edge.BLOCK_SIGNAL}:${userId}:${edgeId}`,
    fileWatch: (edgeId: string, path: string) => `${Front2Edge.BLOCK_FILE_WATCH}:${edgeId}:${path}`,
    mcpExecute: (edgeId: string) => `${Front2Edge.BLOCK_MCP_EXECUTE}:${edgeId}`,
  },
  ctx: {
    workspace_request: (edgeId: string) => `${Agent2Edge.CTX_WORKSPACE_REQUEST}:${edgeId}`,
  },
  functions: {
    diff_file_request: (edgeId: string) => `${Agent2Edge.DIFF_FILE_REQUEST}:${edgeId}`,
    file_chunk_request: (edgeId: string) => `${Agent2Edge.FILE_CHUNK_REQUEST}:${edgeId}`,
    function_call_request_front: (edgeId: string) => `${Front2Edge.FUNCTION_CALL_REQUEST_FRONT}:${edgeId}`,
    function_call_request_agent: (edgeId: string) => `${Agent2Edge.FUNCTION_CALL_REQUEST_AGENT}:${edgeId}`,
  },
};
