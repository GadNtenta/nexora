import mammoth from "mammoth";
import htmlToDocx from "html-to-docx";
import WordExtractor from "word-extractor";
import { DOCX_MIME, isLegacyWordMime } from "@/lib/documents/mime";
import { htmlToPlainText, sanitizeOfficeHtml } from "@/lib/html/sanitize";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphsFromText(text: string): string {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`);
  return blocks.join("") || "<p></p>";
}

async function toBuffer(value: ArrayBuffer | Blob | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer);
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return Buffer.from(await value.arrayBuffer());
  }
  throw new Error("Conversion Word : format de fichier inattendu");
}

export { htmlToPlainText, sanitizeOfficeHtml };

export function textToOfficeHtml(text: string): string {
  return sanitizeOfficeHtml(paragraphsFromText(text));
}

export async function extractLegacyDocText(buffer: Buffer): Promise<string> {
  const extractor = new WordExtractor();
  const document = await extractor.extract(buffer);
  return document.getBody().trim();
}

export async function officeFileToHtml(buffer: Buffer, mimeType: string): Promise<string> {
  if (isLegacyWordMime(mimeType)) {
    const text = await extractLegacyDocText(buffer);
    return sanitizeOfficeHtml(paragraphsFromText(text));
  }

  const result = await mammoth.convertToHtml(
    { buffer },
    { convertImage: mammoth.images.dataUri },
  );
  return sanitizeOfficeHtml(result.value || "<p></p>");
}

export async function officeFileToText(buffer: Buffer, mimeType: string): Promise<string> {
  if (isLegacyWordMime(mimeType)) {
    return extractLegacyDocText(buffer);
  }
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

export async function htmlToDocxBuffer(html: string, title?: string): Promise<Buffer> {
  const clean = sanitizeOfficeHtml(html || "<p></p>");
  const wrapped = `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body>${clean}</body></html>`;
  const output = await htmlToDocx(wrapped, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
    lang: "fr-FR",
    title,
    font: "Calibri",
    fontSize: 22,
  });
  return toBuffer(output);
}

export { DOCX_MIME };
