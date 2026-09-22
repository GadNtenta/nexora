import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractTextItems, getDocumentProxy, type StructuredTextItem } from "unpdf";
import { htmlToDocxBuffer, htmlToPlainText, officeFileToText, textToOfficeHtml } from "@/lib/documents/office";
import { DOCX_MIME } from "@/lib/documents/mime";
import { runOcr } from "@/lib/ocr/tesseract";

const execFileAsync = promisify(execFile);
const MIN_LAYOUT_CHARS = 40;

const SOFFICE_CANDIDATES = [
  process.env.LIBREOFFICE_PATH,
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  "/opt/homebrew/bin/soffice",
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
].filter((value): value is string => Boolean(value));

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function findSoffice(): Promise<string | null> {
  for (const candidate of SOFFICE_CANDIDATES) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* continue */
    }
  }
  try {
    const { stdout } = await execFileAsync("which", ["soffice"], { timeout: 3000 });
    const path = stdout.trim();
    return path || null;
  } catch {
    return null;
  }
}

async function convertWithLibreOffice(pdfBuffer: Buffer): Promise<Buffer | null> {
  const bin = await findSoffice();
  if (!bin) return null;

  const dir = await mkdtemp(join(tmpdir(), "pdf2docx-"));
  try {
    const input = join(dir, "source.pdf");
    await writeFile(input, pdfBuffer);
    await execFileAsync(bin, ["--headless", "--norestore", "--convert-to", "docx", "--outdir", dir, input], {
      timeout: 120_000,
    });
    return await readFile(join(dir, "source.docx"));
  } catch (error) {
    console.warn("LibreOffice PDF conversion failed", error);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function pageItemsToHtml(items: StructuredTextItem[]): string {
  if (!items.length) return "";
  const sizes = items.map((item) => item.fontSize).filter((size) => size > 0);
  const sortedSizes = [...sizes].sort((a, b) => a - b);
  const median = sortedSizes[Math.floor(sortedSizes.length / 2)] || 12;

  const ordered = [...items].sort((a, b) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) > Math.max(a.fontSize, b.fontSize, 4) * 0.35) return dy;
    return a.x - b.x;
  });

  const lines: StructuredTextItem[][] = [];
  for (const item of ordered) {
    const current = lines[lines.length - 1];
    const threshold = Math.max(item.fontSize, 4) * 0.45;
    if (current && Math.abs(current[0].y - item.y) <= threshold) {
      current.push(item);
    } else {
      lines.push([item]);
    }
  }

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      const text = line
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return "";
      const maxSize = Math.max(...line.map((item) => item.fontSize || median));
      const safe = escapeHtml(text);
      if (maxSize >= median * 1.55) return `<h1>${safe}</h1>`;
      if (maxSize >= median * 1.25) return `<h2>${safe}</h2>`;
      return `<p>${safe}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

async function pdfLayoutHtml(pdfBuffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
  const extracted = await extractTextItems(pdf);
  const pages = Array.isArray(extracted.items) ? extracted.items : [];
  const html = pages
    .map((page, index) => {
      const body = pageItemsToHtml(page);
      if (!body) return "";
      const breakAfter = index < pages.length - 1 ? `<p></p>` : "";
      return `${body}${breakAfter}`;
    })
    .filter(Boolean)
    .join("\n");
  return html;
}

async function pdfToHtml(
  pdfBuffer: Buffer,
  options: { title?: string; fallbackText?: string | null },
): Promise<string> {
  try {
    const layout = await pdfLayoutHtml(pdfBuffer);
    if (htmlToPlainText(layout).length >= MIN_LAYOUT_CHARS) {
      return layout;
    }
  } catch (error) {
    console.warn("PDF layout extraction failed", error);
  }

  const fallback = options.fallbackText?.trim();
  if (fallback && fallback.length >= MIN_LAYOUT_CHARS) {
    return textToOfficeHtml(fallback);
  }

  const ocr = await runOcr({
    buffer: pdfBuffer,
    mimeType: "application/pdf",
    fallbackTitle: options.title || "document",
  });
  if (ocr.text.trim().length >= MIN_LAYOUT_CHARS) {
    return textToOfficeHtml(ocr.text);
  }

  throw new Error("Impossible d'extraire le texte de ce PDF pour le convertir en Word.");
}

export async function convertPdfToDocx(
  pdfBuffer: Buffer,
  options: { title?: string; fallbackText?: string | null } = {},
): Promise<{ buffer: Buffer; text: string }> {
  const fromOffice = await convertWithLibreOffice(pdfBuffer);
  if (fromOffice) {
    const text =
      (await officeFileToText(fromOffice, DOCX_MIME).catch(() => "")) || options.fallbackText || "";
    return { buffer: fromOffice, text };
  }

  const html = await pdfToHtml(pdfBuffer, options);
  return {
    buffer: await htmlToDocxBuffer(html, options.title),
    text: htmlToPlainText(html),
  };
}
