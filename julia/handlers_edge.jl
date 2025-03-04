# Handler functions for edge client
function handle_project_cd(payload::Dict, client::ClientEdge)
    project_id = payload["projectId"]
    path = payload["path"]
    
    settings = get_project_settings(client.datasource, project_id)
    workspace_paths = settings.workspacePaths
    isempty(workspace_paths) && throw(ErrorException("No workspace paths defined"))
    
    root_path = first(workspace_paths)
    target_path = joinpath(root_path, path)
    
    if !isdir(target_path)
        send_response(block_error_msg(project_id, "Invalid path: $target_path"), client)
        return
    end
    
    cd(target_path)
    send_response(project_dir_result_msg(project_id, [relpath(pwd(), root_path)]), client)
end

function handle_project_dir(payload::Dict, client::ClientEdge)
    project_id = payload["projectId"]
    try
        paths = readdir()
        send_response(project_dir_result_msg(project_id, paths), client)
    catch e
        send_response(block_error_msg(project_id, sprint(showerror, e)), client)
    end
end

function handle_todo_cd(payload::Dict, client::ClientEdge)
    todo_id = payload["todoId"]
    path = payload["path"]
    # Implementation needed
    send_response(todo_dir_result_msg(todo_id, [path]), client)
end

function handle_todo_dir(payload::Dict, client::ClientEdge)
    todo_id = payload["todoId"]
    # Implementation needed
    send_response(todo_dir_result_msg(todo_id, readdir()), client)
end

# Block handlers
function handle_block_refresh(payload::Dict, client::ClientEdge)
    block_id = payload["blockId"]
    send_response(block_message_msg(block_id, "REFRESHING"), client)
end

function handle_block_execute(payload::Dict, client::ClientEdge)
    block_id = payload["blockId"]
    data = get(payload, "data", Dict())
    send_response(block_start_msg(block_id, "execute"), client)
end

function handle_block_save(payload::Dict, client::ClientEdge)
    @show "CALLED"
    block_id = payload["blockId"]
    todo_id = payload["todoId"]
    filepath = payload["filepath"]
    content = payload["content"]
    @show pwd()
    try
        @show content
        @show filepath
        mkpath(dirname(filepath))
        @show "savedd"
        write(filepath, content) # effektív munka ugye...
        send_agent_response(block_save_result_msg(block_id, todo_id, "completed"), client)
        @show "response sent!"
    catch e

        err_msg = "Error: $(sprint(showerror, e))\n\nStacktrace:\n$(join(string.(stacktrace(catch_backtrace())), "\n"))"
        println(err_msg)
        @show "error sent"
        send_agent_response(block_save_result_msg(block_id, todo_id, "error"), client)
    end
end

function handle_block_keyboard(payload::Dict, client::ClientEdge)
    block_id = payload["blockId"]
    # TODO: Need clarification on:
    # - What keyboard events should be handled? 
    # - Is there a keyCode/key in payload?
    # - What's the expected response format?
end

function handle_block_signal(payload::Dict, client::ClientEdge)
    block_id = payload["blockId"]
    # TODO: Need clarification on:
    # - What signals are supported? (SIGINT, SIGTERM, etc?)
    # - Is there a signal type/name in payload?
    # - Should we forward OS signals to running processes?
    send_response(block_message_msg(block_id, "PROCESSING"), client)
end

function handle_block_diff(payload::Dict, client::ClientEdge)
    block_id = payload["blockId"]
    diff_data = payload["data"]
    # TODO: Need clarification on:
    # - What's the format of diff_data?
    # - Should we compute diffs or just display them?
    # - What diff algorithm/format should be used?
    send_response(block_diff_result_msg(block_id, diff_data), client)
end

function handle_block_control_start(payload::Dict, client::ClientEdge)
    block_id = payload["blockId"]
    send_response("message:blocks", Dict(
        "blockId" => block_id,
        "content" => "RUNNING"
    ), client)
end

function handle_block_control_stop(payload::Dict, client::ClientEdge)
    block_id = payload["blockId"]
    send_response("message:blocks", Dict(
        "blockId" => block_id,
        "content" => "STOPPED"
    ), client)
end
