
# Server Response Types
class ServerResponse:
    CONNECTED_FRONTEND = 'connected_frontend'
    CONNECTED_AGENT = 'connected_agent'
    CONNECTED_EDGE = 'connected_edge'


# Frontend to Edge Messages
class Front2Edge:
    # Task operations
    TASK_ACTION_NEW = 'task_action:new'

    # Todo operations
    EDGE_CD = 'todo:cd'
    EDGE_DIR_LIST = 'todo:dir'

    # Block operations
    BLOCK_REFRESH = 'block:refresh'
    BLOCK_EXECUTE = 'block:execute'
    BLOCK_SAVE = 'block:save'
    BLOCK_KEYBOARD = 'block:keyboard'
    BLOCK_SIGNAL = 'block:signal'
    BLOCK_DIFF = 'block:diff'


# Agent to Edge Messages
class Agent2Edge:
    CTX_JULIA_REQUEST = 'ctx:julia_request'
    CTX_WORKSPACE_REQUEST = 'ctx:workspace_request'
    DIFF_FILE_REQUEST = 'diff:file_request'


# Edge to Agent Messages
class Edge2Agent:
    CTX_JULIA_RESULT = 'ctx:julia_result'
    CTX_WORKSPACE_RESULT = 'ctx:workspace_result'
    DIFF_FILE_RESULT = 'diff:file_result'


# Edge to Frontend Messages
class Edge2Front:
    # Task responses
    TASK_ACTION_UPDATE = 'task_action:update'

    # Agent responses
    EDGE_STATUS = 'edge:status'
    
    # Project responses
    EDGE_DIR_RESULT = 'project:dir_result'
    
    # Block responses
    BLOCK_MESSAGE_RESULT = 'block:message_result'
    BLOCK_START_RESULT = 'block:start_result'
    BLOCK_DONE_RESULT = 'block:done_result'
    BLOCK_SAVE_RESULT = 'block:save_result'
    BLOCK_ERROR_RESULT = 'block:error_result'
    BLOCK_META_RESULT = 'block:meta_result'
    BLOCK_DIFF_RESULT = 'block:diff_result'


# Shorthand aliases
AE = Agent2Edge
FE = Front2Edge
EA = Edge2Agent
EF = Edge2Front
SR = ServerResponse
