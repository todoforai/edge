from .constants import Edge2Front as EF, Edge2Agent as EA


# Edge status message
def edge_status_msg(edge_id, status):
    return {
        "type": EF.EDGE_STATUS,
        "payload": {
            "edgeId": edge_id,
            "status": status
        }
    }


# Block message formatters
def block_message_result_msg(todo_id, block_id, content, message_id):
    return {
        "type": EF.BLOCK_SH_MSG_RESULT,  
        "payload": {
            "todoId": todo_id,
            "messageId": message_id,
            "blockId": block_id,
            "content": content
        }
    }


def block_start_result_msg(todo_id, block_id, mode, message_id):
    return {
        "type": EF.BLOCK_SH_MSG_START,  
        "payload": {
            "todoId": todo_id,
            "messageId": message_id,
            "blockId": block_id,
            "mode": mode
        }
    }


def block_done_result_msg(todo_id, message_id, block_id, mode, return_code):
    return {
        "type": EF.BLOCK_SH_DONE,  # Updated to match protocol
        "payload": {
            "todoId": todo_id,
            "messageId": message_id,
            "blockId": block_id,
            "mode": mode,
            "return_code": return_code
        }
    }


def block_save_result_msg(block_id, todo_id, result):
    return {
        "type": EF.BLOCK_SAVE_RESULT,
        "payload": {
            "blockId": block_id,
            "todoId": todo_id,
            "result": result
        }
    }


def block_error_result_msg(block_id, todo_id, error):
    return {
        "type": EF.BLOCK_ERROR_RESULT,
        "payload": {
            "blockId": block_id,
            "todoId": todo_id,
            "error": error
        }
    }


def block_meta_result_msg(block_id, **kwargs):
    payload = {"blockId": block_id}
    # Add optional fields if provided
    for key, value in kwargs.items():
        if value is not None:
            payload[key] = value

    return {
        "type": EF.BLOCK_META_RESULT,
        "payload": payload
    }


def block_diff_result_msg(todo_id, block_id, original_content, ai_generated_content):
    return {
        "type": EF.BLOCK_DIFF_RESULT,
        "payload": {
            "todoId": todo_id,
            "blockId": block_id,
            "original_content": original_content,
            "ai_generated_content": ai_generated_content
        }
    }


# Task action messages
def task_action_update_msg(task_id, edge_id, status, message=None):
    payload = {
        "taskId": task_id,
        "edgeId": edge_id,
        "status": status
    }
    if message:
        payload["message"] = message
    
    return {
        "type": EF.TASK_ACTION_UPDATE,
        "payload": payload
    }


# Directory and file messages
def dir_list_response_msg(todo_id, paths):
    return {
        "type": EF.EDGE_DIR_RESPONSE,
        "payload": {
            "todoId": todo_id,
            "paths": paths
        }
    }


def cd_response_msg(edge_id, path, request_id, success=True, error=None):
    payload = {
        "edgeId": edge_id,
        "path": path,
        "success": success,
        "requestId": request_id,
    }
    if error:
        payload["error"] = error
    
    return {
        "type": EF.EDGE_CD_RESPONSE,
        "payload": payload
    }


# Context request responses
def ctx_julia_result_msg(todo_id, message_id, filepaths=None, contents=None, error=None):
    payload = {
        "todoId": todo_id,
        "messageId": message_id
    }
    if filepaths:
        payload["filepaths"] = filepaths
    if contents:
        payload["contents"] = contents
    if error:
        payload["error"] = error
    
    return {
        "type": EA.CTX_JULIA_RESULT,
        "payload": payload
    }



# Updated workspace result message to match the new interface
def workspace_result_msg(request_id, user_id, agent_id, project_files, filtered_files, filtered_dirs):
    return {
        "type": EA.CTX_WORKSPACE_RESULT,
        "payload": {
            "requestId": request_id,
            "userId": user_id,
            "agentId": agent_id,
            "project_files": project_files,
            "filtered_files": filtered_files,
            "filtered_dirs": filtered_dirs
        }
    }

def file_chunk_result_msg(response_type, content=None, error=None, full_path=None, **payload):
    if content is not None:
        payload["content"] = content
    if error is not None:
        payload["error"] = error
    if full_path is not None:
        payload["full_path"] = full_path
    
    return {
        "type": response_type,
        "payload": payload
    }

def get_folders_response_msg(request_id, edge_id, folders, files, error=None):
    """Format a get folders response message"""
    return {
        "type": EF.EDGE_GET_FOLDERS_RESPONSE,
        "payload": {
            "requestId": request_id,
            "edgeId": edge_id,
            "folders": folders,
            "files": files,
            "error": error
        }
    }
def mcp_list_tools_request_msg(request_id: str, edge_id: str, agent_id: str):
    """Request to list MCP tools from edge"""
    return {
        "type": EA.MCP_LIST_TOOLS_REQUEST,
        "payload": {
            "requestId": request_id,
            "edgeId": edge_id,
            "agentId": agent_id
        }
    }

def mcp_list_tools_result_msg(request_id: str, tools: list, error: str = None):
    """Response with MCP tools list"""
    return {
        "type": EA.MCP_LIST_TOOLS_RESULT,
        "payload": {
            "requestId": request_id,
            "tools": tools,
            "error": error
        }
    }

def mcp_call_tool_request_msg(request_id: str, edge_id: str, agent_id: str, server_id: str, tool_name: str, arguments: dict):
    """Request to call MCP tool on edge"""
    return {
        "type": EA.MCP_CALL_TOOL_REQUEST,
        "payload": {
            "requestId": request_id,
            "edgeId": edge_id,
            "agentId": agent_id,
            "serverId": server_id,
            "toolName": tool_name,
            "arguments": arguments
        }
    }

def mcp_call_tool_result_msg(request_id: str, result: dict, error: str = None):
    """Response with MCP tool call result"""
    return {
        "type": EA.MCP_CALL_TOOL_RESULT,
        "payload": {
            "requestId": request_id,
            "result": result,
            "error": error
        }
    }