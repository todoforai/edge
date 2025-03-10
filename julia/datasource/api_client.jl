
export APIClient, TOKENClient

mutable struct TOKENClient
    base_url::String
    token::String
    user::Union{Dict{String,Any},Nothing}
end

# API Client struct
mutable struct APIClient
    base_url::String
    api_key::String
    user::Union{Dict{String,Any},Nothing}
end

# Constructor that handles authentication
function APIClient(base_url=get(ENV, "TODO4AI_API_URL", "http://localhost:4000/api/v1"); api_key=get(ENV, "TODO4AI_API_KEY", ""))
    client = APIClient(base_url, api_key, nothing)

    return client
end 

# Auth endpoints
function register_user(client::TOKENClient; email::String, password::String, fullName::String="")
    result = post(client, "/auth/register", Dict(
        "email" => email,
        "password" => password,
        "fullName" => fullName
    ))
    @show result
    client.token = result["token"]
    client.user = result["user"]  # Store user data
    result
end

function login(client::TOKENClient; email::String, password::String)
    result = post(client, "/auth/login", Dict(
        "email" => email, 
        "password" => password
    ))
    client.token = result["token"]
    client.user = result["user"]  # Store user data
    result
end

function authenticate(client::TOKENClient; email::String, password::String, fullName::String="")
    res = try
        register_user(client, email=email, password=password, fullName=fullName)
    catch e
        isa(e, HTTP.StatusError) && e.status == 409 || rethrow(e)
        login(client, email=email, password=password)
    end
    res
end

# Session endpoint
get_current_session(client::APIClient) = GET(client, "/sessions/current")

# Add new initialization endpoint
user_profile(client::APIClient)::Dict{String,Any} = GET(client, "/users/profile")

# Project endpoints
create_project(client::APIClient; name::String, isPublic::Bool=false) = post(client, "/projects", Dict("name" => name, "isPublic" => isPublic))
get_project(client::APIClient, project_id::String)   = GET(client, "/projects/$project_id")
list_projects(client::APIClient)                     = GET(client, "/projects")
update_project(client::APIClient, id::String; name::String, isPublic::Bool) = put(client, "/projects/$id", Dict("name" => name, "isPublic" => isPublic))

share_project(client::APIClient, project_id::String; email::String, can_write::Bool=false) = post(client, "/projects/$project_id/share", Dict("email" => email, "canWrite" => can_write))

# Todo endpoints
create_todo(client::APIClient, projectId::String; message::String="") = post(client, "/projects/$projectId/todos", Dict("message" => message))
list_todos(client::APIClient, projectId::String)     = GET(client, "/projects/$projectId/todos")
get_todo(client::APIClient, todo_id::String)         = GET(client, "/todos/$todo_id")
update_todo(client::APIClient, todo_id::String; status::Union{String,Nothing}=nothing) = put(client, "/todos/$todo_id", Dict(k => v for (k,v) in [("status",status)] if v !== nothing))
update_todo_status(client::APIClient, todoId::String, status::String) = patch(client, "/todos/$todoId/status", Dict("status" => status))
delete_todo(client::APIClient, todo_id::String)      = delete(client, "/todos/$todo_id")

add_todo_message(client::APIClient, todoId::String; content::String, role::String) = post(client, "/todos/$todoId/messages", Dict("content" => content, "role" => role))
get_workflow_state(client::APIClient, todo_id::String) = begin
    result = GET(client, "/todos/$todo_id/workflow")
    Dict{String,Any}(
        "workflowMeta" => get(result, "workflowMeta", nothing),
        "workflowVersion" => get(result, "workflowVersion", nothing)
    )
end

function update_workflow_state(client::APIClient, todo_id::String, workflow_state::Vector{UInt8})
    # Convert binary workflow state to base64 for transmission
    encoded_state = base64encode(workflow_state)
    put(client, "/todos/$todo_id/workflow", Dict(
        "workflowMeta" => encoded_state,
        "workflowVersion" => "1.0"  # Add versioning for future compatibility
    ))
end

# Datasource endpoints
create_user_datasource(client::APIClient; name::String, data::Dict) = post(client, "/datasources", Dict("name" => name, "data" => data))
get_user_datasources(client::APIClient)              = GET(client, "/datasources")
update_user_datasource(client::APIClient, datasource_id::String; name::Union{String,Nothing}=nothing, data::Union{Dict,Nothing}=nothing) = put(client, "/datasources/$(datasource_id)", Dict(k => v for (k,v) in [("name",name), ("data",data)] if v !== nothing))

# Project datasource endpoints
create_project_datasource(client::APIClient, project_id::String; name::String, data::Dict) = post(client, "/datasources/projects/$project_id", Dict("name" => name, "data" => data))
get_project_datasources(client::APIClient, project_id::String) = GET(client, "/datasources/projects/$project_id")
update_project_datasource(client::APIClient, project_id::String, datasource_id::String; name::Union{String,Nothing}=nothing, data::Union{Dict,Nothing}=nothing) = put(client, "/datasources/projects/$project_id/$datasource_id", Dict(k => v for (k,v) in [("name",name), ("data",data)] if v !== nothing))

# Settings endpoints
get_project_settings(client::APIClient, project_id::String) = GET(client, "/settings/projects/$project_id")
update_project_settings(client::APIClient, project_id::String, settings::Dict) = put(client, "/settings/projects/$project_id", settings)

get_user_settings(client::APIClient)                    = GET(client, "/settings/user")
update_user_settings(client::APIClient, settings::Dict) = put(client, "/settings/user", settings)

# API Key endpoints
create_api_key(client::TOKENClient; name::String) = post(client, "/users/apikeys", Dict("name" => name))
get_api_key(client::TOKENClient, name::String)    = GET(client, "/users/apikeys/$name")
list_api_keys(client::TOKENClient)                = GET(client, "/users/apikeys")
create_or_get_api_key(client::TOKENClient; name::String) = begin
    res = try
        get_api_key(client, name)
    catch e
        isa(e, HTTP.StatusError) && e.status == 404 || rethrow(e)
        create_api_key(client; name)
    end
    res["key"]
end

# New API key validation endpoint
function validate_api_key(client::APIClient, api_key::String)::Bool
    try
        client.api_key = api_key
        result = GET(client, "/apikeys/validate")
        return get(result, "valid", false)
    catch e
        return false
    end
end

# Agent endpoints
agent_heartbeat(client::APIClient, agent_id::String) = post(client, "/agents/$agent_id/heartbeat", Dict())

get_pending_tasks(client::APIClient) = GET(client, "/tasks/pending")

# Transaction endpoints
get_balance(client::APIClient)         = GET(client, "/users/balance")
list_transactions(client::APIClient)   = GET(client, "/users/transactions")

# AITask endpoints

# Add a convenience function to authenticate and get API key in one step
function authenticate_and_get_api_key(email::String, password::String; fullName::String="", api_key_name::String="default-agent")
    # Create a temporary client
    client = TOKENClient("http://localhost:4000/token/v1", "", nothing)
    
    # Authenticate the user
    authenticate(client; email=email, password=password, fullName=fullName)
    
    # Get or create an API key
    result = create_or_get_api_key(client; name=api_key_name)
    
    # Return the API key
    return result
end
