//! Minimal JSON parsing for control messages.
//! Only handles simple {"key":"value"} and {"key":123} patterns.
//! For PTY data, we use binary WebSocket frames instead.

const std = @import("std");

/// Extract string value for a key: "key":"value"
pub fn str(data: []const u8, comptime key: []const u8) ?[]const u8 {
    const needle = "\"" ++ key ++ "\":\"";
    const start = (std.mem.indexOf(u8, data, needle) orelse return null) + needle.len;
    const end = std.mem.indexOfPos(u8, data, start, "\"") orelse return null;
    return data[start..end];
}

/// Extract integer value for a key: "key":123
pub fn int(data: []const u8, comptime key: []const u8, comptime T: type) ?T {
    const needle = "\"" ++ key ++ "\":";
    const start = (std.mem.indexOf(u8, data, needle) orelse return null) + needle.len;
    var end = start;
    while (end < data.len and data[end] >= '0' and data[end] <= '9') : (end += 1) {}
    return std.fmt.parseInt(T, data[start..end], 10) catch null;
}
