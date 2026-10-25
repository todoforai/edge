import { describe, test, expect } from "bun:test";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { ensureProfileShims, profileDir, withToolProfiles } from "./tool-profiles.js";

describe("tool profiles", () => {
  test("no / invalid profiles = env untouched", () => {
    const env = { PATH: "/usr/bin" };
    expect(withToolProfiles(env, undefined)).toBe(env);
    expect(withToolProfiles(env, {})).toBe(env);
    expect(withToolProfiles(env, { zele: "../etc" })).toBe(env);
    expect(withToolProfiles(env, { "not-a-catalog-tool": "private" })).toBe(env);
    // Same binary, different profiles: refuse rather than guess.
    expect(withToolProfiles(env, { gdrive: "a", rclone: "b" })).toBe(env);
  });

  test("shim runs the real binary with the profile HOME", () => {
    // Fake `zele` on PATH that prints its HOME.
    const fake = fs.mkdtempSync(path.join(os.tmpdir(), "tfa-prof-"));
    fs.writeFileSync(path.join(fake, "zele"), "#!/bin/sh\nprintf '%s|%s' \"$HOME\" \"$XDG_CONFIG_HOME\"\n", { mode: 0o755 });
    const name = `t${process.pid}`;
    const env = withToolProfiles({ PATH: `${fake}:/usr/bin:/bin` }, { zele: name });
    const shimDir = ensureProfileShims({ zele: name })!;
    expect(env.PATH.startsWith(shimDir + ":")).toBe(true);
    const out = execFileSync("/bin/sh", ["-c", "zele"], { env, encoding: "utf8" });
    expect(out).toBe(`${profileDir(name)}|${profileDir(name)}/.config`);
    // A profiled `grep` doesn't break other shims (no external commands in the shim).
    const both = { zele: name, grep: name };
    const out2 = execFileSync("/bin/sh", ["-c", "zele"], { env: withToolProfiles({ PATH: `${fake}:/usr/bin:/bin` }, both), encoding: "utf8" });
    expect(out2.startsWith(profileDir(name))).toBe(true);
    fs.rmSync(ensureProfileShims(both)!, { recursive: true, force: true });
    // Other tools keep the shared login.
    expect(fs.existsSync(path.join(shimDir, "rclone"))).toBe(false);
    fs.rmSync(profileDir(name), { recursive: true, force: true });
    fs.rmSync(shimDir, { recursive: true, force: true });
    fs.rmSync(fake, { recursive: true, force: true });
  });
});
