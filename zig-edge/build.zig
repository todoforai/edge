const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{ .preferred_optimize_mode = .ReleaseSmall });

    const exe = b.addExecutable(.{
        .name = "zig-edge",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
        .link_libc = true,
    });

    // Default: Zig native TLS (~700KB, zero deps, cross-platform)
    // For ~55KB Linux/macOS builds, switch to tls_openssl.zig and uncomment:
    //   exe.linkSystemLibrary("ssl");
    //   exe.linkSystemLibrary("crypto");

    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| run_cmd.addArgs(args);

    const run_step = b.step("run", "Run zig-edge");
    run_step.dependOn(&run_cmd.step);
}
