import { describe, test, expect } from "bun:test";
import path from "path";
import fs from "fs";
import os from "os";
import { readFileContent } from "./files.js";

const INPUT_DOCX = path.resolve(__dirname, "../../test/input.docx");
const INPUT_PDF = path.resolve(__dirname, "../../test/input.pdf");

describe("readFileContent", () => {
  test("read text file", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const fp = path.join(tmp, "hello.txt");
    fs.writeFileSync(fp, "hello world");

    const result = await readFileContent(fp, tmp, []);
    expect(result.success).toBe(true);
    expect(result.contentType).toBe("text");
    expect(result.content).toBe("hello world");

    fs.rmSync(tmp, { recursive: true });
  });

  test("read .pdf extracts text", async () => {
    const root = path.dirname(INPUT_PDF);
    const result = await readFileContent(INPUT_PDF, root, []);
    expect(result.success).toBe(true);
    expect(result.contentType).toBe("text");
    expect(result.content).toContain("Dummy PDF file");
    expect(result.content).toContain("PAGE 1");
  });

  test("read .docx returns docx-xml", async () => {
    const root = path.dirname(INPUT_DOCX);
    const result = await readFileContent(INPUT_DOCX, root, []);
    expect(result.success).toBe(true);
    expect(result.contentType).toBe("docx-xml");
    expect(result.content).toContain("Hello world");
  });

  test("read directory lists entries", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    fs.writeFileSync(path.join(tmp, "a.txt"), "");
    fs.mkdirSync(path.join(tmp, "subdir"));

    const result = await readFileContent(tmp, tmp, []);
    expect(result.success).toBe(true);
    expect(result.isDirectory).toBe(true);
    expect(result.content).toContain("a.txt");
    expect(result.content).toContain("subdir/");

    fs.rmSync(tmp, { recursive: true });
  });

  test("file not found", async () => {
    const result = await readFileContent(
      "/tmp/nonexistent-" + Date.now() + ".txt",
      "/tmp",
      [],
    );
    expect(result.success).toBe(false);
  });

  test("file too large", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const fp = path.join(tmp, "big.txt");
    // Write >100KB
    fs.writeFileSync(fp, "x".repeat(200_000));

    const result = await readFileContent(fp, tmp, []);
    expect(result.success).toBe(false);
    expect(result.error).toContain("too large");

    fs.rmSync(tmp, { recursive: true });
  });
});
