const std = @import("std");
const c = @cImport({
    @cInclude("sys/utsname.h");
    @cInclude("unistd.h");
    @cInclude("pwd.h");
});

pub const VERSION = "0.1.0";

pub const Identity = struct {
    edge_version: []const u8 = VERSION,
    os: []const u8,
    arch: []const u8,
    hostname: []const u8,
    kernel: []const u8,
    user: []const u8,
    shell: []const u8,
    home: []const u8,
    cwd: []const u8,

    pub fn gather(buf: *Buffer) Identity {
        _ = c.uname(&buf.uname);

        const pw = c.getpwuid(c.getuid());
        @memset(&buf.cwd, 0);
        _ = c.getcwd(&buf.cwd, buf.cwd.len);

        return .{
            .os = span(&buf.uname.sysname),
            .arch = span(&buf.uname.machine),
            .hostname = span(&buf.uname.nodename),
            .kernel = span(&buf.uname.release),
            .user = if (pw) |p| std.mem.span(p.*.pw_name) else "unknown",
            .shell = if (pw) |p| std.mem.span(p.*.pw_shell) else "/bin/sh",
            .home = if (pw) |p| std.mem.span(p.*.pw_dir) else "/",
            .cwd = span(&buf.cwd),
        };
    }

    fn span(arr: anytype) []const u8 {
        const ptr: [*:0]const u8 = @ptrCast(arr);
        return std.mem.span(ptr);
    }

    pub fn toJson(self: Identity, buf: *Buffer) []const u8 {
        return std.fmt.bufPrint(&buf.json,
            \\{{"type":"identity","data":{{"edge_version":"{s}","os":"{s}","arch":"{s}","hostname":"{s}","kernel":"{s}","user":"{s}","shell":"{s}","home":"{s}","cwd":"{s}"}}}}
        , .{
            self.edge_version,
            self.os,
            self.arch,
            self.hostname,
            self.kernel,
            self.user,
            self.shell,
            self.home,
            self.cwd,
        }) catch "{}";
    }
};

pub const Buffer = struct {
    uname: c.utsname = std.mem.zeroes(c.utsname),
    cwd: [512]u8 = undefined,
    json: [1024]u8 = undefined,
};
