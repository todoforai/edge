import fs from "fs";
import { unzipSync, zipSync, type Unzipped } from "fflate";

// ── Pretty-print XML (simple regex-based indenter) ──

function prettyPrintXml(xml: string): string {
  // Normalize to single line first
  let formatted = "";
  let indent = 0;
  const parts = xml.replace(/>\s*</g, "><").split(/(<[^>]+>)/);
  for (const part of parts) {
    if (!part.trim()) continue;
    if (part.startsWith("</")) {
      indent = Math.max(indent - 1, 0);
      formatted += "  ".repeat(indent) + part + "\n";
    } else if (part.startsWith("<?")) {
      formatted += part + "\n";
    } else if (part.startsWith("<") && !part.endsWith("/>") && !part.startsWith("<!")) {
      formatted += "  ".repeat(indent) + part + "\n";
      indent++;
    } else if (part.endsWith("/>")) {
      formatted += "  ".repeat(indent) + part + "\n";
    } else {
      formatted += "  ".repeat(indent) + part + "\n";
    }
  }
  return formatted;
}

// ── Multi-file format helpers ──

export function parseMultiFileContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = content.split("=== FILE: ");
  for (const part of parts.slice(1)) {
    const endIdx = part.indexOf(" ===");
    if (endIdx === -1) continue;
    const filename = part.slice(0, endIdx);
    const xmlContent = part.slice(endIdx + 4).trim();
    if (filename && xmlContent) result[filename] = xmlContent;
  }
  return result;
}

export function dumpMultiFileContent(filesMap: Record<string, string>): string {
  const parts: string[] = [];
  for (const [key, content] of Object.entries(filesMap)) {
    parts.push(`=== FILE: ${key} ===`);
    parts.push(content.trim());
  }
  return parts.join("\n\n");
}

// ── Clean header from XML ──

function cleanHeaderFromXml(xmlContent: string): string {
  const lines = xmlContent.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("<?xml")) {
      return lines.slice(i).join("\n");
    }
  }
  return xmlContent;
}

// ── DOCX ──

export function extractDocxContent(docxPath: string): string {
  const data = new Uint8Array(fs.readFileSync(docxPath));
  const zip = unzipSync(data);
  const docXml = zip["word/document.xml"];
  if (!docXml) throw new Error("Invalid DOCX: 'word/document.xml' not found");
  const xml = new TextDecoder().decode(docXml);
  return prettyPrintXml(xml);
}

export function saveDocxContent(docxPath: string, xmlContent: string): void {
  const data = new Uint8Array(fs.readFileSync(docxPath));
  const zip = unzipSync(data);

  if (!zip["word/document.xml"]) {
    throw new Error("Invalid DOCX: 'word/document.xml' not found");
  }

  const cleanXml = cleanHeaderFromXml(xmlContent);
  zip["word/document.xml"] = new TextEncoder().encode(cleanXml);

  const out = zipSync(zip);
  const tmpPath = docxPath + ".tmp";
  try {
    fs.writeFileSync(tmpPath, out);
    fs.renameSync(tmpPath, docxPath);
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw e;
  }
}

// ── XLSX ──

export function extractXlsxContent(xlsxPath: string): string {
  const data = new Uint8Array(fs.readFileSync(xlsxPath));
  const zip = unzipSync(data);
  const result: Record<string, string> = {};

  // Extract worksheets
  for (const name of Object.keys(zip)) {
    if (name.startsWith("xl/worksheets/") && name.endsWith(".xml")) {
      const key = name.replace("xl/", "");
      result[key] = prettyPrintXml(new TextDecoder().decode(zip[name]));
    }
  }

  // Shared strings
  if (zip["xl/sharedStrings.xml"]) {
    result["sharedStrings.xml"] = prettyPrintXml(new TextDecoder().decode(zip["xl/sharedStrings.xml"]));
  }

  // Styles
  if (zip["xl/styles.xml"]) {
    result["styles.xml"] = prettyPrintXml(new TextDecoder().decode(zip["xl/styles.xml"]));
  }

  return dumpMultiFileContent(result);
}

export function saveXlsxContent(xlsxPath: string, multiFileContent: string): void {
  const xmlFiles = parseMultiFileContent(multiFileContent);
  const data = new Uint8Array(fs.readFileSync(xlsxPath));
  const zip = unzipSync(data);

  for (const [key, xmlContent] of Object.entries(xmlFiles)) {
    const fullPath = `xl/${key}`;
    const cleanXml = cleanHeaderFromXml(xmlContent);
    zip[fullPath] = new TextEncoder().encode(cleanXml);
  }

  const out = zipSync(zip);
  const tmpPath = xlsxPath + ".tmp";
  try {
    fs.writeFileSync(tmpPath, out);
    fs.renameSync(tmpPath, xlsxPath);
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw e;
  }
}
