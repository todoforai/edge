
function request(client::TOKENClient, method::String, endpoint::String, body::Union{Dict,Nothing}=nothing)
    url =  "$(client.base_url)$endpoint"
    headers = ["Content-Type" => "application/json"]
    !isempty(client.token) && push!(headers, "Authorization" => "Bearer $(client.token)")
    response = HTTP.request(method, url, headers, body !== nothing ? JSON.json(body) : "")
    return JSON.parse(String(response.body))
end
function request(client::APIClient, method::String, endpoint::String, body::Union{Dict,Nothing}=nothing)
    url = "$(client.base_url)$endpoint"
    headers = ["Content-Type" => "application/json"]

    if !isempty(client.api_key)
        push!(headers, "X-API-Key" => client.api_key)
    end
    
    response = HTTP.request(method, url, headers, body !== nothing ? JSON.json(body) : "")
    return JSON.parse(String(response.body))
end

post(client,   endpoint::String, body::Dict) = request(client, "POST", endpoint, body)
GET(client,    endpoint::String)             = request(client, "GET", endpoint)
put(client,    endpoint::String, body::Dict) = request(client, "PUT", endpoint, body)
patch(client,  endpoint::String, body::Dict) = request(client, "PATCH",  endpoint, body)
delete(client, endpoint::String)             = request(client, "DELETE", endpoint)

