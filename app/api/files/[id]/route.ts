import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionFromRequest } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { loadFolderGraph } from "@/lib/data";
import { getObjectBuffer } from "@/lib/storage/minio";
import { writeAuditLog } from "@/lib/audit/log";
import { downloadFilename } from "@/lib/documents/mime";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await context.params;
  const versionId = request.nextUrl.searchParams.get("versionId");
  const download = request.nextUrl.searchParams.get("download") === "1";

  const document = await prisma.document.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { permissions: true, versions: true },
  });
  if (!document) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const folders = await loadFolderGraph(session.tenantId);
  if (!can({ session, action: download ? "DOWNLOAD" : "VIEW", document, folders })) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const version = versionId ? document.versions.find((v) => v.id === versionId) : null;
  const key = version?.fileUrl ?? document.fileUrl;
  const mime = version?.mimeType ?? document.mimeType;
  const buffer = await getObjectBuffer(key);

  await writeAuditLog({
    session,
    action: download ? "DOWNLOAD" : "VIEW",
    documentId: document.id,
  });

  const filename = downloadFilename(document.title, mime);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": download
        ? `attachment; filename="${encodeURIComponent(filename)}"`
        : "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
