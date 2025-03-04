# using HTTP

# function get_ip_addresses()
#     ips = String[]
#     # Get network interface IPs
#     # append!(ips, string.(getipaddrs()))
    
#     # Get public IP
#     try
#         public_ip = HTTP.get("https://api.ipify.org").body |> String |> strip
#         push!(ips, public_ip)
#     catch; end
    
#     return unique(filter(!isempty, ips))
# end


function generate_fingerprint()
    identifiers = String[]
    
    # CPU info - read directly from /proc/cpuinfo but only first processor block
    try
        cpu_info = read(pipeline(`head -n 12 /proc/cpuinfo`), String)
        if !isempty(cpu_info)
            # Extract only model name and physical id
            for pattern in [
                r"model name\s*:\s*(.*?)$"m,
                r"physical id\s*:\s*(.*?)$"m,
                r"vendor_id\s*:\s*(.*?)$"m,
                r"cpu family\s*:\s*(.*?)$"m
            ]
                if (m = match(pattern, cpu_info)) !== nothing
                    push!(identifiers, m[1])
                end
            end
        end
    catch; end

    # Machine ID (stable across reboots)
    try
        machine_id = read("/etc/machine-id", String)
        !isempty(machine_id) && push!(identifiers, strip(machine_id))
    catch; end

    # Hostname (as fallback)
    push!(identifiers, gethostname())
    
    # IP addresses
    # append!(identifiers, get_ip_addresses())
    
    # Simple but effective hash function
    str = join(filter(!isempty, unique(identifiers)), "|")
    h = UInt128(5381)
    for c in str
        h = ((h << 5) + h) + UInt128(c)
    end
    
    return string(h, base=16, pad=32)
end
