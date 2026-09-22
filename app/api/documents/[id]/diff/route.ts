import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionFromRequest } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { loadFolderGraph } from "@/lib/data";
import { getObjectBuffer } from "@/lib/storage/minio";
import { extractVersionContent } from "@/lib/documents/content";
import { diffPlainText } from "@/lib/documents/text-diff";
import { writeAuditLog } from "@/lib/audit/log";

export const runtime = "nodejs";

function serializeVersion(version: {
  id: string;
  version: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  createdAt: Date;
  createdBy: { fullName: string };
}) {
  return {
    id: version.id,
    version: version.version,
    mimeType: version.mimeType,
    fileSize: version.fileSize,
    fileHash: version.fileHash,
    createdAt: version.createdAt,
    createdBy: version.createdBy.fullName,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await context.params;
  const fromId = request.nextUrl.searchParams.get("from");
  const toId = request.nextUrl.searchParams.get("to");
  if (!fromId || !toId) {
    return NextResponse.json({ error: "Paramètres from et to requis" }, { status: 400 });
  }
  if (fromId === toId) {
    return NextResponse.json({ error: "Choisissez deux versions différentes" }, { status: 400 });
  }

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

  const fromVersion = document.versions.find((item) => item.id === fromId);
  const toVersion = document.versions.find((item) => item.id === toId);
  if (!fromVersion || !toVersion) {
    return NextResponse.json({ error: "Version introuvable" }, { status: 404 });
  }

  try {
    const [fromBuffer, toBuffer] = await Promise.all([
      getObjectBuffer(fromVersion.fileUrl),
      getObjectBuffer(toVersion.fileUrl),
    ]);
    const [fromContent, toContent] = await Promise.all([
      extractVersionContent(fromBuffer, fromVersion.mimeType),
      extractVersionContent(toBuffer, toVersion.mimeType),
    ]);
    const diff = diffPlainText(fromContent.text, toContent.text);
    await writeAuditLog({ session, action: "VIEW", documentId: document.id });

    return NextResponse.json({
      from: serializeVersion(fromVersion),
      to: serializeVersion(toVersion),
      fromKind: fromContent.kind,
      toKind: toContent.kind,
      hasText: Boolean(fromContent.text || toContent.text),
      hashChanged: fromVersion.fileHash !== toVersion.fileHash,
      mimeChanged: fromVersion.mimeType !== toVersion.mimeType,
      sizeDelta: toVersion.fileSize - fromVersion.fileSize,
      ...diff,
    });
  } catch (error) {
    console.error("version diff failed", error);
    return NextResponse.json({ error: "Comparaison impossible." }, { status: 422 });
  }
}
