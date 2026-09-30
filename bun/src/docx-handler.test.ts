import { describe, test, expect } from "bun:test";
import path from "path";
import fs from "fs";
import os from "os";
import { zipSync, unzipSync } from "fflate";
import {
  extractDocxContent,
  saveDocxContent,
  extractXlsxContent,
  saveXlsxContent,
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

describe("round-trip: extract -> save unchanged keeps text nodes byte-identical", () => {
  const texts = (xml: string) => [...xml.matchAll(/<(\w+:)?t(\s[^>]*)?>([^<]*)<\/(\w+:)?t>/g)].map((m) => m[3]);
  const enc = (s: string) => new TextEncoder().encode(s);
  const dec = (b: Uint8Array) => new TextDecoder().decode(b);
  const tmpFile = (name: string, zip: Record<string, Uint8Array>) => {
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rt-")), name);
    fs.writeFileSync(p, zipSync(zip));
    return p;
  };

  test("xlsx sharedStrings + inline strings", () => {
    const sst = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="x" count="4"><si><t>Kiállító</t></si><si><t>Beta Bt</t></si><si><t xml:space="preserve">  lead &amp; trail  </t></si><si><r><rPr><b/></rPr><t>rich</t></r><r><t xml:space="preserve"> run</t></r></si><si><t></t></si></sst>';
    const sheet = '<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t xml:space="preserve"> inl </t></is></c><c r="C1"><v>50000</v></c></row></sheetData></worksheet>';
    const p = tmpFile("t.xlsx", { "xl/sharedStrings.xml": enc(sst), "xl/worksheets/sheet1.xml": enc(sheet), "xl/styles.xml": enc("<styleSheet/>") });
    saveXlsxContent(p, extractXlsxContent(p));
    const back = unzipSync(new Uint8Array(fs.readFileSync(p)));
    expect(texts(dec(back["xl/sharedStrings.xml"]))).toEqual(texts(sst));
    expect(texts(dec(back["xl/sharedStrings.xml"]))).toEqual(["Kiállító", "Beta Bt", "  lead &amp; trail  ", "rich", " run", ""]);
    expect(texts(dec(back["xl/worksheets/sheet1.xml"]))).toEqual([" inl "]);
    expect(dec(back["xl/worksheets/sheet1.xml"])).toContain("<v>0</v>");
    // stable: second pass identical
    const once = extractXlsxContent(p);
    saveXlsxContent(p, once);
    expect(extractXlsxContent(p)).toBe(once);
  });

  test("docx w:t incl. xml:space=preserve", () => {
    const doc = '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t xml:space="preserve"> world </w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p></w:body></w:document>';
    const p = tmpFile("t.docx", { "word/document.xml": enc(doc) });
    saveDocxContent(p, extractDocxContent(p));
    const back = dec(unzipSync(new Uint8Array(fs.readFileSync(p)))["word/document.xml"]);
    expect(texts(back)).toEqual(["Hello", " world ", " "]);
  });

  test("leaf elements stay on one line", () => {
    const p = tmpFile("t.docx", { "word/document.xml": enc('<?xml version="1.0"?><w:document><w:t>Beta Bt</w:t></w:document>') });
    expect(extractDocxContent(p)).toContain("  <w:t>Beta Bt</w:t>\n");
  });
});
