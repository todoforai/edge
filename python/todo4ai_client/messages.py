"""
Message formatters for Todo4AI client responses.
These functions create properly structured message payloads for various response types.
"""

# Edge status message
def edge_status_msg(edge_id, status):
    return {
        "edgeId": edge_id,
        "status": status
    }

# Block message formatters
def block_message_result_msg(todo_id, block_id, content):
    return {
        "todoId": todo_id,
        "blockId": block_id,
        "content": content
    }

def block_start_result_msg(todo_id, block_id, mode):
    return {
        "todoId": todo_id,
        "blockId": block_id,
        "mode": mode
    }

def block_done_result_msg(todo_id, message_id, block_id, mode):
    return {
        "todoId": todo_id,
        "messageId": message_id,
        "blockId": block_id,
        "mode": mode
    }

def block_save_result_msg(block_id, todo_id, result):
    return {
        "blockId": block_id,
        "todoId": todo_id,
        "result": result
    }

def block_error_result_msg(block_id, todo_id, error):
    return {
        "blockId": block_id,
        "todoId": todo_id,
        "error": error
    }

def block_meta_result_msg(block_id, **kwargs):
    result = {"blockId": block_id}
    # Add optional fields if provided
    for key, value in kwargs.items():
        if value is not None:
            result[key] = value
    return result

def block_diff_result_msg(todo_id, block_id, original_content, ai_generated_content):
    return {
        "todoId": todo_id,
        "blockId": block_id,
        "original_content": original_content,
        "ai_generated_content": ai_generated_content
    }

# Task action messages
def task_action_update_msg(task_id, edge_id, status, message=None):
    result = {
        "taskId": task_id,
        "edgeId": edge_id,
        "status": status
    }
    if message:
        result["message"] = message
    return result

# Directory and file messages
def dir_list_response_msg(todo_id, paths):
    return {
        "todoId": todo_id,
        "paths": paths
    }

def cd_response_msg(todo_id, path, success=True, error=None):
    result = {
        "todoId": todo_id,
        "path": path,
        "success": success
    }
    if error:
        result["error"] = error
    return result

# Context request responses
def ctx_julia_result_msg(todo_id, message_id, filepaths=None, contents=None, error=None):
    result = {
        "todoId": todo_id,
        "messageId": message_id
    }
    if filepaths:
        result["filepaths"] = filepaths
    if contents:
        result["contents"] = contents
    if error:
        result["error"] = error
    return result

def ctx_workspace_result_msg(todo_id, message_id, content=None, error=None):
    result = {
        "todoId": todo_id,
        "messageId": message_id
    }
    if content:
        result["content"] = content
    if error:
        result["error"] = error
    return result

def diff_file_result_msg(todo_id, message_id, original_content=None, modified_content=None, error=None):
    result = {
        "todoId": todo_id,
        "messageId": message_id
    }
    if original_content:
        result["original_content"] = original_content
    if modified_content:
        result["modified_content"] = modified_content
    if error:
        result["error"] = error
    return result
