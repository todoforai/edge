

import HTTP

using JSON
using JSON3
using Dates
using UUIDs
using URIs

using ArgParse
using EasyContext: JuliaCTXResult
using EasyContext: WorkspaceCTXResult

using StreamCallbacksExt: dict_user_meta, dict_ai_meta
using StreamCallbacksExt: TokenCounts
using Base64
using DataStructures
using WebSockets

using BoilerplateCvikli: @async_showerr, @typeof

include("datasource/interface.jl")
include("datasource/types.jl")
include("datasource/server_datasource.jl")
include("client.jl")

TEST_EMAIL = "lfg@todo.ai"
TEST_PASSWORD = "Test123"
println("TEST_EMAIL: $TEST_EMAIL")


apikey = authenticate_and_get_api_key(TEST_EMAIL, TEST_PASSWORD)
# Create initial client to get API key
client = create_edge_client(
    debug=true,
    datasource=ServerDataSource(APIClient(api_key=apikey))
)
# Simply call the main edge client function
start_client(client)
