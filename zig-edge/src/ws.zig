const std = @import("std");
const Sha1 = std.crypto.hash.Sha1;

pub const Opcode = enum(u4) {
    continuation = 0,
    text = 1,
    binary = 2,
    close = 8,
    ping = 9,
    pong = 10,

    pub fn isControl(self: Opcode) bool {
        return @intFromEnum(self) >= 8;
    }
};

pub const Frame = struct {
    opcode: Opcode,
    payload: []const u8,
    consumed: usize,
    fin: bool,
};

pub const DecodeError = error{
    MaskedServerFrame,
    InvalidOpcode,
};

pub fn encode(buf: []u8, opcode: Opcode, payload: []const u8, mask_key: [4]u8) usize {
    var i: usize = 0;
    buf[i] = 0x80 | @as(u8, @intFromEnum(opcode));
    i += 1;

    if (payload.len < 126) {
        buf[i] = @as(u8, @intCast(payload.len)) | 0x80;
        i += 1;
    } else if (payload.len <= 65535) {
        buf[i] = 126 | 0x80;
        i += 1;
        buf[i] = @intCast(payload.len >> 8);
        buf[i + 1] = @intCast(payload.len & 0xFF);
        i += 2;
    } else {
        buf[i] = 127 | 0x80;
        i += 1;
        inline for (0..8) |j| buf[i + j] = @intCast((payload.len >> @intCast(56 - j * 8)) & 0xFF);
        i += 8;
    }

    @memcpy(buf[i..][0..4], &mask_key);
    i += 4;

    for (payload, 0..) |byte, j| buf[i + j] = byte ^ mask_key[j % 4];
    return i + payload.len;
}

pub fn decode(buf: []const u8) DecodeError!?Frame {
    if (buf.len < 2) return null;

    const fin = (buf[0] & 0x80) != 0;
    const opcode_raw = buf[0] & 0x0F;
    if (opcode_raw > 10 or (opcode_raw > 2 and opcode_raw < 8)) return error.InvalidOpcode;
    const opcode: Opcode = @enumFromInt(@as(u4, @truncate(opcode_raw)));

    const masked = (buf[1] & 0x80) != 0;
    if (masked) return error.MaskedServerFrame; // Server must not mask

    var payload_len: usize = buf[1] & 0x7F;
    var offset: usize = 2;

    if (payload_len == 126) {
        if (buf.len < 4) return null;
        payload_len = (@as(usize, buf[2]) << 8) | buf[3];
        offset = 4;
    } else if (payload_len == 127) {
        if (buf.len < 10) return null;
        payload_len = 0;
        inline for (0..8) |i| payload_len = (payload_len << 8) | buf[2 + i];
        offset = 10;
    }

    if (buf.len < offset + payload_len) return null;

    return .{
        .opcode = opcode,
        .payload = buf[offset..][0..payload_len],
        .consumed = offset + payload_len,
        .fin = fin,
    };
}

pub const HandshakeError = error{
    ConnectionClosed,
    HandshakeFailed,
    InvalidResponse,
    HeaderTooLarge,
};

pub fn handshake(conn: anytype, host: []const u8, path: []const u8, token: []const u8) !void {
    var buf: [4096]u8 = undefined;

    // Generate key
    var key: [16]u8 = undefined;
    std.crypto.random.bytes(&key);
    var key_b64: [24]u8 = undefined;
    _ = std.base64.standard.Encoder.encode(&key_b64, &key);

    // Build and send request
    var req_buf: [1024]u8 = undefined;
    const req = std.fmt.bufPrint(&req_buf, "GET {s} HTTP/1.1\r\n" ++
        "Host: {s}\r\n" ++
        "Upgrade: websocket\r\n" ++
        "Connection: Upgrade\r\n" ++
        "Sec-WebSocket-Key: {s}\r\n" ++
        "Sec-WebSocket-Version: 13\r\n" ++
        "Authorization: Bearer {s}\r\n\r\n", .{ path, host, &key_b64, token }) catch unreachable;

    try conn.writeAll(req);

    // Read response until \r\n\r\n
    var total: usize = 0;
    while (total < buf.len) {
        const n = try conn.read(buf[total..]);
        if (n == 0) return error.ConnectionClosed;
        total += n;
        if (std.mem.indexOf(u8, buf[0..total], "\r\n\r\n")) |_| break;
    } else return error.HeaderTooLarge;

    const response = buf[0..total];

    // Validate status line: HTTP/1.1 101
    if (!std.mem.startsWith(u8, response, "HTTP/1.1 101")) return error.HandshakeFailed;

    // Validate required headers
    if (!hasHeader(response, "upgrade", "websocket")) return error.InvalidResponse;
    if (!hasHeader(response, "connection", "upgrade")) return error.InvalidResponse;

    // Validate Sec-WebSocket-Accept
    const expected_accept = computeAcceptKey(&key_b64);
    if (!hasHeader(response, "sec-websocket-accept", &expected_accept)) return error.InvalidResponse;
}

fn hasHeader(response: []const u8, name: []const u8, expected: []const u8) bool {
    var lines = std.mem.splitSequence(u8, response, "\r\n");
    while (lines.next()) |line| {
        if (std.mem.indexOfScalar(u8, line, ':')) |colon| {
            const header_name = std.mem.trim(u8, line[0..colon], " \t");
            const header_value = std.mem.trim(u8, line[colon + 1 ..], " \t");
            if (std.ascii.eqlIgnoreCase(header_name, name) and
                std.ascii.eqlIgnoreCase(header_value, expected))
            {
                return true;
            }
        }
    }
    return false;
}

fn computeAcceptKey(key: *const [24]u8) [28]u8 {
    const magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    var hasher = Sha1.init(.{});
    hasher.update(key);
    hasher.update(magic);
    const hash = hasher.finalResult();
    var result: [28]u8 = undefined;
    _ = std.base64.standard.Encoder.encode(&result, &hash);
    return result;
}
