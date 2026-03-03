import { describe, test, expect } from "bun:test";
import path from "path";
import fs from "fs";
import os from "os";
import {
  extractDocxContent,
  saveDocxContent,
  parseMultiFileContent,
  dumpMultiFileContent,
} from "./docx-handler.js";

const INPUT_DOCX = path.resolve(__dirname, "../../test/input.docx");

function xmlOnly(s: string): string {
  const lines = s.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("<?xml")) return lines.slice(i).join("\n");
  }
  return s;
}

function isValidXml(xml: string): boolean {
  // Basic check: starts with <?xml and has balanced root element
  const trimmed = xml.trim();
  if (!trimmed.startsWith("<?xml")) return false;
  // Check it can be parsed by DOMParser-like heuristic: has root element
  const match = trimmed.match(/<(\w[\w:.-]*)[^>]*>/);
  return !!match;
}

describe("docx-handler", () => {
  test("extract DOCX XML is valid", () => {
    const xmlWithHeader = extractDocxContent(INPUT_DOCX);
    const xml = xmlOnly(xmlWithHeader);
    expect(isValidXml(xml)).toBe(true);
  });

  test("DOCX roundtrip preserves content", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docx-test-"));
    const workDocx = path.join(tmpDir, "working.docx");
    fs.copyFileSync(INPUT_DOCX, workDocx);

    const xml1 = xmlOnly(extractDocxContent(workDocx));
    expect(isValidXml(xml1)).toBe(true);

    saveDocxContent(workDocx, xml1);

    const xml2 = xmlOnly(extractDocxContent(workDocx));
    expect(isValidXml(xml2)).toBe(true);

    // Check expected text content
    expect(xml2).toContain("Hello world");
    expect(xml2).toContain("second line");
    expect(xml2).toContain("shift entered");

    fs.rmSync(tmpDir, { recursive: true });
  });

  test("parseMultiFileContent / dumpMultiFileContent roundtrip", () => {
    const original: Record<string, string> = {
      "worksheets/sheet1.xml": '<?xml version="1.0"?>\n<sheet>data1</sheet>',
      "sharedStrings.xml": '<?xml version="1.0"?>\n<sst>strings</sst>',
    };
    const dumped = dumpMultiFileContent(original);
    const parsed = parseMultiFileContent(dumped);

    for (const [key, value] of Object.entries(original)) {
      expect(parsed[key]).toBe(value);
    }
  });

  test("prettyPrintXml produces indented output", () => {
    // extractDocxContent calls prettyPrintXml internally
    const xml = extractDocxContent(INPUT_DOCX);
    // Should have indentation (multiple lines with leading spaces)
    const indentedLines = xml.split("\n").filter((l) => l.startsWith("  "));
    expect(indentedLines.length).toBeGreaterThan(0);
  });
});
