//! OpenSSL TLS backend — drop-in replacement for tls.zig
//!
//! Produces a ~55KB binary on Linux/macOS (vs ~700KB with native Zig TLS).
//! Requires libssl + libcrypto at runtime (available on every Linux/macOS).
//!
//! To use: replace `@import("tls.zig")` with `@import("tls_openssl.zig")` in main.zig
//!         and add to build.zig:
//!           exe.linkSystemLibrary("ssl");
//!           exe.linkSystemLibrary("crypto");

const std = @import("std");
const c = @cImport({
    @cInclude("openssl/ssl.h");
    @cInclude("openssl/err.h");
});

pub const Connection = struct {
    sock_fd: std.posix.fd_t,
    ssl: *c.SSL,
    ctx: *c.SSL_CTX,

    pub fn connect(host: []const u8, port: u16) !Connection {
        var host_z: [256]u8 = undefined;
        @memcpy(host_z[0..host.len], host);
        host_z[host.len] = 0;

        const stream = try std.net.tcpConnectToHost(std.heap.page_allocator, host_z[0..host.len :0], port);
        const sock_fd = stream.handle;

        const ctx = c.SSL_CTX_new(c.TLS_client_method()) orelse return error.SslContextFailed;
        errdefer c.SSL_CTX_free(ctx);

        if (c.SSL_CTX_set_default_verify_paths(ctx) != 1) return error.SslCertsFailed;

        const ssl = c.SSL_new(ctx) orelse return error.SslNewFailed;
        errdefer c.SSL_free(ssl);

        _ = c.SSL_set_tlsext_host_name(ssl, &host_z);
        _ = c.SSL_set_fd(ssl, sock_fd);

        if (c.SSL_connect(ssl) != 1) return error.SslConnectFailed;

        return .{ .sock_fd = sock_fd, .ssl = ssl, .ctx = ctx };
    }

    pub fn read(self: *Connection, buf: []u8) !usize {
        const n = c.SSL_read(self.ssl, buf.ptr, @intCast(buf.len));
        if (n <= 0) return error.SslReadFailed;
        return @intCast(n);
    }

    pub fn writeAll(self: *Connection, data: []const u8) !void {
        var written: usize = 0;
        while (written < data.len) {
            const n = c.SSL_write(self.ssl, data[written..].ptr, @intCast(data.len - written));
            if (n <= 0) return error.SslWriteFailed;
            written += @intCast(n);
        }
    }

    pub fn fd(self: Connection) std.posix.fd_t {
        return self.sock_fd;
    }

    pub fn close(self: *Connection) void {
        _ = c.SSL_shutdown(self.ssl);
        c.SSL_free(self.ssl);
        c.SSL_CTX_free(self.ctx);
        std.posix.close(self.sock_fd);
    }
};

pub fn init() void {
    _ = c.OPENSSL_init_ssl(0, null);
}
