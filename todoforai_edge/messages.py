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
def block_message_result_msg(todo_id, block_id, content):
    return {
        "type": EF.BLOCK_MESSAGE_RESULT,
        "payload": {
            "todoId": todo_id,
            "blockId": block_id,
            "content": content
        }
    }

def block_start_result_msg(todo_id, block_id, mode):
    return {
        "type": EF.BLOCK_START_RESULT,
        "payload": {
            "todoId": todo_id,
            "blockId": block_id,
            "mode": mode
        }
    }

def block_done_result_msg(todo_id, message_id, block_id, mode):
    return {
        "type": EF.BLOCK_DONE_RESULT,
        "payload": {
            "todoId": todo_id,
            "messageId": message_id,
            "blockId": block_id,
            "mode": mode
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


def cd_response_msg(edge_id, path, request_id, success=True):
    return {
        "type": EF.EDGE_CD_RESPONSE,
        "payload": {
            "edgeId": edge_id,
            "path": path,
            "success": success,
            "request_id": request_id,
        }
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

def ctx_workspace_result_msg(todo_id, message_id, content=None, error=None):
    payload = {
        "todoId": todo_id,
        "messageId": message_id
    }
    if content:
        payload["content"] = content
    if error:
        payload["error"] = error
    
    return {
        "type": EA.CTX_WORKSPACE_RESULT,
        "payload": payload
    }

def diff_file_result_msg(todo_id, message_id, original_content=None, modified_content=None, error=None):
    payload = {
        "todoId": todo_id,
        "messageId": message_id
    }
    if original_content:
        payload["original_content"] = original_content
    if modified_content:
        payload["modified_content"] = modified_content
    if error:
        payload["error"] = error
    
    return {
        "type": EA.DIFF_FILE_RESULT,
        "payload": payload
    }
