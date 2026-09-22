import { extractText, getDocumentProxy } from "unpdf";
import { htmlToPlainText, officeFileToHtml, textToOfficeHtml } from "@/lib/documents/office";
import { isPdfMime, isWordMime } from "@/lib/documents/mime";

export type ContentKind = "word" | "pdf" | "image" | "binary";

export type ExtractedContent = {
  text: string;
  html: string | null;
  kind: ContentKind;
};

export async function extractVersionContent(buffer: Buffer, mimeType: string): Promise<ExtractedContent> {
  if (isWordMime(mimeType)) {
    const html = await officeFileToHtml(buffer, mimeType);
    return { text: htmlToPlainText(html), html, kind: "word" };
  }

  if (isPdfMime(mimeType)) {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(pdf, { mergePages: true });
      const text = result.text.trim();
      return { text, html: text ? textToOfficeHtml(text) : null, kind: "pdf" };
    } catch (error) {
      console.warn("PDF text extract for version failed", error);
      return { text: "", html: null, kind: "pdf" };
    }
  }

  if (mimeType.startsWith("image/")) {
    return { text: "", html: null, kind: "image" };
  }

  return { text: "", html: null, kind: "binary" };
}
