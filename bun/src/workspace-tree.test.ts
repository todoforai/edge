import { describe, test, expect } from "bun:test";
import path from "path";
import fs from "fs";
import os from "os";
import { FUNCTION_REGISTRY } from "./functions.js";

const getWorkspaceTree = FUNCTION_REGISTRY.get("get_workspace_tree")!;

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tree-test-"));
}

function makeStructure(base: string, structure: Record<string, any>) {
  for (const [name, content] of Object.entries(structure)) {
    const p = path.join(base, name);
    if (content === null) {
      fs.writeFileSync(p, "");
    } else if (typeof content === "string") {
      fs.writeFileSync(p, content);
    } else {
      fs.mkdirSync(p, { recursive: true });
      makeStructure(p, content);
    }
  }
}

describe("get_workspace_tree", () => {
  test("basic structure", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      src: { "main.py": null, "utils.py": null },
      "README.md": null,
      "setup.py": null,
    });
    const { tree } = await getWorkspaceTree({ path: tmp, max_depth: 2 });
    expect(tree).toContain("src");
    expect(tree).toContain("README.md");
    expect(tree).toContain("setup.py");
    fs.rmSync(tmp, { recursive: true });
  });

  test("dirs-first ordering", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      "zebra.txt": null,
      alpha: {},
      beta: {},
    });
    const { tree } = await getWorkspaceTree({ path: tmp, max_depth: 1 });
    const lines = tree.split("\n").slice(1); // skip root
    const alphaIdx = lines.findIndex((l: string) => l.includes("alpha"));
    const betaIdx = lines.findIndex((l: string) => l.includes("beta"));
    const zebraIdx = lines.findIndex((l: string) => l.includes("zebra"));
    expect(alphaIdx).toBeLessThan(zebraIdx);
    expect(betaIdx).toBeLessThan(zebraIdx);
    fs.rmSync(tmp, { recursive: true });
  });

  test("depth limiting", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      a: { b: { c: { "deep.txt": null } } },
    });
    const { tree } = await getWorkspaceTree({ path: tmp, max_depth: 1 });
    expect(tree).not.toContain("deep.txt");
    expect(tree).toContain("a");
    fs.rmSync(tmp, { recursive: true });
  });

  test(".git always hidden", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".git": { HEAD: null, config: null },
      src: { "main.py": null },
    });
    const { tree } = await getWorkspaceTree({ path: tmp, max_depth: 2 });
    expect(tree).not.toContain(".git");
    expect(tree).toContain("src");
    fs.rmSync(tmp, { recursive: true });
  });

  test("gitignore excludes patterns", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".git": { HEAD: null },
      ".gitignore": "node_modules\n*.pyc\nbuild/\n",
      node_modules: { pkg: { "index.js": null } },
      build: { "output.js": null },
      src: { "main.py": null, "main.pyc": null },
      "app.py": null,
    });
    const { tree } = await getWorkspaceTree({ path: tmp, max_depth: 2 });
    expect(tree).not.toContain("node_modules");
    expect(tree).not.toContain("build");
    expect(tree).not.toContain("main.pyc");
    expect(tree).toContain("app.py");
    expect(tree).toContain("main.py");
    fs.rmSync(tmp, { recursive: true });
  });

  test("gitignore negation", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".git": { HEAD: null },
      ".gitignore": "*.log\n!important.log\n",
      "debug.log": null,
      "important.log": null,
      "app.py": null,
    });
    const { tree } = await getWorkspaceTree({ path: tmp, max_depth: 2 });
    expect(tree).not.toContain("debug.log");
    expect(tree).toContain("important.log");
    expect(tree).toContain("app.py");
    fs.rmSync(tmp, { recursive: true });
  });

  test("doublestar patterns", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".git": { HEAD: null },
      ".gitignore": "**/*.log\n",
      "root.log": null,
      sub: { "nested.log": null, "keep.txt": null },
    });
    const { tree } = await getWorkspaceTree({ path: tmp, max_depth: 2 });
    expect(tree).not.toContain("root.log");
    expect(tree).not.toContain("nested.log");
    expect(tree).toContain("keep.txt");
    fs.rmSync(tmp, { recursive: true });
  });

  test("nested gitignore", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".git": { HEAD: null },
      src: {
        ".gitignore": "*.tmp\n",
        "main.py": null,
        "cache.tmp": null,
      },
      "root.tmp": null,
    });
    const { tree } = await getWorkspaceTree({ path: tmp, max_depth: 2 });
    expect(tree).toContain("main.py");
    expect(tree).not.toContain("cache.tmp");
    expect(tree).toContain("root.tmp");
    fs.rmSync(tmp, { recursive: true });
  });

  test("empty directory", async () => {
    const tmp = makeTmpDir();
    const { tree } = await getWorkspaceTree({ path: tmp, max_depth: 2 });
    // Should just be the root name (JS fallback) or ".\n\n0 directories, 0 files" (tree cmd)
    const lines = tree.split("\n").filter((l: string) => l.trim());
    // No files listed beyond root line and possible summary
    const hasFiles = lines.some(
      (l: string) =>
        (l.includes("├") || l.includes("└")) && !l.includes("directories"),
    );
    expect(hasFiles).toBe(false);
    fs.rmSync(tmp, { recursive: true });
  });
});
