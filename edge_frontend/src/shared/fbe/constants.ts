export enum ServerResponse {
  CONNECTED_FRONTEND = 'connected_frontend',
  CONNECTED_AGENT    = 'connected_agent',
  CONNECTED_EDGE     = 'connected_edge',
}

export enum Server2Edge {
  EDGE_CONFIG_UPDATE = 'edge:config_update',
}

export enum Server2Front {
  TODO_STATUS = 'todo:status',
  NEW_TODO = 'todo:new',
  BUSINESS_CONTEXT_UPDATED = 'business_context:updated',
}

export enum Front2Front {
  TASK_NEW = 'task:new_update',
}
export enum Front2Agent {
  // Task operations
  TASK_NEW    = 'task:new',
  BLOCK_DIFF  = 'block:diff',
  TODO_INTERRUPT_SIGNAL = 'todo:interrupt_signal',

  // Context operations
  CONTEXT_COMPACT_REQUEST = 'context:compact_request',

  // Function call operations
  FUNCTION_CALL_F2A_REQUEST = 'FUNCTION_CALL_F2A_REQUEST',
}
export enum Edge2Agent {
  CTX_JULIA_RESULT = 'ctx:julia_result',
  CTX_WORKSPACE_RESULT = 'ctx:workspace_result',
  FILE_CHUNK_RESULT = 'file:chunk_result',
  EDGE_DISCONNECTED = 'edge:disconnected',
  FUNCTION_CALL_RESULT_AGENT = 'FUNCTION_CALL_RESULT_AGENT',
}
export enum Front2Edge {
  // Task operations
  TASK_ACTION_NEW = 'task_action:new',

  // Project operations
  PROJECT_STATUS_SCHEDULED_DATE = 'project:status_scheduled_date', // szerintem ez majd a scheduler dolga lesz

  // Edge operations
  EDGE_CD          = 'edge:cd',
  EDGE_GET_FOLDERS = 'edge:get_folders',

  // Block operations
  BLOCK_REFRESH    = 'block:refresh',
  BLOCK_EXECUTE    = 'block:execute',
  BLOCK_SAVE       = 'block:save',
  BLOCK_KEYBOARD   = 'block:keyboard',
  BLOCK_SIGNAL     = 'block:signal',
  BLOCK_FILE_WATCH = 'block:file_watch',
  FRONTEND_FILE_CHUNK_REQUEST = 'frontend:file_chunk_request',

  // Function call operations
  FUNCTION_CALL_REQUEST_FRONT = 'FUNCTION_CALL_REQUEST_FRONT',
}
export enum Agent2Edge {
  CTX_WORKSPACE_REQUEST = 'ctx:workspace_request',
  DIFF_FILE_REQUEST = 'diff:file_request',
  FILE_CHUNK_REQUEST = 'file:chunk_request',
  FUNCTION_CALL_REQUEST_AGENT = 'FUNCTION_CALL_REQUEST_AGENT',
}

export enum Agent2Front {
  // Project responses
  PROJECT_STATUS     = 'project:status',

  // Agent responses
  AGENT_STATUS       = 'agent:status',

  AGENT_MCP_LIST     = 'agent:mcp_list',

  //  Todo responses
  TODO_MSG_START     = 'todo:msg_start',
  TODO_MSG_DONE      = 'todo:msg_done',
  TODO_MSG_ERROR     = 'todo:msg_error',
  TODO_MSG_STOP_SEQUENCE = 'todo:msg_stop_sequence',
  TODO_MSG_META_USR = 'todo:msg_meta_usr',
  TODO_MSG_META_AI  = 'todo:msg_meta_ai',
  TODO_DIR_RESULT   = 'dir_result:todos',

  // Block responses
  BLOCK_DIFF_RESULT             = 'block:diff_result',
  BLOCK_START_CATFILE           = 'block:start_catfile',
  BLOCK_START_UNIVERSAL         = 'block:start_universal',
  BLOCK_START_CLICK             = 'block:start_click',
  BLOCK_START_CREATEFILE        = 'block:start_createfile',
  BLOCK_START_MODIFYFILE        = 'block:start_modifyfile',
  BLOCK_START_SENDKEY           = 'block:start_sendkey',
  BLOCK_START_SHELL             = 'block:start_shell',
  BLOCK_START_WEBSEARCH         = 'block:start_websearch',
  BLOCK_START_WORKSPACE_SEARCH  = 'block:start_workspace_search',
  BLOCK_START_EMAIL             = 'block:start_email',
  BLOCK_START_TEXT              = 'block:start_text',
  BLOCK_START_ERROR             = 'block:start_error',
  BLOCK_START_MCP               = 'block:start_mcp',
  BLOCK_START_BROWSER           = 'block:start_browser',
  BLOCK_MESSAGE                 = 'block:message',
  BLOCK_END                     = 'block:end',

  // MCP responses
  MCP_TOOL_RESULT               = 'mcp:tool_result',

  // Workspace responses
  // CTX_WORKSPACE_RESULT_META = 'ctx:workspace_result_meta',
  TODO_NEW_MESSAGE          = 'todo:new_message',
  TODO_NEW_MESSAGE_CREATED  = 'todo:new_message_created',

  // Payment responses
  PAYMENT_STATUS            = 'payment:status',
  PAYMENT_WEBHOOK           = 'payment:webhook',

  // Function call responses
  FUNCTION_CALL_F2A_RESULT = 'FUNCTION_CALL_F2A_RESULT',

  // Context responses
  CONTEXT_COMPACT_RESULT = 'context:compact_result',

  // New constant
  BLOCK_UPDATE = 'BLOCK_UPDATE',
  MESSAGE_UPDATE = 'MESSAGE_UPDATE',
}

export enum Edge2Front {
  // Task responses
  TASK_ACTION_UPDATE = 'task_action:update',

  // Agent responses
  EDGE_STATUS = 'edge:status',
  EDGE_CONFIG_UPDATE = 'EDGE_CONFIG_UPDATE',
  // Project responses
  EDGE_CD_RESPONSE = 'edge:cd_response',
  EDGE_GET_FOLDERS_RESPONSE = 'edge:get_folders_response',

  // Block responses
  BLOCK_SH_MSG_RESULT         = 'block:sh_msg_result',
  BLOCK_SH_MSG_START          = 'block:sh_msg_start',
  BLOCK_SH_DONE               = 'block:sh_done',
  BLOCK_SAVE_RESULT           = 'block:save_result',
  BLOCK_ERROR_RESULT          = 'block:error_result',
  BLOCK_META_RESULT           = 'block:meta_result',
  BLOCK_FILE_CHANGED          = 'block:file_changed',
  FRONTEND_FILE_CHUNK_RESULT  = 'frontend:file_chunk_result',

  // Function call responses
  FUNCTION_CALL_RESULT_FRONT = 'FUNCTION_CALL_RESULT_FRONT',
}
export enum Edge2FrontAgent {
  WORKSPACE_FILE_CREATE_SYNC = 'workspace:file_create_sync',
  WORKSPACE_FILE_MODIFY_SYNC = 'workspace:file_modify_sync',
  WORKSPACE_FILE_DELETE_SYNC = 'workspace:file_delete_sync',
  WORKSPACE_FILE_DONE        = 'workspace:file_done',
}

// New enum added from patch
export enum Front2Server {
  BLOCK_UPDATE = 'BLOCK_UPDATE',
}

export const AF = Agent2Front;
export const AE = Agent2Edge;
export const FF = Front2Front;
export const FA = Front2Agent;
export const FE = Front2Edge;
export const EA = Edge2Agent;
export const EF = Edge2Front;
export const EFA = Edge2FrontAgent;
export const SR = ServerResponse;
export const FS = Front2Server;
