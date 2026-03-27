//! Edge Shell - WebSocket → PTY relay for todofor.ai
//!
//! Protocol:
//!   Text frames (JSON) - Control messages:
//!     → {"type":"identity","data":{...}}  (edge info on connect)
//!     ← {"type":"exec"}                   (spawn PTY)
//!     ← {"type":"resize","rows":N,"cols":N}
//!     ← {"type":"signal","sig":N}         (2=INT,9=KILL,15=TERM,etc)
//!     → {"type":"exit","code":N}          (PTY exited)
//!   Binary frames - PTY data (raw bytes, no encoding):
//!     ← binary                            (stdin to PTY)
//!     → binary                            (stdout from PTY)

const std = @import("std");
const tls = @import("tls.zig");
const ws = @import("ws.zig");
const json = @import("json.zig");
const Pty = @import("pty.zig").Pty;
const identity = @import("identity.zig");

const log = std.log.scoped(.edge);
const poll = std.posix.poll;
const pollfd = std.posix.pollfd;
const POLLIN = std.posix.POLL.IN;
const POLLHUP = std.posix.POLL.HUP;
const POLLERR = std.posix.POLL.ERR;

// ============================================================================
// Configuration
// ============================================================================

const config = .{
    .host = "api.todofor.ai",
    .port = 443,
    .path = "/ws/v2/edge-shell",
    .shell = "/bin/sh",
    .buf_size = 4096,
};

// ============================================================================
// Edge Client
// ============================================================================

const Edge = struct {
    conn: *tls.Connection,
    pty: ?Pty = null,
    ws_buf: [config.buf_size]u8 = undefined,
    ws_len: usize = 0,
    pty_buf: [config.buf_size]u8 = undefined,
    id: identity.Identity,
    id_buf: identity.Buffer = .{},

    fn init(conn: *tls.Connection) Edge {
        var edge = Edge{ .conn = conn, .id = undefined };
        edge.id = identity.Identity.gather(&edge.id_buf);
        return edge;
    }

    fn sendIdentity(self: *Edge) !void {
        try self.wsSend(.text, self.id.toJson(&self.id_buf));
        log.info("Identified as {s}@{s} ({s}/{s})", .{
            self.id.user, self.id.hostname, self.id.os, self.id.arch,
        });
    }

    fn run(self: *Edge) !void {
        try self.sendIdentity();

        while (true) {
            // Check for zombie child
            if (self.pty) |*p| {
                if (p.reap()) |code| {
                    try self.sendExit(code);
                    self.closePty();
                }
            }

            var fds = [_]pollfd{
                .{ .fd = self.conn.fd(), .events = POLLIN, .revents = 0 },
                .{ .fd = if (self.pty) |p| p.fd() else -1, .events = POLLIN, .revents = 0 },
            };

            _ = poll(&fds, 100) catch continue;

            // Socket errors
            if (fds[0].revents & (POLLERR | POLLHUP) != 0) return error.ConnectionClosed;

            // WebSocket data
            if (fds[0].revents & POLLIN != 0) try self.handleWsData();

            // PTY handling
            if (self.pty != null) {
                if (fds[1].revents & POLLIN != 0) try self.forwardPtyOutput();
                if (fds[1].revents & (POLLHUP | POLLERR) != 0) {
                    if (self.pty) |*p| {
                        const code = p.close();
                        try self.sendExit(code orelse 0);
                        self.pty = null;
                    }
                }
            }
        }
    }

    fn handleWsData(self: *Edge) !void {
        const n = self.conn.read(self.ws_buf[self.ws_len..]) catch |err| {
            log.err("TLS read error: {}", .{err});
            return error.ConnectionClosed;
        };
        if (n == 0) return error.ConnectionClosed;
        self.ws_len += n;

        while (true) {
            const frame = ws.decode(self.ws_buf[0..self.ws_len]) catch |err| {
                log.err("WebSocket decode error: {}", .{err});
                return error.ConnectionClosed;
            } orelse break;

            switch (frame.opcode) {
                .text => try self.handleCommand(frame.payload),
                .binary => try self.handleInput(frame.payload),
                .ping => try self.wsSend(.pong, frame.payload),
                .close => return error.ConnectionClosed,
                else => {},
            }
            std.mem.copyForwards(u8, &self.ws_buf, self.ws_buf[frame.consumed..self.ws_len]);
            self.ws_len -= frame.consumed;
        }
    }

    fn handleCommand(self: *Edge, msg: []const u8) !void {
        const cmd = json.str(msg, "type") orelse return;

        if (eql(cmd, "exec")) {
            if (self.pty == null) {
                self.pty = try Pty.spawn(config.shell);
                log.info("PTY spawned", .{});
            }
        } else if (eql(cmd, "resize")) {
            if (self.pty) |p| p.resize(
                json.int(msg, "rows", u16) orelse 24,
                json.int(msg, "cols", u16) orelse 80,
            );
        } else if (eql(cmd, "signal")) {
            if (self.pty) |p| {
                if (json.int(msg, "sig", u8)) |sig| {
                    if (!p.signal(sig)) log.warn("Signal {d} not allowed", .{sig});
                }
            }
        }
    }

    fn handleInput(self: *Edge, data: []const u8) !void {
        if (self.pty) |p| p.writeAll(data) catch |err| {
            log.err("PTY write error: {}", .{err});
        };
    }

    fn forwardPtyOutput(self: *Edge) !void {
        if (self.pty) |p| {
            const n = p.read(&self.pty_buf) catch |err| {
                log.err("PTY read error: {}", .{err});
                return;
            };
            if (n == 0) return; // EOF handled by POLLHUP
            try self.wsSend(.binary, self.pty_buf[0..n]); // Raw bytes!
        }
    }

    fn wsSend(self: *Edge, opcode: ws.Opcode, payload: []const u8) !void {
        var buf: [config.buf_size + 14]u8 = undefined; // max header = 14 bytes
        var mask: [4]u8 = undefined;
        std.crypto.random.bytes(&mask);
        const len = ws.encode(&buf, opcode, payload, mask);
        try self.conn.writeAll(buf[0..len]);
    }

    fn sendExit(self: *Edge, code: i32) !void {
        var buf: [64]u8 = undefined;
        const msg = std.fmt.bufPrint(&buf, "{{\"type\":\"exit\",\"code\":{d}}}", .{code}) catch return;
        try self.wsSend(.text, msg);
        log.info("PTY exited with code {d}", .{code});
    }

    fn closePty(self: *Edge) void {
        if (self.pty) |*p| {
            _ = p.close();
            self.pty = null;
        }
    }

    fn deinit(self: *Edge) void {
        self.closePty();
        self.conn.close();
    }
};

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

// ============================================================================
// Main
// ============================================================================

pub fn main() !void {
    tls.init();

    const token = getToken() orelse {
        log.err("Usage: zig-edge <token> or set EDGE_TOKEN env", .{});
        return;
    };

    log.info("Connecting to {s}:{d}...", .{ config.host, config.port });
    var conn = try tls.Connection.connect(config.host, config.port);

    try ws.handshake(&conn, config.host, config.path, token);
    log.info("Connected", .{});

    var edge = Edge.init(&conn);
    defer edge.deinit();

    edge.run() catch |err| switch (err) {
        error.ConnectionClosed => log.info("Disconnected", .{}),
        else => return err,
    };
}

fn getToken() ?[]const u8 {
    var args = std.process.args();
    _ = args.skip();
    return args.next() orelse std.posix.getenv("EDGE_TOKEN");
}
