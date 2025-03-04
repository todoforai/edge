using ArgParse
using EasyContext: set_editor

# Client specific command line parsing
function parse_client_commandline()
    s = ArgParseSettings()

    @add_arg_table! s begin
        "--api-key", "-k"
            help = "API key for authentication"
            arg_type = String
            required = true
        "--agent-id", "-a"
            help = "Agent ID for channel subscription"
            arg_type = String
            required = true
        "--url"
            help = "API URL (WS URL will be derived from this)"
            arg_type = String
            default = "http://localhost:4000"
        "--editor", "-e"
            help = "Select editor for code modifications (meld, vimdiff, meld_pro[:port], monacomeld[:port])"
            arg_type = String
            default = "meld_pro"
        "--debug", "-d"
            help = "Enable debug logging"
            action = :store_true
        "--client-type", "-t"
            help = "Client type (agent or edge)"
            arg_type = String
            default = "agent"
    end

    args = parse_args(s)
    set_editor(args["editor"])
    return args
end
