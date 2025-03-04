
export ClientAgent, ClientEdge, start_client, create_agent_client, create_edge_client, main_agent_client, main_edge_client

include("fingerprint.jl")
include("protocol.jl")
include("client_arg_parser.jl")
include("client_types.jl")
include("client_websocket.jl")
include("handlers_edge.jl")
include("client_edge.jl")

# Helper to convert HTTP(S) URL to WS(S) URL is now defined in client_types.jl

function start_heartbeat(client::AbstractClient)
    client.heartbeat_task = @async_showerr begin
        while client.connected
            agent_heartbeat(client.datasource, client.agent_id)
            client.debug && @debug "Heartbeat sent" agent_id=client.agent_id
            sleep(30)  # Send heartbeat every 30 seconds
        end
    end
end

function stop_heartbeat(client::AbstractClient)
    if !isnothing(client.heartbeat_task) && !istaskdone(client.heartbeat_task)
        schedule(client.heartbeat_task, InterruptException(); error=true)
        client.heartbeat_task = nothing
    end
end

function connected(data::Dict, client::AbstractClient)
    client.agent_id = data["agentId"]
    println("Connected")
end

# Generic start_client that delegates to the appropriate specialized function
start_client(client::ClientAgent) = start_agent_client(client)
start_client(client::ClientEdge) = start_edge_client(client)


# For backward compatibility
function main_client()
    args = parse_client_commandline()
    client_type = get(args, "client-type", "agent")
    
    if client_type == "agent"
        main_agent_client()
    else
        main_edge_client()
    end
end
