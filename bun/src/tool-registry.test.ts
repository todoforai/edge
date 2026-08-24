import { describe, test, expect } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { findReferencedTools, ensureToolDetailed } from "./tool-registry.js";

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

  test("maps a catalog alias (tfa-cli) to its tool entry", () => {
    expect(findReferencedTools('tfa-cli "delegate this"')).toContain("todoai");
    expect(findReferencedTools('todoforai-cli "delegate this"')).toContain("todoai");
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
    describe.skipIf(!RUN_INSTALL_TEST)("ensureToolDetailed - real install diagnostics", () => {
    test("installs zele via the shared catalog one-liner", async () => {
    // Clear any prior install (package dir AND bin shim — a leftover shim
    // would make isToolInstalled short-circuit into an already-installed
    // no-op and the test would pass without running the install) so we test
    // the cold path (shell installs land in ~/.local — shared-fbe builder).
    const local = path.join(os.homedir(), ".local");
    for (const p of [path.join(local, "lib", "node_modules", "zele"), path.join(local, "bin", "zele")]) {
      if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    }

    const start = Date.now();
    const r = await ensureToolDetailed("zele");
    const elapsed = Date.now() - start;
    console.log(`[test] zele install: ok=${r.ok} error=${r.error ?? "-"} in ${elapsed}ms`);
    expect(r.ok).toBe(true);
    expect(fs.existsSync(path.join(local, "bin", "zele"))).toBe(true);
    }, 300_000);
  });
