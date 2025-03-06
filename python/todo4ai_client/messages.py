"""
Message formatters for Todo4AI client responses.
These functions create properly structured message payloads for various response types.
"""

# Response message formatters
def project_dir_result_msg(request_id, path, items):
    return {
        "requestId": request_id,
        "path": path,
        "items": items,
        "success": True
    }

def block_error_msg(request_id, error_message):
    return {
        "requestId": request_id,
        "error": error_message,
        "success": False
    }

def block_start_msg(block_id, action):
    return {
        "blockId": block_id,
        "status": "started",
        "action": action
    }

def block_message_msg(block_id, content):
    return {
        "blockId": block_id,
        "content": content
    }

def block_save_result_msg(block_id, todo_id, status):
    return {
        "blockId": block_id,
        "todoId": todo_id,
        "status": status
    }

def block_diff_result_msg(block_id, diff_data):
    return {
        "blockId": block_id,
        "diffData": diff_data
    }

def task_action_result_msg(task_id, status, message=None):
    result = {
        "taskId": task_id,
        "status": status
    }
    if message:
        result["message"] = message
    return result

def ctx_result_msg(request_id, result, error=None):
    return {
        "requestId": request_id,
        "result": result,
        "error": error,
        "success": error is None
    }

# New message formatters following the protocol structure
def edge_status_msg(edge_id, status):
    return {
        "edgeId": edge_id,
        "status": status
    }

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

def block_save_result_msg_v2(block_id, todo_id, result):
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

def block_diff_result_msg_v2(todo_id, block_id, original_content, ai_generated_content):
    return {
        "todoId": todo_id,
        "blockId": block_id,
        "original_content": original_content,
        "ai_generated_content": ai_generated_content
    }

def project_dir_result_msg_v2(project_id, paths):
    return {
        "projectId": project_id,
        "paths": paths
    }

def task_action_update_msg(task_id, edge_id, status):
    return {
        "taskId": task_id,
        "edgeId": edge_id,
        "status": status
    }
