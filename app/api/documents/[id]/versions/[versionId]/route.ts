import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionFromRequest } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { loadFolderGraph } from "@/lib/data";
import { getObjectBuffer } from "@/lib/storage/minio";
import { extractVersionContent } from "@/lib/documents/content";
import { writeAuditLog } from "@/lib/audit/log";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  const session = await sessionFromRequest(_request);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id, versionId } = await context.params;
  const document = await prisma.document.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      permissions: true,
      versions: { include: { createdBy: { select: { fullName: true } } } },
    },
  });
  if (!document) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const folders = await loadFolderGraph(session.tenantId);
  if (!can({ session, action: "VIEW", document, folders })) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const version = document.versions.find((item) => item.id === versionId);
  if (!version) return NextResponse.json({ error: "Version introuvable" }, { status: 404 });

  try {
    const buffer = await getObjectBuffer(version.fileUrl);
    const content = await extractVersionContent(buffer, version.mimeType);
    await writeAuditLog({ session, action: "VIEW", documentId: document.id });
    return NextResponse.json({
      version: {
        id: version.id,
        version: version.version,
        mimeType: version.mimeType,
        fileSize: version.fileSize,
        fileHash: version.fileHash,
        createdAt: version.createdAt,
        createdBy: version.createdBy.fullName,
      },
      ...content,
    });
  } catch (error) {
    console.error("version preview failed", error);
    return NextResponse.json({ error: "Impossible de lire cette version." }, { status: 422 });
  }
}
