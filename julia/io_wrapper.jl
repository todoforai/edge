@kwdef struct TodoIOWrapper <: IO
    io::IO
    todo_id::String
    message_id::String
end

# Base.write(w::TodoIOWrapper, data::String) = (@show data; write(w.io, JSON.json(Dict("type" => BLOCK_MESSAGE, "payload" => Dict("todoId" => w.todo_id, "messageId" => w.message_id, "content" => data)))))
Base.write(w::TodoIOWrapper, data::Dict; type::String) = begin
    @info "Writing data of type $type  $data" 
    display(stacktrace())
    Base.write(w, Dict{String,String}(k => string(v) for (k,v) in data), "type" => type)
end

Base.write(w::TodoIOWrapper, data::Dict{String,String}; type::String) = begin
    println()
    println(type, "   - ", data)
    data["todoId"] = w.todo_id
    data["messageId"] = w.message_id
    Base.write(w.io, JSON.json(Dict("type" => type, "payload" => data)))
    return ""
end
Base.write(w::TodoIOWrapper, data::JuliaCTXResult) = write(w.io, JSON.json(Dict("type" => TODO_JULIA_CTX, "payload" => Dict("todoId" => w.todo_id, "messageId" => w.message_id, "content" => data.content))))
Base.write(w::TodoIOWrapper, data::WorkspaceCTXResult) = write(w.io, JSON.json(Dict("type" => TODO_WORKSPACE_CTX, "payload" => Dict("todoId" => w.todo_id, "messageId" => w.message_id, "content" => data.content))))

# Other required IO interface methods
Base.close(w::TodoIOWrapper) = nothing
Base.isopen(w::TodoIOWrapper) = isopen(w.io)
Base.eof(w::TodoIOWrapper) = eof(w.io)
Base.isreadable(w::TodoIOWrapper) = false
Base.iswritable(w::TodoIOWrapper) = true
Base.bytesavailable(w::TodoIOWrapper) = 0
Base.read(w::TodoIOWrapper) = error("Read not supported")

EasyContext.pickStreamCallbackforIO(io::TodoIOWrapper) = SocketStreamCallbackConfig

@kwdef struct SocketStreamCallbackConfig
    io::IO=stdout
    on_error::Function = noop
    on_done::Function = noop
    on_start::Function = noop
    on_content::Function = noop
    highlight_enabled::Bool = false
    process_enabled::Bool = false
    mode::String = "normal"
end

EasyContext.create(config::SocketStreamCallbackConfig) = begin
    StreamCallbackWithHooks(
        content_formatter = text_chunk              -> (print(text_chunk); config.on_content(text_chunk)),
        on_meta_usr       = (tokens, cost, elapsed) -> (write(config.io, Dict(k => string(v) for (k,v) in dict_user_meta(tokens, cost, elapsed)), type=TODO_MSG_META_USR)),
        on_meta_ai        = (tokens, cost, elapsed) -> (write(config.io, Dict(k => string(v) for (k,v) in dict_ai_meta(tokens, cost, elapsed)), type=TODO_MSG_META_AI)), 
        on_start          = ()                      -> (write(config.io, Dict("mode" => config.mode), type=TODO_MSG_START); config.on_start()),
        on_done           = ()                      -> (config.on_done(); write(config.io, Dict("mode" => config.mode), type=TODO_MSG_DONE)),
        on_error          = e                       -> (e isa InterruptException ? println("Graceful exit!") : (
            (error_msg = "Error: $(sprint(showerror, e))\n\nStacktrace:\n$(join(string.(stacktrace(catch_backtrace())), "\n"))");
            @error(error_msg);
            write(config.io, Dict("error" => error_msg), type=TODO_MSG_ERROR); config.on_error(e))),
        on_stop_sequence  = stop_sequence           -> (println("stop_sequence: $stop_sequence"); write(config.io, Dict("stop_sequence" => stop_sequence), type=TODO_MSG_STOP_SEQUENCE)),
    )
end

