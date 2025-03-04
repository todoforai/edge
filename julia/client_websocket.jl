# Common WebSocket connection and reconnection logic for all client types

export connect_websocket, start_client_connection

"""
    connect_websocket(client::AbstractClient)

Establish a WebSocket connection for the given client, set up message handling,
and maintain the connection until it's closed.
"""
function connect_websocket(client::AbstractClient)
    # Generate fingerprint for client identification
    fingerprint = generate_fingerprint()
    
    # Prepare WebSocket URL with API key and fingerprint
    ws_url = "$(client.ws_url)?apiKey=$(client.datasource.client.api_key)&fingerprint=$(fingerprint)"
    client.debug && @info "Connecting to WebSocket" url=ws_url fingerprint

    try
        WebSockets.open(ws_url) do ws
            client.ws = ws
            client.connected = true
            client.debug && @info "WebSocket connected" agent_id=client.agent_id


            # Set up async message receiver
            message_task = @async_showerr while !eof(ws)
                data, success = readguarded(ws)
                if success && data isa Vector{UInt8}
                    msg_str = String(data)
                    client.debug && @info "Received message" msg_str
                    
                    msg = JSON.parse(msg_str)
                    
                    handle_message(msg, client)
                else
                    @show success
                    @warn "Failed to read message $(typeof(data))"
                    @show data
                    if data isa Vector{UInt8}
                        @show String(data)
                    end
                    break  # Exit the loop on read failure
                end
            end
            # Start heartbeat
            sleep(0.4) # wait for the agent_id to be set in the connected message
            start_heartbeat(client)

            # Keep the connection alive until disconnected or task fails
            while client.connected && !istaskdone(message_task)
                sleep(1)
            end
            
            # If the message task failed but we're still marked as connected,
            # it means we lost connection unexpectedly
            if istaskdone(message_task) && client.connected
                client.debug && @info "WebSocket connection lost unexpectedly"
                client.connected = false
            end
        end
    catch e
        @error "WebSocket connection error" exception=(e, catch_backtrace())
        return false
    finally
        stop_heartbeat(client)
        client.ws = nothing
        client.connected = false
    end
    
    return true
end

"""
    start_client_connection(client::AbstractClient, client_type::String)

Start a client connection with automatic reconnection logic.
"""
function start_client_connection(client::AbstractClient, client_type::String)
    try
        max_attempts = 20  # Maximum number of reconnection attempts
        attempt = 0
        
        while attempt < max_attempts
            @info "Connecting to server (attempt $(attempt+1)/$(max_attempts))"
            success = connect_websocket(client)
            
            if success
                # Reset attempt counter after successful connection
                attempt = 0
                
                # If connection was lost unexpectedly, wait 4 seconds before reconnecting
                if !client.connected
                    @info "Connection lost. Reconnecting in 4 seconds..."
                    sleep(4.0)
                else
                    break  # Exit if client was explicitly disconnected
                end
            else
                attempt += 1
                if attempt < max_attempts
                    delay = min(4 + attempt, 20.0)
                    @info "Connection failed. Reconnecting in $(round(delay, digits=1)) seconds..."
                    sleep(delay)
                end
            end
        end
        
        if attempt >= max_attempts
            @error "Maximum reconnection attempts reached. Giving up."
        end
    catch e
        @error "$client_type client error" exception=(e, catch_backtrace())
        rethrow(e)
    finally
        client.debug && @info "$client_type client shutdown complete"
    end
end
