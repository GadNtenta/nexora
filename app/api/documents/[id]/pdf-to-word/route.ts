import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionFromRequest } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { loadFolderGraph } from "@/lib/data";
import { getObjectBuffer } from "@/lib/storage/minio";
import { writeAuditLog } from "@/lib/audit/log";
import { convertPdfToDocx } from "@/lib/documents/pdf-to-docx";
import { downloadFilename, isPdfMime } from "@/lib/documents/mime";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await sessionFromRequest(_request);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await context.params;
  const document = await prisma.document.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { permissions: true },
  });
  if (!document) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const folders = await loadFolderGraph(session.tenantId);
  if (!can({ session, action: "DOWNLOAD", document, folders })) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  if (!isPdfMime(document.mimeType)) {
    return NextResponse.json({ error: "Seuls les PDF peuvent être convertis en Word." }, { status: 400 });
  }

  try {
    const pdf = await getObjectBuffer(document.fileUrl);
    const converted = await convertPdfToDocx(pdf, {
      title: document.title,
      fallbackText: document.extractedText,
    });
    await writeAuditLog({ session, action: "CONVERT", documentId: document.id });
    const filename = downloadFilename(document.title, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    return new NextResponse(new Uint8Array(converted.buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("pdf-to-word download failed", error);
    const message = error instanceof Error ? error.message : "Conversion impossible";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
