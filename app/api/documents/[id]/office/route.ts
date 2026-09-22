import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sessionFromRequest } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { loadFolderGraph } from "@/lib/data";
import { getObjectBuffer, objectKey, putObject } from "@/lib/storage/minio";
import { writeAuditLog } from "@/lib/audit/log";
import { htmlToDocxBuffer, htmlToPlainText, officeFileToHtml } from "@/lib/documents/office";
import { DOCX_MIME, isWordMime } from "@/lib/documents/mime";
import { nextVersion } from "@/lib/documents/version";
import { suggestTags } from "@/lib/ocr/metadata";
import { mergeDocumentTags } from "@/lib/ocr/tags";

export const runtime = "nodejs";

const saveSchema = z.object({
  html: z.string().max(5_000_000, "Document trop volumineux"),
});

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
  if (!can({ session, action: "VIEW", document, folders })) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  if (!isWordMime(document.mimeType)) {
    return NextResponse.json({ error: "Ce fichier n'est pas un document Word" }, { status: 400 });
  }

  try {
    const buffer = await getObjectBuffer(document.fileUrl);
    const html = await officeFileToHtml(buffer, document.mimeType);
    return NextResponse.json({
      html,
      mimeType: document.mimeType,
      legacy: document.mimeType !== DOCX_MIME,
    });
  } catch (error) {
    console.error("office preview failed", error);
    return NextResponse.json(
      { error: "Impossible de lire ce document Word. Téléchargez-le pour l'ouvrir localement." },
      { status: 422 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await context.params;
  const document = await prisma.document.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { permissions: true, versions: { orderBy: { createdAt: "desc" }, take: 1 }, tags: true },
  });
  if (!document) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const folders = await loadFolderGraph(session.tenantId);
  if (!can({ session, action: "UPDATE", document, folders })) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  if (!isWordMime(document.mimeType)) {
    return NextResponse.json({ error: "Seuls les fichiers Word sont éditables dans l'application" }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Contenu invalide" }, { status: 400 });
  }

  try {
    const buffer = await htmlToDocxBuffer(parsed.data.html, document.title);
    const hash = createHash("sha256").update(buffer).digest("hex");
    const key = objectKey(session.tenantId, randomUUID(), `${document.title}.docx`);
    await putObject(key, buffer, DOCX_MIME, buffer.byteLength);

    const bumped = nextVersion(document.versions[0]?.version ?? "v1.0");
    const extractedText = htmlToPlainText(parsed.data.html) || null;
    const tags = await mergeDocumentTags({
      tenantId: document.tenantId,
      names: extractedText ? suggestTags(extractedText) : [],
      existingIds: document.tags.map((tag) => tag.id),
    });

    await prisma.$transaction([
      prisma.documentVersion.create({
        data: {
          version: bumped,
          fileUrl: key,
          fileHash: hash,
          fileSize: buffer.byteLength,
          mimeType: DOCX_MIME,
          documentId: document.id,
          createdById: session.userId,
        },
      }),
      prisma.document.update({
        where: { id: document.id },
        data: {
          fileUrl: key,
          fileHash: hash,
          fileSize: buffer.byteLength,
          mimeType: DOCX_MIME,
          extractedText,
          tags: tags.length ? { set: tags } : undefined,
        },
      }),
    ]);

    await writeAuditLog({ session, action: "UPDATE", documentId: document.id });
    return NextResponse.json({ ok: true, version: bumped });
  } catch (error) {
    console.error("office save failed", error);
    return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 });
  }
}
