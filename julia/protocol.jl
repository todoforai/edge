# Agent response types
const TASK_UPDATE = "task:update"
const AGENT_STATUS = "agent:status"
const PROJECT_DIR_RESULT = "project:dir_result"
const PROJECT_TODO_STATUS = "project:status"

const TODO_MESSAGE = "todo:message"
const TODO_JULIA_CTX = "todo:juliaCTX"
const TODO_WORKSPACE_CTX = "todo:workspaceCTX"
const TODO_MSG_START = "todo:msg_start"
const TODO_MSG_DONE = "todo:msg_done"
const TODO_MSG_ERROR = "todo:msg_error"
const TODO_MSG_STOP_SEQUENCE = "todo:msg_stop_sequence"
const TODO_MSG_META_USR = "todo:msg_meta_usr"
const TODO_MSG_META_AI = "todo:msg_meta_ai"
const TODO_STATUS = "todo:status"
const TODO_DIR_RESULT = "dir_result:todos"

const BLOCK_START_CATFILE = "block:start_catfile"
const BLOCK_START_CLICK = "block:start_click"
const BLOCK_START_CREATEFILE = "block:start_createfile"
const BLOCK_START_MODIFYFILE = "block:start_modifyfile"
const BLOCK_START_SENDKEY = "block:start_sendkey"
const BLOCK_START_SHELL = "block:start_shell"
const BLOCK_START_WEBSEARCH = "block:start_websearch"
const BLOCK_START_TEXT = "block:start_text"
const BLOCK_MESSAGE = "block:message"
const BLOCK_END = "block:end"


const BLOCK_START_RESULT = "block:start_result"
const BLOCK_DONE_RESULT = "block:done_result"
const BLOCK_SAVE_RESULT = "block:save_result"
const BLOCK_MESSAGE_RESULT = "block:message_result"
const BLOCK_ERROR_RESULT = "block:error_result"
const BLOCK_META_RESULT = "block:meta_result"

const BLOCK_DIFF_RESULT = "block:diff_result"

# Frontend request types
const TASK_NEW = "task:new"
const PROJECT_DIR_LIST = "project:dir"
const PROJECT_CD = "project:cd"
const TODO_CD = "todo:cd"
const TODO_DIR_LIST = "todo:dir"
const BLOCK_REFRESH = "block:refresh"
const BLOCK_EXECUTE = "block:execute"
const BLOCK_SAVE = "block:save"
const BLOCK_KEYBOARD = "block:keyboard"
const BLOCK_SIGNAL = "block:signal"
const BLOCK_DIFF = "block:diff"

# Server response types
const CONNECTED_AGENT = "connected_agent"

# Helper functions to construct properly formatted messages
function agent_status_msg(agent_id::String, status::String)
    Dict("type" => AGENT_STATUS,
         "payload" => Dict("agentId" => agent_id, "status" => status))
end

function todo_message_msg(todo_id::String, content::String; message_id::Union{String,Nothing}=nothing)
    Dict("type" => TODO_MESSAGE,
         "payload" => Dict("todoId" => todo_id, "messageId" => message_id, "content" => content))
end

function todo_status_msg(todo_id::String, status::String)
    Dict("type" => TODO_STATUS,
         "payload" => Dict("todoId" => todo_id, "status" => status))
end
function project_todo_status_msg(todo_id::String, status::String)
    Dict("type" => PROJECT_TODO_STATUS,
         "payload" => Dict("todoId" => todo_id, "status" => status))
end

function block_message_msg(block_id::String, content::String)
    Dict("type" => BLOCK_MESSAGE,
         "payload" => Dict("blockId" => block_id, "content" => content))
end

function project_dir_result_msg(project_id::String, paths::Vector{String})
    Dict("type" => PROJECT_DIR_RESULT,
         "payload" => Dict("projectId" => project_id, "paths" => paths))
end

function task_update_msg(task_id::String, status::String)
    Dict("type" => TASK_UPDATE,
         "payload" => Dict("taskId" => task_id, "status" => status))
end

function todo_julia_ctx_msg(todo_id::String, content::String; message_id::Union{String,Nothing}=nothing)
    Dict("type" => TODO_JULIA_CTX,
         "payload" => Dict("todoId" => todo_id, "messageId" => message_id, "content" => content))
end

function todo_workspace_ctx_msg(todo_id::String, content::String; message_id::Union{String,Nothing}=nothing)
    Dict("type" => TODO_WORKSPACE_CTX,
         "payload" => Dict("todoId" => todo_id, "messageId" => message_id, "content" => content))
end

function todo_msg_start_msg(todo_id::String, mode::String; message_id::Union{String,Nothing}=nothing)
    Dict("type" => TODO_MSG_START,
         "payload" => Dict("todoId" => todo_id, "messageId" => message_id, "mode" => mode))
end

function todo_msg_done_msg(todo_id::String, mode::String; message_id::Union{String,Nothing}=nothing)
    Dict("type" => TODO_MSG_DONE,
         "payload" => Dict("todoId" => todo_id, "messageId" => message_id, "mode" => mode))
end

function todo_msg_error_msg(todo_id::String, error::String; message_id::Union{String,Nothing}=nothing)
    Dict("type" => TODO_MSG_ERROR,
         "payload" => Dict("todoId" => todo_id, "messageId" => message_id, "error" => error))
end

function todo_msg_stop_sequence_msg(todo_id::String, stop_sequence::String; message_id::Union{String,Nothing}=nothing)
    Dict("type" => TODO_MSG_STOP_SEQUENCE,
         "payload" => Dict("todoId" => todo_id, "messageId" => message_id, "stop_sequence" => stop_sequence))
end

function block_start_msg(block_id::String, mode::String)
    Dict("type" => BLOCK_START,
         "payload" => Dict("blockId" => block_id, "mode" => mode))
end

function block_done_msg(block_id::String, mode::String)
    Dict("type" => BLOCK_DONE,
         "payload" => Dict("blockId" => block_id, "mode" => mode))
end

function block_save_result_msg(block_id::String, todo_id::String, result::String)
    Dict("type" => BLOCK_SAVE_RESULT,
         "payload" => Dict("blockId" => block_id, 
                            "todoId" => todo_id, 
                            "result" => result))
end

function block_error_msg(block_id::String, error::String)
    Dict("type" => BLOCK_ERROR,
         "payload" => Dict("blockId" => block_id, "error" => error))
end

function block_diff_result_msg(block_id::String, todo_id::String, original_content::String, ai_generated_content::String)
    Dict("type" => BLOCK_DIFF_RESULT,
         "payload" => Dict("blockId" => block_id, 
                            "todoId" => todo_id,
                            "original_content" => original_content,
                            "ai_generated_content" => ai_generated_content))
end

function todo_dir_result_msg(todo_id::String, paths::Vector{String})
    Dict("type" => TODO_DIR_RESULT,
         "payload" => Dict("todoId" => todo_id, "paths" => paths))
end

# Server response format
function connected_msg(mode::String, user_id::String; agent_id::Union{String,Nothing}=nothing)
    payload = Dict("mode" => mode, "userId" => user_id)
    isnothing(agent_id) || (payload["agentId"] = agent_id)
    Dict("type" => CONNECTED_AGENT, "payload" => payload)
end
