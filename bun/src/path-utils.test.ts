import { describe, test, expect } from "bun:test";
import path from "path";
import fs from "fs";
import os from "os";
import { resolveFilePath, WorkspacePathNotFoundError } from "./path-utils.js";

describe("resolveFilePath", () => {
  test("resolves via fallback root paths", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "path-test-"));
    const edgeDir = path.join(tmpDir, "edge");
    const backendDir = path.join(tmpDir, "backend");
    const targetDir = path.join(backendDir, "src", "api", "shared");
    fs.mkdirSync(edgeDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
    const targetFile = path.join(targetDir, "channels.ts");
    fs.writeFileSync(targetFile, "// test file");

    const result = resolveFilePath(
      "backend/src/api/shared/channels.ts",
      edgeDir,
      [backendDir],
    );
    expect(result).toBe(targetFile);
    expect(fs.existsSync(result)).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  test("absolute path passthrough", () => {
    const result = resolveFilePath("/usr/bin/env");
    expect(result).toBe("/usr/bin/env");
  });

  test("tilde expansion", () => {
    const home = process.env.HOME!;
    const result = resolveFilePath("~/.bashrc", "/tmp");
    expect(result).toBe(path.join(home, ".bashrc"));
  });

  test("throws WorkspacePathNotFoundError for missing roots", () => {
    const bogus = "/tmp/nonexistent-root-" + Date.now();
    expect(() => resolveFilePath("foo.txt", bogus)).toThrow(
      WorkspacePathNotFoundError,
    );
  });
});
