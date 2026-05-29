import { describe, test, expect } from "bun:test";
import path from "path";
import fs from "fs";
import os from "os";
import { discoverAgentMd } from "./agent-md.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agentmd-test-"));
}

describe("discoverAgentMd", () => {
  test("finds AGENT.md at root with full body", async () => {
    const tmp = makeTmpDir();
    fs.writeFileSync(path.join(tmp, "AGENT.md"), "# Project rules\nUse tabs.\n");
    const { files, errors } = await discoverAgentMd([tmp], { includeUserScope: false });
    expect(errors).toEqual([]);
    expect(files.length).toBe(1);
    expect(files[0].scope).toBe("repo");
    expect(files[0].path).toBe(path.join(tmp, "AGENT.md"));
    expect(files[0].content).toBe("# Project rules\nUse tabs.\n");
    expect(files[0].truncated).toBe(false);
    fs.rmSync(tmp, { recursive: true });
  });

  test("accepts both AGENT.md and AGENTS.md", async () => {
    const tmp = makeTmpDir();
    fs.writeFileSync(path.join(tmp, "AGENT.md"), "a\n");
    fs.writeFileSync(path.join(tmp, "AGENTS.md"), "b\n");
    const { files } = await discoverAgentMd([tmp], { includeUserScope: false });
    expect(files.map((f) => path.basename(f.path)).sort()).toEqual(["AGENT.md", "AGENTS.md"]);
    fs.rmSync(tmp, { recursive: true });
  });

  test("returns empty when no AGENT.md present", async () => {
    const tmp = makeTmpDir();
    const { files, errors } = await discoverAgentMd([tmp], { includeUserScope: false });
    expect(files).toEqual([]);
    expect(errors).toEqual([]);
    fs.rmSync(tmp, { recursive: true });
  });

  test("ignores nested AGENT.md (root-only)", async () => {
    const tmp = makeTmpDir();
    fs.mkdirSync(path.join(tmp, "sub"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "sub", "AGENT.md"), "nested\n");
    const { files } = await discoverAgentMd([tmp], { includeUserScope: false });
    expect(files).toEqual([]);
    fs.rmSync(tmp, { recursive: true });
  });

  test("dedupes when same root passed twice", async () => {
    const tmp = makeTmpDir();
    fs.writeFileSync(path.join(tmp, "AGENT.md"), "x\n");
    const { files } = await discoverAgentMd([tmp, tmp], { includeUserScope: false });
    expect(files.length).toBe(1);
    fs.rmSync(tmp, { recursive: true });
  });

  test("merges from multiple roots", async () => {
    const a = makeTmpDir();
    const b = makeTmpDir();
    fs.writeFileSync(path.join(a, "AGENT.md"), "a\n");
    fs.writeFileSync(path.join(b, "AGENTS.md"), "b\n");
    const { files } = await discoverAgentMd([a, b], { includeUserScope: false });
    expect(files.map((f) => f.content).sort()).toEqual(["a\n", "b\n"]);
    fs.rmSync(a, { recursive: true });
    fs.rmSync(b, { recursive: true });
  });

  test("caps body and flags truncation", async () => {
    const tmp = makeTmpDir();
    fs.writeFileSync(path.join(tmp, "AGENT.md"), "x".repeat(100));
    const { files } = await discoverAgentMd([tmp], { includeUserScope: false, maxBytes: 10 });
    expect(files[0].content.length).toBe(10);
    expect(files[0].bytes).toBe(100);
    expect(files[0].truncated).toBe(true);
    fs.rmSync(tmp, { recursive: true });
  });

  test("user-scope path is $HOME/.agents and absolute", async () => {
    const home = os.homedir();
    const dir = path.join(home, ".agents");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "AGENT.md");
    const existed = fs.existsSync(file);
    if (existed) return; // don't clobber a real user file
    fs.writeFileSync(file, "user rules\n");
    try {
      const tmp = makeTmpDir();
      const { files } = await discoverAgentMd([tmp], { includeUserScope: true });
      const u = files.find((f) => f.scope === "user");
      expect(u).toBeDefined();
      expect(u!.path).toBe(file);
      fs.rmSync(tmp, { recursive: true });
    } finally {
      fs.rmSync(file);
    }
  });
});
