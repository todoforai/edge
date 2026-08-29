import { describe, test, expect } from "bun:test";
import path from "path";
import fs from "fs";
import os from "os";
import { zipSync, unzipSync } from "fflate";
import { readFileContent } from "./files.js";
import { FUNCTION_REGISTRY } from "./functions.js";

const INPUT_DOCX = path.resolve(__dirname, "../../test/input.docx");
const INPUT_PDF = path.resolve(__dirname, "../../test/input.pdf");

const enc = (s: string) => new TextEncoder().encode(s);

/** Build a minimal valid .xlsx (zip container) for corruption tests. */
function writeMinimalXlsx(fp: string) {
  const zip = zipSync({
    "[Content_Types].xml": enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    "_rels/.rels": enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>hi</t></is></c></row></sheetData></worksheet>`),
  });
  fs.writeFileSync(fp, zip);
}

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

  test("read .pdf returns base64 data URL", async () => {
    const root = path.dirname(INPUT_PDF);
    const result = await readFileContent(INPUT_PDF, root, []);
    expect(result.success).toBe(true);
    expect(result.contentType).toBe("application/pdf");
    expect(result.content?.startsWith("data:application/pdf;base64,")).toBe(true);
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

  test("skipSizeLimit bypasses cap", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const fp = path.join(tmp, "big.txt");
    fs.writeFileSync(fp, "x".repeat(200_000));

    const result = await readFileContent(fp, tmp, [], true);
    expect(result.success).toBe(true);
    expect(result.content?.length).toBe(200_000);

    fs.rmSync(tmp, { recursive: true });
  });
});

describe("create_file repacks office XML into the zip container", () => {
  // The bug was that create_file wrote the extracted XML (what read_file returns
  // for a .xlsx) straight to disk as plain text, clobbering the zip container.
  // create_file must instead repack that edited XML back into the original
  // container: the round-trip read → edit → create_file keeps a valid .xlsx and
  // applies the edit.
  test("read → edit XML → create_file keeps a valid .xlsx and applies the edit", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const fp = path.join(tmp, "t.xlsx");
    writeMinimalXlsx(fp);

    // read gives back extracted, pretty-printed XML (not the raw zip bytes)
    const read = await readFileContent(fp, tmp, []);
    expect(read.success).toBe(true);
    expect(read.contentType).toBe("xlsx-xml");
    expect(read.content).toContain("hi");

    // edit the derived XML and write it back through create_file (the pretty-
    // printer puts the cell text on its own line: <t>\n  hi\n</t>)
    const edited = read.content!.replace("hi", "bye");
    const createFile = FUNCTION_REGISTRY.get("create_file")!;
    await createFile({ path: fp, content: edited, rootPath: tmp });

    // file is still a valid zip, and the edit landed in the worksheet
    const bytes = fs.readFileSync(fp);
    const sheet = unzipSync(new Uint8Array(bytes))["xl/worksheets/sheet1.xml"];
    expect(new TextDecoder().decode(sheet)).toContain("bye");

    // and the round-trip through read still parses as xlsx-xml
    const reread = await readFileContent(fp, tmp, []);
    expect(reread.contentType).toBe("xlsx-xml");
    expect(reread.content).toContain("bye");

    fs.rmSync(tmp, { recursive: true });
  });

  test("refuses to create a brand-new .xlsx from XML alone", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const fp = path.join(tmp, "new.xlsx");
    const createFile = FUNCTION_REGISTRY.get("create_file")!;
    await expect(createFile({ path: fp, content: "=== FILE: worksheets/sheet1.xml ===\n<x/>", rootPath: tmp }))
      .rejects.toThrow(/must already exist/i);
    fs.rmSync(tmp, { recursive: true });
  });

  test("still writes plain text files normally", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const fp = path.join(tmp, "note.txt");
    const createFile = FUNCTION_REGISTRY.get("create_file")!;
    await createFile({ path: fp, content: "hello", rootPath: tmp });
    expect(fs.readFileSync(fp, "utf-8")).toBe("hello");
    fs.rmSync(tmp, { recursive: true });
  });
});

describe("create_file reports pre-overwrite content", () => {
  const createFile = () => FUNCTION_REGISTRY.get("create_file")!;

  test("new file → no originalContent", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const r = await createFile()({ path: path.join(tmp, "new.txt"), content: "hi", rootPath: tmp });
    expect(r.originalContent).toBeUndefined();
    fs.rmSync(tmp, { recursive: true });
  });

  test("overwriting an existing text file returns its previous content", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const fp = path.join(tmp, "note.txt");
    fs.writeFileSync(fp, "old content");
    const r = await createFile()({ path: fp, content: "new content", rootPath: tmp });
    expect(r.originalContent).toBe("old content");
    expect(fs.readFileSync(fp, "utf-8")).toBe("new content");
    fs.rmSync(tmp, { recursive: true });
  });

  test("existing empty file → originalContent is ''", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const fp = path.join(tmp, "empty.txt");
    fs.writeFileSync(fp, "");
    const r = await createFile()({ path: fp, content: "now has content", rootPath: tmp });
    expect(r.originalContent).toBe("");
    fs.rmSync(tmp, { recursive: true });
  });

  test("invalid UTF-8 previous content is omitted", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const fp = path.join(tmp, "latin1.txt");
    fs.writeFileSync(fp, Buffer.from([0x68, 0x69, 0xff, 0xfe])); // no NUL, not valid UTF-8
    const r = await createFile()({ path: fp, content: "clean", rootPath: tmp });
    expect(r.originalContent).toBeUndefined();
    fs.rmSync(tmp, { recursive: true });
  });

  test("binary previous content is omitted", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const fp = path.join(tmp, "blob.bin");
    fs.writeFileSync(fp, Buffer.from([0x00, 0x01, 0x02]));
    const r = await createFile()({ path: fp, content: "text now", rootPath: tmp });
    expect(r.originalContent).toBeUndefined();
    fs.rmSync(tmp, { recursive: true });
  });

  test("xlsx overwrite reports the extracted XML as originalContent", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "files-test-"));
    const fp = path.join(tmp, "t.xlsx");
    writeMinimalXlsx(fp);
    const read = await readFileContent(fp, tmp, []);
    const edited = read.content!.replace("hi", "bye");
    const r = await createFile()({ path: fp, content: edited, rootPath: tmp });
    expect(r.originalContent).toContain("hi");
    fs.rmSync(tmp, { recursive: true });
  });
});
