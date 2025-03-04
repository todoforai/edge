
include("api_client.jl")
include("http_helpers.jl")
export ServerDataSource

struct ServerDataSource <: AbstractDataSource
    client::APIClient
    ctx::TODO4AICTX
end

# Constructor
function ServerDataSource(client::APIClient)
    ds = ServerDataSource(client, TODO4AICTX())
    
    ds
end

# Helper functions for ID mapping
function encode_project_id!(ctx::TODO4AICTX, long_id::String)
    startswith(long_id, "P") && (println("long_id is already shorted... wtf?: $long_id"); return long_id)
    haskey(ctx.id_mapper.reverse_project_map, long_id) && return ctx.id_mapper.reverse_project_map[long_id]
    short_id = "P$(ctx.id_mapper.next_project_id)"
    ctx.id_mapper.next_project_id += 1
    ctx.id_mapper.project_map[short_id] = long_id
    ctx.id_mapper.reverse_project_map[long_id] = short_id
    return short_id
end
function encode_todo_id!(ctx::TODO4AICTX, long_id::String)
    startswith(long_id, "T") && (println("long_id is already shorted... wtf?: $long_id"); return long_id)
    haskey(ctx.id_mapper.reverse_todo_map, long_id) && return ctx.id_mapper.reverse_todo_map[long_id]
    short_id = "T$(ctx.id_mapper.next_todo_id)"
    ctx.id_mapper.next_todo_id += 1
    ctx.id_mapper.todo_map[short_id] = long_id
    ctx.id_mapper.reverse_todo_map[long_id] = short_id
    return short_id
end
function encode_datasource_id!(ctx::TODO4AICTX, long_id::String)
    startswith(long_id, "D") && (println("long_id is already shorted... wtf?: $long_id"); return long_id)
    haskey(ctx.id_mapper.reverse_datasource_map, long_id) && return ctx.id_mapper.reverse_datasource_map[long_id]
    short_id = "D$(ctx.id_mapper.next_datasource_id)"
    ctx.id_mapper.next_datasource_id += 1
    ctx.id_mapper.datasource_map[short_id] = long_id
    ctx.id_mapper.reverse_datasource_map[long_id] = short_id
    return short_id
end

decode_project_id(ctx::TODO4AICTX, short_id::String) = ctx.id_mapper.project_map[short_id]
decode_todo_id(ctx::TODO4AICTX, short_id::String) = ctx.id_mapper.todo_map[short_id]
decode_datasource_id(ctx::TODO4AICTX, short_id::String) = ctx.id_mapper.datasource_map[short_id]

function refresh!(ctx::TODO4AICTX, datasource::AbstractDataSource)
    ctx.projects = list_projects(datasource)
    
    # Fetch and encode todos with short IDs
    ctx.todos = Dict{String, Vector{Todo}}()
    for project in ctx.projects
        todos = list_todos(datasource, project.id)
        ctx.todos[project.name] = todos
    end
    
    ctx.user_datasources = get_user_datasource(datasource)
    ctx.user_settings = get_user_settings(datasource)
    
    # Fetch project datasources and settings
    ctx.project_datasources = Dict{String, Vector{ProjectDataSource}}()
    ctx.project_settings = Dict{String, ProjectSettings}()
    for p in ctx.projects
        ctx.project_datasources[p.id] = get_project_datasource(datasource, p.id)
        ctx.project_settings[p.id] = get_project_settings(datasource, p.id)
    end
    ctx
end


# Interface implementations
get_current_session(ds::ServerDataSource)::Dict{String,Any} = get_current_session(ds.client)

# Agent operations
function agent_heartbeat(ds::ServerDataSource, agent_id::String)
    agent_heartbeat(ds.client, agent_id)
end

# Project operations
list_projects(ds::ServerDataSource)::Vector{Project} = [convert_to_project(ds, proj) for proj in list_projects(ds.client)]

function create_project(ds::ServerDataSource; name::String, isPublic::Bool=false, configurations::String="{}")::Project
    convert_to_project(ds, create_project(ds.client, name=name, isPublic=isPublic, configurations=configurations))
end

function update_project(ds::ServerDataSource, project_id::String; name::String, isPublic::Bool, configurations::String="{}")::Project
    real_project_id = decode_project_id(ds.ctx, project_id)
    convert_to_project(ds, update_project(ds.client, real_project_id, name=name, isPublic=isPublic, configurations=configurations))
end

function share_project(ds::ServerDataSource, project_id::String; email::String, can_write::Bool=false)::Dict{String,Any}
    real_project_id = decode_project_id(ds.ctx, project_id)
    share_project(ds.client, real_project_id, email=email, can_write=can_write)
end

# Todo operations
function list_todos(ds::ServerDataSource, project_id::String)::Vector{Todo}
    real_project_id = decode_project_id(ds.ctx, project_id)
    [convert_to_todo(ds, todo) for todo in list_todos(ds.client, real_project_id)]
end

function create_todo(ds::ServerDataSource, project_id::String; message::String="")::Todo
    real_project_id = decode_project_id(ds.ctx, project_id)
    convert_to_todo(ds, create_todo(ds.client, real_project_id, message=message))
end

function get_todo(ds::ServerDataSource, todo_id::String)::Todo
    real_todo_id = decode_todo_id(ds.ctx, todo_id)
    convert_to_todo(ds, get_todo(ds.client, real_todo_id))
end

function delete_todo(ds::ServerDataSource, todo_id::String)::Dict{String,Bool}
    real_todo_id = decode_todo_id(ds.ctx, todo_id)
    delete_todo(ds.client, real_todo_id)
end

function update_todo_status(ds::ServerDataSource, todo_id::String, status::String)::Todo
    real_todo_id = decode_todo_id(ds.ctx, todo_id)
    convert_to_todo(ds, update_todo_status(ds.client, real_todo_id, status))
end

function add_todo_message(ds::ServerDataSource, todo_id::String; content::String, role::String)::Message
    real_todo_id = decode_todo_id(ds.ctx, todo_id)
    convert_to_message(ds, add_todo_message(ds.client, real_todo_id, content=content, role=role))
end

function update_todo(ds::ServerDataSource, todo_id::String; status::Union{String,Nothing}=nothing)::Todo
    real_todo_id = decode_todo_id(ds.ctx, todo_id)
    convert_to_todo(ds, update_todo(ds.client, real_todo_id, status=status))
end

# Transaction operations
list_transactions(ds::ServerDataSource)::Vector{Dict{String,Any}} = list_transactions(ds.client)
get_balance(ds::ServerDataSource) :: Dict{String,Any} = get_balance(ds.client)

# Datasource operations
function get_user_datasource(ds::ServerDataSource)::Vector{UserDataSource}
    [convert_to_user_datasource(ds, ds_dict) for ds_dict in get_user_datasources(ds.client)]
end

function get_project_datasource(ds::ServerDataSource, project_id::String)::Vector{ProjectDataSource}
    real_project_id = decode_project_id(ds.ctx, project_id)
    [convert_to_project_datasource(ds, ds_dict) for ds_dict in get_project_datasources(ds.client, real_project_id)]
end

function set_user_datasource(ds::ServerDataSource, user_id::String, datasource::Dict)::UserDataSource
    convert_to_user_datasource(ds, create_user_datasource(ds.client; 
        name=get(datasource, "name", ""),
        data=get(datasource, "data", Dict()),))
end

function set_project_datasource(ds::ServerDataSource, project_id::String, datasource::Dict)::ProjectDataSource
    real_project_id = decode_project_id(ds.ctx, project_id)
    convert_to_project_datasource(ds, create_project_datasource(ds.client, real_project_id;
        name=get(datasource, "name", ""),
        data=get(datasource, "data", Dict()),))
end

# Project settings operations
function get_project_settings(ds::ServerDataSource, project_id::String)::ProjectSettings
    real_project_id = decode_project_id(ds.ctx, project_id)
    a=get_project_settings(ds.client, real_project_id)
    convert_to_project_settings(ds, a)
end

function update_project_settings(ds::ServerDataSource, project_id::String, settings::Dict)::ProjectSettings
    real_project_id = decode_project_id(ds.ctx, project_id)
    convert_to_project_settings(ds, update_project_settings(ds.client, real_project_id, settings))
end

# User settings operations
function get_user_settings(ds::ServerDataSource)::UserSettings
    settings_dict = get_user_settings(ds.client)
    convert_to_user_settings(ds, settings_dict)
end

function get_workflow_state(ds::ServerDataSource, todo_id::String)
    real_todo_id = decode_todo_id(ds.ctx, todo_id)
    get_workflow_state(ds.client, real_todo_id)
end

function update_workflow_state(ds::ServerDataSource, todo_id::String, workflow_state::Vector{UInt8})
    real_todo_id = decode_todo_id(ds.ctx, todo_id)
    update_workflow_state(ds.client, real_todo_id, workflow_state)
end

function update_user_settings(ds::ServerDataSource, settings::Dict)::UserSettings
    settings_dict = update_user_settings(ds.client, settings)
    convert_to_user_settings(ds, settings_dict)
end

function update_user_datasource(ds::ServerDataSource, datasource_id::String; name::Union{String,Nothing}=nothing, data::Union{Dict,Nothing}=nothing) :: UserDataSource
    real_datasource_id = decode_datasource_id(ds.ctx, datasource_id)
    convert_to_user_datasource(ds, update_user_datasource(ds.client, real_datasource_id; 
        name=name,
        data=data))
end

function update_project_datasource(ds::ServerDataSource, project_id::String, datasource_id::String; name::Union{String,Nothing}=nothing, data::Union{Dict,Nothing}=nothing) :: ProjectDataSource
    real_project_id = decode_project_id(ds.ctx, project_id)
    real_datasource_id = decode_datasource_id(ds.ctx, datasource_id)
    convert_to_project_datasource(ds, update_project_datasource(ds.client, real_project_id, real_datasource_id;
        name=name,
        data=data))
end

function get_pending_tasks(ds::ServerDataSource)::Vector{AITask}
    tasks_dict = get_pending_tasks(ds.client)
    [convert_to_task(ds, task) for task in tasks_dict]
end


function convert_to_task(ds::ServerDataSource, task_dict::Dict)::AITask
    content_dict = task_dict["content"]
    encoded_todo_id = encode_todo_id!(ds.ctx, content_dict["todoId"])
    
    TaskContent(
        content = content_dict["content"],
        todoId = encoded_todo_id
    ) |> content -> AITask(
        id = task_dict["id"],
        content = content,
        type = task_dict["type"],
        createdAt = get(task_dict, "createdAt", nothing)
    )
end

function convert_from_task(ds::ServerDataSource, task::AITask)::Dict{String,Any}
    real_todo_id = decode_todo_id(ds.ctx, task.content.todoId)
    Dict{String,Any}(
        "content" => Dict{String,Any}(
            "content" => task.content.content,
            "todoId" => real_todo_id
        ),
        "id" => task.id,
        "type" => task.type,
        "createdAt" => task.createdAt
    )
end

function convert_to_todo(ds::ServerDataSource, todo_dict::Dict)::Todo
    encoded_todoid = encode_todo_id!(ds.ctx, todo_dict["id"])
    # Convert messages from Dict to Message objects
    messages = if haskey(todo_dict, "messages") && todo_dict["messages"] !== nothing
        [Message(
                id=get(msg, "id", ""),
                originalContent=get(msg, "originalContent", ""),
                role=get(msg, "role", ""),
                todoId=encoded_todoid,
                blockTypes=get(msg, "blockTypes", String[]),
                blocks=get(msg, "blocks", "[]"),
                ctx=get(msg, "ctx", nothing),
                createdAt=get(msg, "createdAt", nothing)
            ) for msg in todo_dict["messages"]
        ]
    else
        Message[]
    end

    # Filter only the fields that exist in Todo struct
    allowed_fields = fieldnames(Todo)
    # "project" in keys(todo_dict) && @warn todo_dict
    filtered_dict = Dict{Symbol,Any}(Symbol(k) => v for (k,v) in todo_dict 
                                   if Symbol(k) in allowed_fields && k != "messages")
    
    todo = Todo(;filtered_dict..., messages=messages)
    todo.id = encoded_todoid
    todo.projectId = encode_project_id!(ds.ctx, todo.projectId)
    todo
end

function convert_to_message(ds::ServerDataSource, msg_dict::Dict)::Message
    Message(id=get(msg_dict, "id", ""),
            originalContent=get(msg_dict, "content", ""),
            role=get(msg_dict, "role", ""),
            todoId=encode_todo_id!(ds.ctx, get(msg_dict, "todoId", "")),
            blockTypes=get(msg_dict, "blockTypes", String[]),
            blocks=get(msg_dict, "blocks", "[]"),
            ctx=get(msg_dict, "ctx", nothing),
            createdAt=get(msg_dict, "createdAt", nothing)
    )
end

function convert_to_project(ds::ServerDataSource, proj_dict::Dict)::Project
    proj = Project(;Dict{Symbol,Any}(Symbol(k) => v === nothing ? nothing : 
                    (k == "configurations" && v isa String) ? JSON.parse(v) : v 
                    for (k,v) in proj_dict)...)
    proj.id = encode_project_id!(ds.ctx, proj.id)
    proj
end

function convert_to_user_datasource(ds::ServerDataSource, ds_dict::Dict)::UserDataSource
    ds_dict = Dict{String,Any}(k => v for (k,v) in ds_dict)
    ds_dict["id"] = encode_datasource_id!(ds.ctx, ds_dict["id"])
    UserDataSource(;Dict{Symbol,Any}(Symbol(k) => v for (k,v) in ds_dict)...)
end

function convert_to_project_datasource(ds::ServerDataSource, ds_dict::Dict)::ProjectDataSource
    ds_dict = Dict{String,Any}(k => v for (k,v) in ds_dict)
    ds_dict["id"] = encode_datasource_id!(ds.ctx, ds_dict["id"])
    ds_dict["projectId"] = encode_project_id!(ds.ctx, ds_dict["projectId"])
    ProjectDataSource(;Dict{Symbol,Any}(Symbol(k) => v for (k,v) in ds_dict)...)
end

function convert_to_user_settings(ds::ServerDataSource, settings_dict::Dict)::UserSettings
    # Parse workspacePaths if it's a string
    settings_dict = copy(settings_dict)
    settings_dict["workspacePaths"] = settings_dict["workspacePaths"] isa String ? 
        JSON.parse(settings_dict["workspacePaths"]) : settings_dict["workspacePaths"]
    
    # Filter to only include fields that exist in UserSettings struct
    allowed_fields = fieldnames(UserSettings)
    filtered_dict = Dict{Symbol,Any}(Symbol(k) => v for (k,v) in settings_dict 
                                   if Symbol(k) in allowed_fields)
    
    UserSettings(;filtered_dict...)
end

function convert_to_project_settings(ds::ServerDataSource, settings_dict::Dict)::ProjectSettings
    # Parse workspacePaths if it's a string
    settings_dict = copy(settings_dict)
    settings_dict["workspacePaths"] = settings_dict["workspacePaths"] isa String ? 
        JSON.parse(settings_dict["workspacePaths"]) : settings_dict["workspacePaths"]
    
    # Filter to only include fields that exist in ProjectSettings struct
    allowed_fields = fieldnames(ProjectSettings)
    filtered_dict = Dict{Symbol,Any}(Symbol(k) => v for (k,v) in settings_dict 
                                   if Symbol(k) in allowed_fields)
    
    # Parse specific string fields
    for k in [:llmConfig, :tools, :preferences]
        if haskey(filtered_dict, k) && filtered_dict[k] isa String
            filtered_dict[k] = JSON.parse(filtered_dict[k])
        end
    end
    
    settings = ProjectSettings(;filtered_dict...)
    settings.projectId = encode_project_id!(ds.ctx, settings.projectId)
    settings
end

