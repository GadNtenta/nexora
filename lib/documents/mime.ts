export const PDF_MIME = "application/pdf";
export const PNG_MIME = "image/png";
export const JPEG_MIME = "image/jpeg";
export const DOC_MIME = "application/msword";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ALLOWED_MIME_TYPES = [
  PDF_MIME,
  PNG_MIME,
  JPEG_MIME,
  "image/jpg",
  DOC_MIME,
  DOCX_MIME,
] as const;

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIME_TYPES);

const EXT_TO_MIME: Record<string, string> = {
  pdf: PDF_MIME,
  png: PNG_MIME,
  jpg: JPEG_MIME,
  jpeg: JPEG_MIME,
  doc: DOC_MIME,
  docx: DOCX_MIME,
};

const MIME_TO_EXT: Record<string, string> = {
  [PDF_MIME]: "pdf",
  [PNG_MIME]: "png",
  [JPEG_MIME]: "jpeg",
  "image/jpg": "jpeg",
  [DOC_MIME]: "doc",
  [DOCX_MIME]: "docx",
};

const BLOCKED_EXTENSIONS = new Set(["docm", "dotm", "dot", "dotx"]);

export const UPLOAD_ACCEPT = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".doc",
  ".docx",
  PDF_MIME,
  PNG_MIME,
  JPEG_MIME,
  DOC_MIME,
  DOCX_MIME,
].join(",");

export const UPLOAD_TYPES_LABEL = "PDF, Word (.doc, .docx), PNG ou JPEG";

export function fileExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  if (index < 0) return "";
  return filename.slice(index + 1).toLowerCase();
}

export function resolveUploadMime(file: { name: string; type: string }): string | null {
  const ext = fileExtension(file.name);
  if (BLOCKED_EXTENSIONS.has(ext)) return null;

  const fromExt = EXT_TO_MIME[ext];
  if (fromExt) return fromExt;

  const type = file.type === "image/jpg" ? JPEG_MIME : file.type;
  if (type && ALLOWED_MIME_SET.has(type)) return type;
  return null;
}

export function isWordMime(mimeType: string): boolean {
  return mimeType === DOC_MIME || mimeType === DOCX_MIME;
}

export function isPdfMime(mimeType: string): boolean {
  return mimeType === PDF_MIME;
}

export function documentTypeLabel(mimeType: string): string {
  if (isWordMime(mimeType)) return "Word";
  if (isPdfMime(mimeType)) return "PDF";
  if (mimeType.startsWith("image/")) return "Image";
  return "Fichier";
}

export function isLegacyWordMime(mimeType: string): boolean {
  return mimeType === DOC_MIME;
}

export function extensionForMime(mimeType: string): string | undefined {
  return MIME_TO_EXT[mimeType];
}

export function downloadFilename(title: string, mimeType: string): string {
  const ext = extensionForMime(mimeType);
  const safe = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || "document";
  if (!ext) return safe;
  if (safe.toLowerCase().endsWith(`.${ext}`)) return safe;
  return `${safe}.${ext}`;
}
