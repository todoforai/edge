const std = @import("std");
const posix = std.posix;
const c = @cImport({
    @cInclude("pty.h");
    @cInclude("sys/ioctl.h");
    @cInclude("sys/wait.h");
});

pub const Pty = struct {
    master_fd: posix.fd_t,
    child_pid: posix.pid_t,
    alive: bool = true,

    pub fn spawn(shell: [*:0]const u8) !Pty {
        var master_fd: c_int = undefined;
        const pid = c.forkpty(&master_fd, null, null, null);
        if (pid < 0) return error.ForkFailed;

        if (pid == 0) {
            const env = [_:null]?[*:0]const u8{ "TERM=xterm-256color", "PATH=/usr/bin:/bin", null };
            const argv = [_:null]?[*:0]const u8{ shell, null };
            _ = posix.execvpeZ(shell, &argv, &env) catch {};
            posix.exit(1);
        }

        return .{ .master_fd = master_fd, .child_pid = @intCast(pid) };
    }

    pub fn resize(self: Pty, rows: u16, cols: u16) void {
        var ws = c.winsize{ .ws_row = rows, .ws_col = cols, .ws_xpixel = 0, .ws_ypixel = 0 };
        _ = c.ioctl(self.master_fd, c.TIOCSWINSZ, &ws);
    }

    pub fn writeAll(self: Pty, data: []const u8) !void {
        var written: usize = 0;
        while (written < data.len) {
            written += posix.write(self.master_fd, data[written..]) catch |err| switch (err) {
                error.WouldBlock => continue,
                else => return err,
            };
        }
    }

    pub fn read(self: Pty, buf: []u8) !usize {
        return posix.read(self.master_fd, buf) catch |err| switch (err) {
            error.InputOutput => return 0, // EIO = PTY closed
            else => return err,
        };
    }

    pub fn signal(self: Pty, sig: u8) bool {
        // Whitelist safe signals
        const allowed = [_]u8{ 2, 3, 9, 15, 18, 19, 20, 28 }; // INT, QUIT, KILL, TERM, CONT, STOP, TSTP, WINCH
        for (allowed) |s| {
            if (sig == s) {
                posix.kill(self.child_pid, sig) catch return false;
                return true;
            }
        }
        return false;
    }

    pub fn reap(self: *Pty) ?i32 {
        if (!self.alive) return null;
        var status: c_int = 0;
        const ret = c.waitpid(self.child_pid, &status, c.WNOHANG);
        if (ret > 0) {
            self.alive = false;
            if (c.WIFEXITED(status)) return @intCast(c.WEXITSTATUS(status));
            if (c.WIFSIGNALED(status)) return -@as(i32, @intCast(c.WTERMSIG(status)));
        }
        return null;
    }

    pub fn close(self: *Pty) ?i32 {
        posix.close(self.master_fd);
        // Reap child, blocking if needed
        if (self.alive) {
            var status: c_int = 0;
            _ = c.waitpid(self.child_pid, &status, 0);
            self.alive = false;
            if (c.WIFEXITED(status)) return @intCast(c.WEXITSTATUS(status));
            if (c.WIFSIGNALED(status)) return -@as(i32, @intCast(c.WTERMSIG(status)));
        }
        return null;
    }

    pub fn fd(self: Pty) posix.fd_t {
        return self.master_fd;
    }
};
