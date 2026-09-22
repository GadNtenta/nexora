import { createWorker, type Worker } from "tesseract.js";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import { detectDocumentDate, suggestTags, suggestTitle } from "@/lib/ocr/metadata";
import { officeFileToText } from "@/lib/documents/office";
import { isWordMime } from "@/lib/documents/mime";

export type OcrResult = {
  text: string;
  title: string;
  detectedDate: Date | null;
  tags: string[];
};

const MIN_NATIVE_TEXT = 40;
const MAX_OCR_PAGES = 8;
const PDF_RENDER_SCALE = 1.4;

function toNodeBuffer(image: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(image)) return image;
  if (image instanceof Uint8Array) return Buffer.from(image);
  return Buffer.from(new Uint8Array(image));
}

async function ocrImage(worker: Worker, image: Buffer | Uint8Array | ArrayBuffer): Promise<string> {
  const { data } = await worker.recognize(toNodeBuffer(image));
  return data.text?.trim() ?? "";
}

async function extractPdfText(buffer: Buffer): Promise<{ text: string; totalPages: number }> {
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const result = await extractText(pdf, { mergePages: true });
  return { text: result.text.trim(), totalPages: result.totalPages || pdf.numPages };
}

async function ocrPdfPages(buffer: Buffer, totalPages: number, worker: Worker): Promise<string> {
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const pages = Math.min(pdf.numPages || totalPages || 1, MAX_OCR_PAGES);
  const parts: string[] = [];

  for (let page = 1; page <= pages; page += 1) {
    try {
      const image = await renderPageAsImage(pdf, page, {
        canvasImport: () => import("@napi-rs/canvas"),
        scale: PDF_RENDER_SCALE,
      });
      const text = await ocrImage(worker, image);
      if (text) parts.push(text);
    } catch (error) {
      console.warn(`OCR page ${page} failed`, error);
    }
  }

  return parts.join("\n\n").trim();
}

export async function runOcr(params: {
  buffer: Buffer;
  mimeType: string;
  fallbackTitle: string;
}): Promise<OcrResult> {
  let text = "";
  let worker: Worker | undefined;

  const ensureWorker = async () => {
    worker ??= await createWorker("fra+eng");
    return worker;
  };

  try {
    if (isWordMime(params.mimeType)) {
      try {
        text = await officeFileToText(params.buffer, params.mimeType);
      } catch (error) {
        console.warn("Word text extraction failed", error);
      }
    } else if (params.mimeType === "application/pdf") {
      try {
        const extracted = await extractPdfText(params.buffer);
        text = extracted.text;
        if (text.length < MIN_NATIVE_TEXT) {
          text = (await ocrPdfPages(params.buffer, extracted.totalPages, await ensureWorker())) || text;
        }
      } catch (error) {
        console.warn("PDF extraction failed, trying page OCR", error);
        try {
          text = await ocrPdfPages(params.buffer, MAX_OCR_PAGES, await ensureWorker());
        } catch (ocrError) {
          console.warn("PDF page OCR failed", ocrError);
        }
      }
    } else {
      text = await ocrImage(await ensureWorker(), params.buffer);
    }
  } finally {
    await worker?.terminate();
  }

  return {
    text,
    title: suggestTitle(text, params.fallbackTitle),
    detectedDate: detectDocumentDate(text),
    tags: suggestTags(text),
  };
}
