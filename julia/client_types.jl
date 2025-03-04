# Base client type for shared functionality
abstract type AbstractClient end

# Client for handling agent tasks (AI processing)
mutable struct ClientAgent <: AbstractClient
    ws::Union{WebSocket,Nothing}
    datasource::ServerDataSource
    agent_id::String
    url::String
    ws_url::String
    debug::Bool
    connected::Bool
    heartbeat_task::Union{Task,Nothing}
    pending_tasks::Union{Nothing, Vector{Any}}
    running_tasks::Dict{String,Task} # Tasks registry
end

# Client for handling edge operations (file system, blocks, etc.)
mutable struct ClientEdge <: AbstractClient
    ws::Union{WebSocket,Nothing}
    datasource::ServerDataSource
    agent_id::String
    url::String
    ws_url::String
    debug::Bool
    connected::Bool
    heartbeat_task::Union{Task,Nothing}
end

# Helper to convert HTTP(S) URL to WS(S) URL
function api_to_ws_url(api_url::String, type="agent")
    uri = URI(api_url)
    ws_scheme = startswith(uri.scheme, "https") ? "wss" : "ws"
    return string(URI(scheme=ws_scheme, host=uri.host, port=uri.port, path="/ws/v1/$type"))
end

# Factory functions for creating clients
function create_agent_client(url::String=get(ENV, "TODO4AI_API_URL", "http://localhost:4000"); 
                            debug::Bool=false, 
                            datasource::ServerDataSource)
    ws_url = api_to_ws_url(url, "agent")
    
    return ClientAgent(
        nothing,  # ws
        datasource,       
        "",       # agent_id
        url,      # url
        ws_url,   # ws_url
        debug,    # debug
        false,    # connected
        nothing,  # heartbeat_task
        nothing,  # pending_tasks
        Dict{String,Task}() # running_tasks
    )
end

function create_edge_client(url::String=get(ENV, "TODO4AI_API_URL", "http://localhost:4000"); 
                           debug::Bool=false, 
                           datasource::ServerDataSource)
    ws_url = api_to_ws_url(url, "agent")
    
    return ClientEdge(
        nothing,  # ws
        datasource,       
        "",       # agent_id
        url,      # url
        ws_url,   # ws_url
        debug,    # debug
        false,    # connected
        nothing   # heartbeat_task
    )
end

send_response(channel::String, payload::Dict, client::ClientAgent) = write(client.ws, JSON.json(Dict("type" => channel, "payload" => payload)))
send_response(msg::Dict, client::ClientAgent) =                      write(client.ws, JSON.json(msg))

# For ClientEdge
send_response(channel::String, payload::Dict, client::ClientEdge) = write(client.ws, JSON.json(Dict("type" => channel, "payload" => payload)))
send_response(msg::Dict, client::ClientEdge) =                      write(client.ws, JSON.json(msg))

