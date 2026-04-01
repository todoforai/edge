//! TODOforAI Bridge Zig runtime - WebSocket → PTY relay for todofor.ai
//!
//! Protocol v2 (multi-session):
//!   Text frames (JSON) - Control messages:
//!     → {"type":"identity","data":{...}}
//!     ← {"type":"exec","todoId":"uuid","blockId":"..."}
//!     ← {"type":"input","todoId":"uuid","blockId":"...","data":"base64"}
//!     ← {"type":"resize","todoId":"uuid","rows":N,"cols":N}
//!     ← {"type":"signal","todoId":"uuid","sig":N}
//!     ← {"type":"kill","todoId":"uuid"}
//!     → {"type":"output","todoId":"uuid","blockId":"...","data":"base64"}
//!     → {"type":"exit","todoId":"uuid","blockId":"...","code":N}
//!     ↔ {"type":"error","todoId":"uuid","blockId":"...","code":"ERR","message":"..."}

const std = @import("std");
const tls = @import("tls.zig");
const plain = @import("plain.zig"); // plain TCP — local testing only (--plain flag)
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

const defaults = .{
    .host = "api.todofor.ai",
    .port = 443,
    .path = "/ws/v2/edge-shell",
    .path_sandbox = "/ws/v2/edge-shell?deviceType=SANDBOX",
    .shell = "/bin/sh",
    .buf_size = 4096,
    .max_sessions = 16,
    .todo_id_len = 36, // UUID length
    .block_id_len = 64,
};

// ============================================================================
// Connection abstraction
// ============================================================================

const Conn = union(enum) {
    tls_conn: tls.Connection,
    plain_conn: plain.Connection,

    pub fn read(self: *Conn, buf: []u8) !usize {
        return switch (self.*) {
            .tls_conn => |*c| c.read(buf),
            .plain_conn => |*c| c.read(buf),
        };
    }

    pub fn writeAll(self: *Conn, data: []const u8) !void {
        return switch (self.*) {
            .tls_conn => |*c| c.writeAll(data),
            .plain_conn => |*c| c.writeAll(data),
        };
    }

    pub fn fd(self: Conn) std.posix.fd_t {
        return switch (self) {
            .tls_conn => |c| c.fd(),
            .plain_conn => |c| c.fd(),
        };
    }

    pub fn close(self: *Conn) void {
        switch (self.*) {
            .tls_conn => |*c| c.close(),
            .plain_conn => |*c| c.close(),
        }
    }
};

// ============================================================================
// PTY Session — one per todoId
// ============================================================================

const Session = struct {
    todo_id: [defaults.todo_id_len]u8,
    block_id: [defaults.block_id_len]u8 = undefined,
    block_id_len: usize = 0,
    pty: Pty,

    fn todoId(self: *const Session) []const u8 {
        return self.todo_id[0..];
    }

    fn blockId(self: *const Session) []const u8 {
        return self.block_id[0..self.block_id_len];
    }

    fn setBlockId(self: *Session, id: ?[]const u8) void {
        if (id) |s| {
            const n = @min(s.len, defaults.block_id_len);
            @memcpy(self.block_id[0..n], s[0..n]);
            self.block_id_len = n;
        }
    }
};

// ============================================================================
// Edge Client
// ============================================================================

const Edge = struct {
    conn: *Conn,
    sessions: [defaults.max_sessions]?Session = [_]?Session{null} ** defaults.max_sessions,
    ws_buf: [defaults.buf_size * 8]u8 = undefined, // larger for base64 output
    ws_len: usize = 0,
    pty_buf: [defaults.buf_size]u8 = undefined,
    b64_buf: [defaults.buf_size * 2]u8 = undefined, // base64 encode buffer
    id: identity.Identity,
    id_buf: identity.Buffer = .{},

    fn init(conn: *Conn) Edge {
        var edge = Edge{ .conn = conn, .id = undefined };
        edge.id = identity.Identity.gather(&edge.id_buf);
        return edge;
    }

    fn sendIdentity(self: *Edge) !void {
        try self.wsSendText(self.id.toJson(&self.id_buf));
        log.info("Identified as {s}@{s} ({s}/{s})", .{
            self.id.user, self.id.hostname, self.id.os, self.id.arch,
        });
    }

    fn run(self: *Edge) !void {
        try self.sendIdentity();

        while (true) {
            // Reap exited PTYs
            for (&self.sessions) |*slot| {
                if (slot.*) |*s| {
                    if (s.pty.reap()) |code| {
                        self.sendExit(s.todoId(), s.blockId(), code) catch {};
                        _ = s.pty.close();
                        slot.* = null;
                    }
                }
            }

            // Build poll fds: [0]=socket, [1..N]=active PTYs
            var fds: [1 + defaults.max_sessions]pollfd = undefined;
            fds[0] = .{ .fd = self.conn.fd(), .events = POLLIN, .revents = 0 };
            var n_fds: usize = 1;
            for (self.sessions) |slot| {
                if (slot) |s| {
                    fds[n_fds] = .{ .fd = s.pty.fd(), .events = POLLIN, .revents = 0 };
                    n_fds += 1;
                }
            }

            _ = poll(fds[0..n_fds], 100) catch continue;

            if (fds[0].revents & (POLLERR | POLLHUP) != 0) return error.ConnectionClosed;
            if (fds[0].revents & POLLIN != 0) try self.handleWsData();

            // Forward PTY output — match fds[1..] back to sessions
            var fi: usize = 1;
            for (&self.sessions) |*slot| {
                if (slot.*) |*s| {
                    if (fi >= n_fds) break;
                    if (fds[fi].revents & POLLIN != 0) {
                        self.forwardPtyOutput(s) catch {};
                    }
                    if (fds[fi].revents & (POLLHUP | POLLERR) != 0) {
                        const code = s.pty.close();
                        self.sendExit(s.todoId(), s.blockId(), code orelse 0) catch {};
                        slot.* = null;
                    }
                    fi += 1;
                }
            }
        }
    }

    fn handleWsData(self: *Edge) !void {
        const n = self.conn.read(self.ws_buf[self.ws_len..]) catch |err| {
            log.err("Read error: {}", .{err});
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
                .text => self.handleCommand(frame.payload) catch |err|
                    log.err("Command error: {}", .{err}),
                .ping => try self.wsSendFrame(.pong, frame.payload),
                .close => return error.ConnectionClosed,
                else => {},
            }
            std.mem.copyForwards(u8, &self.ws_buf, self.ws_buf[frame.consumed..self.ws_len]);
            self.ws_len -= frame.consumed;
        }
    }

    fn handleCommand(self: *Edge, msg: []const u8) !void {
        const cmd = json.str(msg, "type") orelse return;
        const todo_id = json.str(msg, "todoId");
        const block_id = json.str(msg, "blockId");

        if (eql(cmd, "exec")) {
            const tid = todo_id orelse return self.sendError(null, null, "MISSING_TODO_ID", "exec requires todoId");
            if (!isValidUuid(tid)) return self.sendError(tid, block_id, "INVALID_TODO_ID", "todoId must be a valid UUID");
            if (self.findSession(tid) != null) return self.sendError(tid, block_id, "SESSION_EXISTS", "session already exists");
            const slot = self.freeSlot() orelse return self.sendError(tid, block_id, "MAX_SESSIONS", "max 16 concurrent sessions");
            const pty = Pty.spawn(defaults.shell) catch |err| {
                log.err("PTY spawn failed: {}", .{err});
                return self.sendError(tid, block_id, "SPAWN_FAILED", "failed to spawn PTY");
            };
            slot.* = Session{ .todo_id = undefined, .pty = pty };
            @memcpy(&slot.*.?.todo_id, tid[0..defaults.todo_id_len]);
            slot.*.?.setBlockId(block_id);
            log.info("PTY spawned for {s}", .{tid});

        } else if (eql(cmd, "input")) {
            const tid = todo_id orelse return self.sendError(null, null, "MISSING_TODO_ID", "input requires todoId");
            const s = self.findSession(tid) orelse return self.sendError(tid, block_id, "SESSION_NOT_FOUND", "no session for todoId");
            s.setBlockId(block_id);
            const b64 = json.str(msg, "data") orelse return self.sendError(tid, block_id, "MISSING_DATA", "input requires data");
            var decode_buf: [defaults.buf_size]u8 = undefined;
            const decoded_len = std.base64.standard.Decoder.calcSizeForSlice(b64) catch
                return self.sendError(tid, block_id, "INVALID_BASE64", "data is not valid base64");
            if (decoded_len > defaults.buf_size) return self.sendError(tid, block_id, "INPUT_TOO_LARGE", "input exceeds 4096 bytes");
            std.base64.standard.Decoder.decode(decode_buf[0..decoded_len], b64) catch
                return self.sendError(tid, block_id, "INVALID_BASE64", "data is not valid base64");
            s.pty.writeAll(decode_buf[0..decoded_len]) catch |err|
                log.err("PTY write error: {}", .{err});

        } else if (eql(cmd, "resize")) {
            const tid = todo_id orelse return;
            if (self.findSession(tid)) |s| s.pty.resize(
                json.int(msg, "rows", u16) orelse 24,
                json.int(msg, "cols", u16) orelse 80,
            );

        } else if (eql(cmd, "signal")) {
            const tid = todo_id orelse return;
            if (self.findSession(tid)) |s| {
                const sig = json.int(msg, "sig", u8) orelse return self.sendError(tid, block_id, "MISSING_SIG", "signal requires sig");
                if (!s.pty.signal(sig)) return self.sendError(tid, block_id, "SIGNAL_NOT_ALLOWED", "signal not in whitelist");
            }

        } else if (eql(cmd, "kill")) {
            const tid = todo_id orelse return;
            for (&self.sessions) |*slot| {
                if (slot.*) |*s| {
                    if (eql(s.todoId(), tid)) {
                        _ = s.pty.close();
                        slot.* = null;
                        log.info("Session killed: {s}", .{tid});
                        break;
                    }
                }
            }
        }
    }

    fn forwardPtyOutput(self: *Edge, s: *Session) !void {
        const n = s.pty.read(&self.pty_buf) catch |err| {
            log.err("PTY read error: {}", .{err});
            return;
        };
        if (n == 0) return;

        // base64-encode the raw PTY bytes
        const b64_len = std.base64.standard.Encoder.calcSize(n);
        const b64 = std.base64.standard.Encoder.encode(self.b64_buf[0..b64_len], self.pty_buf[0..n]);

        // {"type":"output","todoId":"...","blockId":"...","data":"..."}
        var msg_buf: [defaults.buf_size * 3]u8 = undefined;
        const msg = if (s.block_id_len > 0)
            std.fmt.bufPrint(&msg_buf,
                "{{\"type\":\"output\",\"todoId\":\"{s}\",\"blockId\":\"{s}\",\"data\":\"{s}\"}}",
                .{ s.todoId(), s.blockId(), b64 }) catch return
        else
            std.fmt.bufPrint(&msg_buf,
                "{{\"type\":\"output\",\"todoId\":\"{s}\",\"data\":\"{s}\"}}",
                .{ s.todoId(), b64 }) catch return;

        try self.wsSendText(msg);
    }

    fn sendExit(self: *Edge, todo_id: []const u8, block_id: []const u8, code: i32) !void {
        var buf: [256]u8 = undefined;
        const msg = if (block_id.len > 0)
            std.fmt.bufPrint(&buf,
                "{{\"type\":\"exit\",\"todoId\":\"{s}\",\"blockId\":\"{s}\",\"code\":{d}}}",
                .{ todo_id, block_id, code }) catch return
        else
            std.fmt.bufPrint(&buf,
                "{{\"type\":\"exit\",\"todoId\":\"{s}\",\"code\":{d}}}",
                .{ todo_id, code }) catch return;
        try self.wsSendText(msg);
        log.info("PTY exited: {s} code={d}", .{ todo_id, code });
    }

    fn sendError(self: *Edge, todo_id: ?[]const u8, block_id: ?[]const u8, code: []const u8, message: []const u8) void {
        var buf: [512]u8 = undefined;
        const msg = if (todo_id) |tid|
            if (block_id) |bid|
                std.fmt.bufPrint(&buf,
                    "{{\"type\":\"error\",\"todoId\":\"{s}\",\"blockId\":\"{s}\",\"code\":\"{s}\",\"message\":\"{s}\"}}",
                    .{ tid, bid, code, message }) catch return
            else
                std.fmt.bufPrint(&buf,
                    "{{\"type\":\"error\",\"todoId\":\"{s}\",\"code\":\"{s}\",\"message\":\"{s}\"}}",
                    .{ tid, code, message }) catch return
        else
            std.fmt.bufPrint(&buf,
                "{{\"type\":\"error\",\"code\":\"{s}\",\"message\":\"{s}\"}}",
                .{ code, message }) catch return;
        self.wsSendText(msg) catch {};
        log.warn("Error {s}: {s}", .{ code, message });
    }

    fn wsSendText(self: *Edge, payload: []const u8) !void {
        try self.wsSendFrame(.text, payload);
    }

    fn wsSendFrame(self: *Edge, opcode: ws.Opcode, payload: []const u8) !void {
        // Allocate on heap for large payloads (output messages can be big)
        const frame_len = payload.len + 14;
        const buf = try std.heap.page_allocator.alloc(u8, frame_len);
        defer std.heap.page_allocator.free(buf);
        var mask: [4]u8 = undefined;
        std.crypto.random.bytes(&mask);
        const len = ws.encode(buf, opcode, payload, mask);
        try self.conn.writeAll(buf[0..len]);
    }

    fn findSession(self: *Edge, todo_id: []const u8) ?*Session {
        for (&self.sessions) |*slot| {
            if (slot.*) |*s| {
                if (eql(s.todoId(), todo_id)) return s;
            }
        }
        return null;
    }

    fn freeSlot(self: *Edge) ?*?Session {
        for (&self.sessions) |*slot| {
            if (slot.* == null) return slot;
        }
        return null;
    }

    fn deinit(self: *Edge) void {
        for (&self.sessions) |*slot| {
            if (slot.*) |*s| {
                _ = s.pty.close();
                slot.* = null;
            }
        }
        self.conn.close();
    }
};

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

fn isValidUuid(s: []const u8) bool {
    if (s.len != 36) return false;
    // xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const dashes = [_]usize{ 8, 13, 18, 23 };
    for (dashes) |i| if (s[i] != '-') return false;
    for (s, 0..) |c, i| {
        const is_dash_pos = i == 8 or i == 13 or i == 18 or i == 23;
        if (!is_dash_pos and !std.ascii.isHex(c)) return false;
    }
    return true;
}

// ============================================================================
// Main
// ============================================================================

pub fn main() !void {
    tls.init();

    // Try /proc/cmdline first (Firecracker kernel arg: edge.token=<token>)
    var cmdline_buf: [4096]u8 = undefined;
    const cmdline_token = getCmdlineToken(&cmdline_buf);
    const from_cmdline = cmdline_token != null;

    const token = cmdline_token orelse getToken() orelse {
        log.err("Usage: bridge-zig <token> [--plain] [--host HOST] [--port PORT]", .{});
        log.err("  env: EDGE_TOKEN, EDGE_HOST, EDGE_PORT, EDGE_PLAIN=1", .{});
        return;
    };

    const use_plain = getFlag("--plain") or envBool("EDGE_PLAIN");
    const host = getArg("--host") orelse std.posix.getenv("EDGE_HOST") orelse defaults.host;
    const port = blk: {
        const p = getArg("--port") orelse std.posix.getenv("EDGE_PORT");
        break :blk if (p) |s| std.fmt.parseInt(u16, s, 10) catch defaults.port
            else if (use_plain) @as(u16, 4000) else defaults.port;
    };
    // Sandbox VMs (token from kernel cmdline) register as DeviceType.SANDBOX
    const path = if (from_cmdline) defaults.path_sandbox else defaults.path;

    log.info("Connecting to {s}:{d} ({s})...", .{ host, port, if (use_plain) "plain" else "tls" });

    var conn: Conn = if (use_plain)
        .{ .plain_conn = try plain.Connection.connect(host, port) }
    else
        .{ .tls_conn = try tls.Connection.connect(host, port) };

    try ws.handshake(&conn, host, path, token);
    log.info("Connected", .{});

    var edge = Edge.init(&conn);
    defer edge.deinit();

    edge.run() catch |err| switch (err) {
        error.ConnectionClosed => log.info("Disconnected", .{}),
        else => return err,
    };
}

// Known flags that take a value — their values must not be mistaken for the token
const value_flags = [_][]const u8{ "--host", "--port" };

fn getToken() ?[]const u8 {
    var args = std.process.args();
    _ = args.skip();
    while (args.next()) |arg| {
        if (std.mem.startsWith(u8, arg, "-")) {
            for (value_flags) |f| {
                if (std.mem.eql(u8, arg, f)) { _ = args.next(); break; }
            }
            continue;
        }
        return arg;
    }
    return std.posix.getenv("EDGE_TOKEN");
}

fn getFlag(flag: []const u8) bool {
    var args = std.process.args();
    _ = args.skip();
    while (args.next()) |arg| {
        if (std.mem.eql(u8, arg, flag)) return true;
    }
    return false;
}

fn getArg(name: []const u8) ?[]const u8 {
    var args = std.process.args();
    _ = args.skip();
    while (args.next()) |arg| {
        if (std.mem.eql(u8, arg, name)) return args.next();
    }
    return null;
}

fn envBool(name: []const u8) bool {
    const v = std.posix.getenv(name) orelse return false;
    return v.len > 0 and v[0] == '1';
}

/// Read edge.token=<value> from /proc/cmdline (Firecracker kernel arg).
/// Returns a slice into buf, or null if not present or unreadable.
fn getCmdlineToken(buf: []u8) ?[]const u8 {
    const f = std.fs.openFileAbsolute("/proc/cmdline", .{}) catch return null;
    defer f.close();
    const n = f.read(buf) catch return null;
    const line = std.mem.trimRight(u8, buf[0..n], "\n ");
    const needle = "edge.token=";
    const start = (std.mem.indexOf(u8, line, needle) orelse return null) + needle.len;
    const rest = line[start..];
    const end = std.mem.indexOfScalar(u8, rest, ' ') orelse rest.len;
    return if (end > 0) rest[0..end] else null;
}
