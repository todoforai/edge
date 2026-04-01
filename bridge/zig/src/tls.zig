const std = @import("std");
const net = std.net;
const crypto = std.crypto;
const Certificate = crypto.Certificate;

pub const Connection = struct {
    stream: net.Stream,
    tls: crypto.tls.Client,
    ca_bundle: Certificate.Bundle,

    pub fn connect(host: []const u8, port: u16) !Connection {
        var host_z: [256]u8 = undefined;
        @memcpy(host_z[0..host.len], host);
        host_z[host.len] = 0;

        const stream = try net.tcpConnectToHost(std.heap.page_allocator, host_z[0..host.len :0], port);
        errdefer stream.close();

        // Load system CA certs at runtime
        var ca_bundle = Certificate.Bundle{};
        try ca_bundle.rescan(std.heap.page_allocator);
        errdefer ca_bundle.deinit(std.heap.page_allocator);

        const tls = try crypto.tls.Client.init(stream, ca_bundle, host);

        return .{ .stream = stream, .tls = tls, .ca_bundle = ca_bundle };
    }

    pub fn read(self: *Connection, buf: []u8) !usize {
        const n = self.tls.read(self.stream, buf) catch |err| {
            if (err == error.EndOfStream) return error.ConnectionClosed;
            return err;
        };
        if (n == 0) return error.ConnectionClosed;
        return n;
    }

    pub fn writeAll(self: *Connection, data: []const u8) !void {
        try self.tls.writeAll(self.stream, data);
    }

    pub fn fd(self: Connection) std.posix.fd_t {
        return self.stream.handle;
    }

    pub fn close(self: *Connection) void {
        _ = self.tls.writeEnd(self.stream, "", true) catch {};
        self.stream.close();
        self.ca_bundle.deinit(std.heap.page_allocator);
    }
};

pub fn init() void {}
