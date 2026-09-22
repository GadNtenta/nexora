import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionFromRequest } from "@/lib/http";
import { can, canAccessFolder } from "@/lib/auth/rbac";
import { loadFolderGraph } from "@/lib/data";
import { objectKey, putObject } from "@/lib/storage/minio";
import { writeAuditLog } from "@/lib/audit/log";
import { scheduleOcr } from "@/lib/ocr/schedule";
import { MAX_UPLOAD_BYTES } from "@/lib/utils";
import { resolveUploadMime } from "@/lib/documents/mime";
import { nextVersion } from "@/lib/documents/version";

export const runtime = "nodejs";

function storageUnavailableMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
  if (code === "ECONNREFUSED" || (error instanceof AggregateError)) {
    return "Stockage MinIO injoignable (localhost:9000). Démarrez MinIO puis réessayez.";
  }
  return error instanceof Error ? error.message : "Échec de l'upload";
}

export async function POST(request: NextRequest) {
  try {
    return await handleUpload(request);
  } catch (error) {
    console.error("upload failed", error);
    return NextResponse.json({ error: storageUnavailableMessage(error) }, { status: 503 });
  }
}

async function handleUpload(request: NextRequest) {
  const session = await sessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const folderId = String(form.get("folderId") ?? "");
  const replaceDocumentId = String(form.get("documentId") ?? "");

  if (!files.length) {
    return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  }

  if (!["EDITEUR", "ADMIN_ESPACE", "SUPER_ADMIN"].includes(session.role) && !replaceDocumentId) {
    return NextResponse.json({ error: "Dépôt réservé aux éditeurs et administrateurs" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.departmentId) {
    return NextResponse.json({ error: "Aucun département associé" }, { status: 400 });
  }

  const folders = await loadFolderGraph(session.tenantId);
  const created: { id: string; title: string }[] = [];

  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `${file.name} dépasse 50 Mo` }, { status: 400 });
    }
    const mime = resolveUploadMime({ name: file.name, type: file.type });
    if (!mime) {
      return NextResponse.json({ error: `Type non autorisé : ${file.name}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(buffer).digest("hex");
    const uuid = randomUUID();
    const key = objectKey(session.tenantId, uuid, file.name);
    await putObject(key, buffer, mime, file.size);

    if (replaceDocumentId) {
      const existing = await prisma.document.findFirst({
        where: { id: replaceDocumentId, tenantId: session.tenantId },
        include: { permissions: true, versions: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (!existing) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
      if (!can({ session, action: "UPDATE", document: existing, folders })) {
        return NextResponse.json({ error: "Interdit" }, { status: 403 });
      }
      const latest = existing.versions[0]?.version ?? "v1.0";
      const bumped = nextVersion(latest);

      await prisma.$transaction([
        prisma.documentVersion.create({
          data: {
            version: bumped,
            fileUrl: key,
            fileHash: hash,
            fileSize: file.size,
            mimeType: mime,
            documentId: existing.id,
            createdById: session.userId,
          },
        }),
        prisma.document.update({
          where: { id: existing.id },
          data: {
            title: file.name.replace(/\.[^.]+$/, ""),
            fileUrl: key,
            fileHash: hash,
            fileSize: file.size,
            mimeType: mime,
          },
        }),
      ]);

      await scheduleOcr(existing.id);
      await writeAuditLog({ session, action: "UPDATE", documentId: existing.id });
      created.push({ id: existing.id, title: existing.title });
      continue;
    }

    let targetFolderId = folderId;
    if (!targetFolderId) {
      const root = await prisma.folder.findFirst({
        where: { tenantId: session.tenantId, parentId: null },
        orderBy: { createdAt: "asc" },
      });
      if (!root) return NextResponse.json({ error: "Aucun dossier racine" }, { status: 400 });
      targetFolderId = root.id;
    }

    const folder = await prisma.folder.findFirst({
      where: { id: targetFolderId, tenantId: session.tenantId },
    });
    if (!folder) return NextResponse.json({ error: "Dossier introuvable" }, { status: 400 });
    if (!canAccessFolder({ session, folderId: folder.id, folders, action: "UPDATE" })) {
      return NextResponse.json({ error: "Accès au dossier refusé" }, { status: 403 });
    }

    const departmentId = folder.departmentId ?? user.departmentId;
    if (!departmentId) {
      return NextResponse.json({ error: "Associez un département à l'utilisateur ou au dossier" }, { status: 400 });
    }

    const document = await prisma.document.create({
      data: {
        title: file.name.replace(/\.[^.]+$/, ""),
        fileUrl: key,
        fileHash: hash,
        mimeType: mime,
        fileSize: file.size,
        ownerId: session.userId,
        departmentId,
        folderId: targetFolderId,
        tenantId: session.tenantId,
        versions: {
          create: {
            version: "v1.0",
            fileUrl: key,
            fileHash: hash,
            fileSize: file.size,
            mimeType: mime,
            createdById: session.userId,
          },
        },
      },
      include: { permissions: true },
    });

    await scheduleOcr(document.id);
    await writeAuditLog({ session, action: "CREATE", documentId: document.id });
    created.push({ id: document.id, title: document.title });
  }

  return NextResponse.json({ ok: true, documents: created });
}
