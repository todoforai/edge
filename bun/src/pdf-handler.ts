import fs from "fs";
import { extractText } from "unpdf";

export async function extractPdfContent(pdfPath: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const { text, totalPages } = await extractText(data, { mergePages: false });

  const parts: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const pageText = text[i].trim();
    if (pageText) {
      parts.push(`=== PAGE ${i + 1} ===`);
      parts.push(pageText);
    }
  }

  if (parts.length === 0) return `[Empty PDF — ${totalPages} page(s), no extractable text]`;
  return parts.join("\n\n");
}
