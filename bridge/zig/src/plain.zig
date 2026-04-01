//! Plain TCP connection — same interface as tls.zig, for local testing.

const std = @import("std");
const net = std.net;

pub const Connection = struct {
    stream: net.Stream,

    pub fn connect(host: []const u8, port: u16) !Connection {
        var host_z: [256]u8 = undefined;
        @memcpy(host_z[0..host.len], host);
        host_z[host.len] = 0;

        const stream = try net.tcpConnectToHost(std.heap.page_allocator, host_z[0..host.len :0], port);
        return .{ .stream = stream };
    }

    pub fn read(self: *Connection, buf: []u8) !usize {
        const n = self.stream.read(buf) catch |err| {
            if (err == error.EndOfStream) return error.ConnectionClosed;
            return err;
        };
        if (n == 0) return error.ConnectionClosed;
        return n;
    }

    pub fn writeAll(self: *Connection, data: []const u8) !void {
        try self.stream.writeAll(data);
    }

    pub fn fd(self: Connection) std.posix.fd_t {
        return self.stream.handle;
    }

    pub fn close(self: *Connection) void {
        self.stream.close();
    }
};

pub fn init() void {}
