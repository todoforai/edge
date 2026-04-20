import { describe, test, expect } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { findReferencedTools, installWithNpm } from "./tool-registry.js";

describe("findReferencedTools - command position detection", () => {
  test("does NOT match tool names as loop arguments", () => {
    const r = findReferencedTools("for service in ahrefs semrush google stripe predis-ai; do\necho $service\ndone");
    expect(r).not.toContain("stripe");
  });

  test("does NOT match newline-separated loop items with tool-name prefixes", () => {
    const r = findReferencedTools(`cd /tmp && for old in \\
  byword-setup-account \\
  stripe-setup-dunning \\
  typefully-setup-account; do
  echo $old
 done`);
    expect(r).not.toContain("stripe");
  });

  test("does NOT match hyphenated tokens at command position", () => {
    expect(findReferencedTools("stripe-setup-dunning")).not.toContain("stripe");
  });

  test("does NOT match tool names in echo/string context", () => {
    expect(findReferencedTools("echo stripe is cool")).not.toContain("stripe");
    expect(findReferencedTools("echo gh is great")).not.toContain("gh");
    expect(findReferencedTools("echo cloudflared is nice")).not.toContain("cloudflared");
  });

  test("does NOT match tool names as variable values", () => {
    expect(findReferencedTools('TOOL="stripe"')).not.toContain("stripe");
    expect(findReferencedTools("name=stripe")).not.toContain("stripe");
  });

  test("does NOT match tool names inside quoted strings (grep patterns, etc.)", () => {
    const cmd = `ls /some/path | grep -iE "vercel|netlify|firebase|stripe|terraform|vault|duckdb|k6|helm" | head -30`;
    const r = findReferencedTools(cmd);
    expect(r).not.toContain("netlify");
    expect(r).not.toContain("firebase");
    expect(r).not.toContain("stripe");
    expect(r).not.toContain("terraform");
    expect(r).not.toContain("vault");
    expect(r).not.toContain("duckdb");
    expect(r).not.toContain("k6");
    expect(r).not.toContain("helm");
  });

  test("does NOT match tool names inside single-quoted strings", () => {
    expect(findReferencedTools("grep 'stripe' file.txt")).not.toContain("stripe");
    expect(findReferencedTools("echo 'run cloudflared here'")).not.toContain("cloudflared");
  });

  test("matches tool at start of command", () => {
    expect(findReferencedTools("stripe login")).toContain("stripe");
    expect(findReferencedTools("gh pr list")).toContain("gh");
    expect(findReferencedTools("cloudflared version")).toContain("cloudflared");
  });

  test("matches tool after pipe", () => {
    expect(findReferencedTools("echo foo | stripe listen")).toContain("stripe");
    expect(findReferencedTools("cat hosts.txt | xargs cloudflared access ssh --hostname example.com")).toContain("cloudflared");
  });

  test("matches tool after && and ||", () => {
    expect(findReferencedTools("cd dir && stripe deploy")).toContain("stripe");
    expect(findReferencedTools("false || gh issue list")).toContain("gh");
  });

  test("matches tool after semicolon", () => {
    expect(findReferencedTools("echo hi; stripe version")).toContain("stripe");
  });

  test("matches tool in subshell $()", () => {
    expect(findReferencedTools("echo $(stripe --version)")).toContain("stripe");
  });

  test("matches tool after sudo", () => {
    expect(findReferencedTools("sudo stripe login")).toContain("stripe");
  });

  test("matches tool after xargs", () => {
    expect(findReferencedTools("find . | xargs cloudflared version")).toContain("cloudflared");
  });

  test("matches tool on new line in multiline script", () => {
    const script = `echo "starting"
stripe listen --forward-to localhost:3000
echo "done"`;
    expect(findReferencedTools(script)).toContain("stripe");
  });
  });

    // Opt-in: hits the real npm registry. Run with: RUN_NPM_INSTALL_TEST=1 bun test tool-registry
    const RUN_INSTALL_TEST = process.env.RUN_NPM_INSTALL_TEST === "1";
    describe.skipIf(!RUN_INSTALL_TEST)("installWithNpm - real install diagnostics", () => {
    test("installs zele (heavy pkg, ~400 deps, native modules)", () => {
    // Clear any prior install so we test the cold path
    const toolsDir = path.join(os.homedir(), ".todoforai", "tools");
    const zeleDir = path.join(toolsDir, "node_modules", "zele");
    if (fs.existsSync(zeleDir)) fs.rmSync(zeleDir, { recursive: true, force: true });

    const start = Date.now();
    try {
      installWithNpm("zele", "zele");
      const elapsed = Date.now() - start;
      console.log(`[test] zele installed in ${elapsed}ms`);
      expect(fs.existsSync(zeleDir)).toBe(true);
    } catch (e: any) {
      const elapsed = Date.now() - start;
      console.error(`[test] zele install FAILED after ${elapsed}ms: ${e.message}`);
      throw e;
    }
    }, 180_000);

    test("bogus package name produces diagnostic error (not 'exit code null')", () => {
    const bogus = "this-package-definitely-does-not-exist-xyz-" + Date.now();
    expect(() => installWithNpm(bogus, bogus)).toThrow();
    try {
      installWithNpm(bogus, bogus);
    } catch (e: any) {
      console.log(`[test] bogus install error: ${e.message}`);
      // Must contain useful info, not just "exit code null"
      expect(e.message).not.toBe("npm install failed: exit code null");
      expect(e.message.length).toBeGreaterThan(30);
    }
    }, 60_000);
  });
