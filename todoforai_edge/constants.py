
# Server Response Types
class ServerResponse:
    CONNECTED_FRONTEND = 'connected_frontend'
    CONNECTED_AGENT = 'connected_agent'
    CONNECTED_EDGE = 'connected_edge'


# Edge Status Types
class EdgeStatus:
    ONLINE = 'ONLINE'
    OFFLINE = 'OFFLINE'
    CONNECTING = 'CONNECTING'
    ERROR = 'ERROR'


# Frontend to Edge Messages
class Front2Edge:
    # Task operations
    TASK_ACTION_NEW = 'task_action:new'

    # Todo operations
    EDGE_CD = 'edge:cd'
    EDGE_DIR_LIST = 'edge:dir'
    GET_FOLDERS = 'edge:get_folders'

    # Block operations
    BLOCK_REFRESH = 'block:refresh'
    BLOCK_EXECUTE = 'block:execute'
    BLOCK_SAVE = 'block:save'
    BLOCK_KEYBOARD = 'block:keyboard'
    BLOCK_SIGNAL = 'block:signal'
    BLOCK_DIFF = 'block:diff'
    FRONTEND_FILE_CHUNK_REQUEST = 'frontend:file_chunk_request'
    
    # Function call operations
    CALL_EDGE_METHOD = 'call_edge_method'
    

# Agent to Edge Messages
class Agent2Edge:
    CTX_JULIA_REQUEST = 'ctx:julia_request'
    CTX_WORKSPACE_REQUEST = 'ctx:workspace_request'
    FILE_CHUNK_REQUEST = 'file:chunk_request'
    FUNCTION_CALL_REQUEST = 'FUNCTION_CALL_REQUEST'


# Edge to Agent Messages
class Edge2Agent:
    CTX_JULIA_RESULT = 'ctx:julia_result'
    CTX_WORKSPACE_RESULT = 'ctx:workspace_result'
    FILE_CHUNK_RESULT = 'file:chunk_result'
    FUNCTION_CALL_RESULT = 'FUNCTION_CALL_RESULT'


# Edge to Frontend Messages
class Edge2Front:
    # Task responses
    TASK_ACTION_UPDATE = 'task_action:update'

    # Agent responses
    EDGE_STATUS = 'edge:status'
    
    # Project responses
    EDGE_DIR_RESPONSE = 'edge:dir_response'
    EDGE_CD_RESPONSE = 'edge:cd_response'
    EDGE_GET_FOLDERS_RESPONSE = 'edge:get_folders_response'
    
    # Block responses
    BLOCK_SAVE_RESULT = 'block:save_result'
    BLOCK_ERROR_RESULT = 'block:error_result'
    BLOCK_META_RESULT = 'block:meta_result'
    BLOCK_DIFF_RESULT = 'block:diff_result'
    
    # Function call responses
    CALL_EDGE_METHOD_RESULT = 'call_edge_method_result'
    
    # Shell block responses (updated to match protocol)
    BLOCK_SH_MSG_RESULT = 'block:sh_msg_result'
    BLOCK_SH_MSG_START = 'block:sh_msg_start'
    BLOCK_SH_DONE = 'block:sh_done'
    FRONTEND_FILE_CHUNK_RESULT = 'frontend:file_chunk_result'
    
    
class Edge2FrontAgent:
    WORKSPACE_FILE_CREATE_SYNC = "workspace:file_create_sync"
    WORKSPACE_FILE_MODIFY_SYNC = "workspace:file_modify_sync"
    WORKSPACE_FILE_DELETE_SYNC = "workspace:file_delete_sync"
    WORKSPACE_FILE_DONE = "workspace:file_done"


class Server2Edge:
    """Messages from server to edge"""
    EDGE_CONFIG_UPDATE = 'edge:config_update'

# Shorthand aliases
AE = Agent2Edge
FE = Front2Edge
EA = Edge2Agent
EF = Edge2Front
EFA = Edge2FrontAgent
SR = ServerResponse
S2E = Server2Edge
