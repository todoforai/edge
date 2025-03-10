export ClientEdge, create_edge_client, main_edge_client

function handle_message(data::Dict, client::ClientEdge)
    client.debug && @info "Processing message" data
    msg_type = data["type"]
    payload = data["payload"]
    
    client.debug && @info "Received message" type=msg_type payload=payload
    @show "WEFWEFWEFWEFWE"

    # Add explicit debug for CONNECTED_AGENT messages
    if msg_type == CONNECTED_AGENT
        client.debug && @info "Received CONNECTED_AGENT message" payload
        @show "WEFWEFWEFWEFWE"
        @show payload
        connected(payload, client)
        return
    end

    channel_handlers = Dict(
        CONNECTED_AGENT => (p) -> connected(p, client),
        EDGE_CD => (p) -> handle_todo_cd(p, client),
        EDGE_DIR_LIST => (p) -> handle_todo_dir(p, client),
        BLOCK_REFRESH => (p) -> handle_block_refresh(p, client),
        BLOCK_EXECUTE => (p) -> handle_block_execute(p, client),
        BLOCK_SAVE => (p) -> handle_block_save(p, client),
        BLOCK_KEYBOARD => (p) -> handle_block_keyboard(p, client),
        BLOCK_SIGNAL => (p) -> handle_block_signal(p, client),
        BLOCK_DIFF => (p) -> handle_block_diff(p, client)
    )

    if haskey(channel_handlers, msg_type)
        client.debug && @info "Found handler for message type: $msg_type"
        return channel_handlers[msg_type](payload)
    elseif msg_type == TASK_NEW
        client.debug && @info "Ignoring task message on edge client"
    else
        @warn "Unknown message type" type=msg_type
    end
end

function start_edge_client(client::ClientEdge)
    start_client_connection(client, "Edge")
end

function main_edge_client()
    args = parse_client_commandline()
    
    # Create API client
    api_client = APIClient(args["url"], args["apikey"])
    datasource = ServerDataSource(api_client)
    
    # Create edge client
    client = create_edge_client(
        args["url"],       # Using the URL from args
        debug=args["debug"], # Debug flag from args
        datasource=datasource
    )
    
    @info "Starting edge client" url=client.url ws_url=client.ws_url debug=client.debug
    start_edge_client(client)
end
