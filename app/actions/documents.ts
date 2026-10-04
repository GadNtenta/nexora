"use server";

import { revalidatePath } from "next/cache";
import { DocStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { assertCan, can } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/audit/log";
import { loadFolderGraph, getDocumentForAuth } from "@/lib/data";
import { copyObject, getObjectBuffer, objectKey } from "@/lib/storage/minio";
import { notifyUser } from "@/lib/notify";
import { nextVersion } from "@/lib/documents/version";
import { scheduleOcr } from "@/lib/ocr/schedule";
import { commitNewFileVersion } from "@/lib/documents/commit-version";
import { DOCX_MIME, isPdfMime } from "@/lib/documents/mime";
import { suggestTags } from "@/lib/ocr/metadata";
import { mergeDocumentTags } from "@/lib/ocr/tags";

export async function deleteDocumentAction(documentId: string) {
  const session = await requireSession();
  const document = await getDocumentForAuth(documentId, session.tenantId);
  if (!document) throw new Error("Document introuvable");
  const folders = await loadFolderGraph(session.tenantId);
  assertCan({ session, action: "DELETE", document, folders });

  await prisma.document.delete({ where: { id: documentId } });
  await writeAuditLog({ session, action: "DELETE", documentId });
  revalidatePath("/documents");
}

export async function updateDocumentMetaAction(formData: FormData) {
  const session = await requireSession();
  const documentId = String(formData.get("documentId"));
  const document = await getDocumentForAuth(documentId, session.tenantId);
  if (!document) throw new Error("Document introuvable");
  const folders = await loadFolderGraph(session.tenantId);
  assertCan({ session, action: "UPDATE", document, folders });

  const title = String(formData.get("title") ?? "").trim();
  const sensitivity = String(formData.get("sensitivity") ?? document.sensitivity);
  if (!title) throw new Error("Titre requis");

  await prisma.document.update({
    where: { id: documentId },
    data: { title, sensitivity: sensitivity as never },
  });
  await writeAuditLog({ session, action: "UPDATE", documentId });
  revalidatePath(`/documents/${documentId}`);
}

export async function reindexOcrAction(documentId: string) {
  const session = await requireSession();
  const document = await getDocumentForAuth(documentId, session.tenantId);
  if (!document) throw new Error("Document introuvable");
  const folders = await loadFolderGraph(session.tenantId);
  assertCan({ session, action: "UPDATE", document, folders });
  await scheduleOcr(documentId);
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/documents");
  revalidatePath("/search");
}

export async function convertPdfToWordAction(documentId: string) {
  const session = await requireSession();
  const document = await prisma.document.findFirst({
    where: { id: documentId, tenantId: session.tenantId },
    include: {
      permissions: true,
      tags: true,
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!document) throw new Error("Document introuvable");
  const folders = await loadFolderGraph(session.tenantId);
  assertCan({ session, action: "UPDATE", document, folders });
  if (document.status === DocStatus.EN_REVISION) {
    throw new Error("Édition bloquée pendant la revue.");
  }
  if (!isPdfMime(document.mimeType)) {
    throw new Error("Seuls les PDF peuvent être convertis en Word.");
  }

  const pdf = await getObjectBuffer(document.fileUrl);
  const { convertPdfToDocx } = await import("@/lib/documents/pdf-to-docx");
  const converted = await convertPdfToDocx(pdf, {
    title: document.title,
    fallbackText: document.extractedText,
  });
  const tags = await mergeDocumentTags({
    tenantId: document.tenantId,
    names: converted.text ? suggestTags(converted.text) : [],
    existingIds: document.tags.map((tag) => tag.id),
  });
  const { version } = await commitNewFileVersion({
    documentId: document.id,
    tenantId: document.tenantId,
    userId: session.userId,
    title: document.title,
    buffer: converted.buffer,
    mimeType: DOCX_MIME,
    filename: `${document.title}.docx`,
    extractedText: converted.text || document.extractedText,
    tagIds: tags,
    currentVersion: document.versions[0]?.version ?? "v1.0",
  });

  await writeAuditLog({ session, action: "CONVERT", documentId: document.id });
  revalidatePath(`/documents/${document.id}`);
  revalidatePath("/documents");
  revalidatePath("/search");
  return { version };
}

export async function restoreVersionAction(documentId: string, versionId: string) {
  const session = await requireSession();
  if (session.role !== Role.ADMIN_ESPACE && session.role !== Role.SUPER_ADMIN) {
    throw new Error("FORBIDDEN");
  }
  const document = await prisma.document.findFirst({
    where: { id: documentId, tenantId: session.tenantId },
    include: { versions: { orderBy: { createdAt: "desc" } } },
  });
  if (!document) throw new Error("Document introuvable");
  const version = document.versions.find((v) => v.id === versionId);
  if (!version) throw new Error("Version introuvable");

  const latest = document.versions[0]?.version ?? "v1.0";
  const bumped = nextVersion(latest);
  const newKey = objectKey(session.tenantId, crypto.randomUUID());
  await copyObject(version.fileUrl, newKey);

  await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        version: bumped,
        fileUrl: newKey,
        fileHash: version.fileHash,
        fileSize: version.fileSize,
        mimeType: version.mimeType,
        documentId,
        createdById: session.userId,
      },
    }),
    prisma.document.update({
      where: { id: documentId },
      data: {
        fileUrl: newKey,
        fileHash: version.fileHash,
        fileSize: version.fileSize,
        mimeType: version.mimeType,
      },
    }),
  ]);

  await writeAuditLog({ session, action: "RESTORE", documentId });
  await scheduleOcr(documentId);
  revalidatePath(`/documents/${documentId}`);
}

export async function submitValidationAction(formData: FormData) {
  const session = await requireSession();
  const documentId = String(formData.get("documentId"));
  const assigneeId = String(formData.get("assigneeId"));
  const document = await getDocumentForAuth(documentId, session.tenantId);
  if (!document) throw new Error("Document introuvable");
  const folders = await loadFolderGraph(session.tenantId);
  if (!can({ session, action: "UPDATE", document, folders }) && !can({ session, action: "ADMIN", document, folders })) {
    throw new Error("FORBIDDEN");
  }
  if (document.status === DocStatus.EN_REVISION) {
    throw new Error("Document déjà en révision");
  }

  const assignee = await prisma.user.findFirst({
    where: { id: assigneeId, tenantId: session.tenantId },
  });
  if (!assignee) throw new Error("Validateur introuvable");

  await prisma.$transaction([
    prisma.document.update({
      where: { id: documentId },
      data: { status: DocStatus.EN_REVISION },
    }),
    prisma.validationRequest.create({
      data: {
        documentId,
        requesterId: session.userId,
        assigneeId,
      },
    }),
  ]);

  await notifyUser({
    userId: assignee.id,
    email: assignee.email,
    title: "Document à valider",
    body: `${session.fullName} a soumis « ${document.title} » pour validation.`,
    href: `/documents/${documentId}`,
  });
  await writeAuditLog({ session, action: "SUBMIT", documentId });
  revalidatePath(`/documents/${documentId}`);
}

export async function decideValidationAction(formData: FormData) {
  const session = await requireSession();
  const requestId = String(formData.get("requestId"));
  const decision = String(formData.get("decision"));
  const comment = String(formData.get("comment") ?? "").trim();

  const request = await prisma.validationRequest.findFirst({
    where: { id: requestId },
    include: { document: { include: { permissions: true } } },
  });
  if (!request || request.document.tenantId !== session.tenantId) {
    throw new Error("Demande introuvable");
  }
  const folders = await loadFolderGraph(session.tenantId);
  assertCan({ session, action: "VALIDATE", document: request.document, folders });

  if (request.assigneeId !== session.userId && session.role !== Role.ADMIN_ESPACE && session.role !== Role.SUPER_ADMIN) {
    throw new Error("FORBIDDEN");
  }

  if (decision === "REJECTED" && comment.length < 3) {
    throw new Error("Un commentaire est obligatoire en cas de rejet.");
  }

  const approved = decision === "APPROVED";
  await prisma.$transaction([
    prisma.validationRequest.update({
      where: { id: requestId },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        comment: comment || null,
        decidedAt: new Date(),
      },
    }),
    prisma.document.update({
      where: { id: request.documentId },
      data: { status: approved ? DocStatus.VALIDE : DocStatus.REJETE },
    }),
  ]);

  await notifyUser({
    userId: request.requesterId,
    title: approved ? "Document validé" : "Document rejeté",
    body: approved
      ? `« ${request.document.title} » a été validé.`
      : `« ${request.document.title} » a été rejeté : ${comment}`,
    href: `/documents/${request.documentId}`,
  });
  await writeAuditLog({ session, action: "VALIDATE", documentId: request.documentId });
  revalidatePath(`/documents/${request.documentId}`);
}

export async function createFolderAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== Role.EDITEUR && session.role !== Role.ADMIN_ESPACE && session.role !== Role.SUPER_ADMIN) {
    throw new Error("FORBIDDEN");
  }
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;
  const departmentRaw = String(formData.get("departmentId") ?? "");
  const minViewRole = (String(formData.get("minViewRole") ?? "LECTEUR") || "LECTEUR") as Role;
  if (!name) throw new Error("Nom de dossier requis");

  const departmentId: string | null = departmentRaw && departmentRaw !== "common" ? departmentRaw : null;
  if (session.role === Role.EDITEUR) {
    if (departmentId && departmentId !== session.departmentId) {
      throw new Error("Un éditeur ne peut créer un dossier que dans son département ou en commun.");
    }
  }

  await prisma.folder.create({
    data: {
      name,
      parentId,
      tenantId: session.tenantId,
      departmentId,
      minViewRole,
    },
  });
  revalidatePath("/documents");
  if (parentId) revalidatePath(`/folders/${parentId}`);
}

export async function updateFolderAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== Role.ADMIN_ESPACE && session.role !== Role.SUPER_ADMIN) {
    throw new Error("FORBIDDEN");
  }
  const id = String(formData.get("folderId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const departmentRaw = String(formData.get("departmentId") ?? "");
  const minViewRole = (String(formData.get("minViewRole") ?? "LECTEUR") || "LECTEUR") as Role;
  if (!id || !name) throw new Error("Dossier invalide");

  const folder = await prisma.folder.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!folder) throw new Error("Dossier introuvable");

  await prisma.folder.update({
    where: { id },
    data: {
      name,
      departmentId: departmentRaw && departmentRaw !== "common" ? departmentRaw : null,
      minViewRole,
    },
  });
  revalidatePath("/documents");
  revalidatePath(`/folders/${id}`);
}

export async function deleteFolderAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== Role.ADMIN_ESPACE && session.role !== Role.SUPER_ADMIN) {
    throw new Error("FORBIDDEN");
  }
  const id = String(formData.get("folderId") ?? "");
  const folder = await prisma.folder.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!folder) throw new Error("Dossier introuvable");

  async function wipe(folderId: string) {
    const children = await prisma.folder.findMany({
      where: { parentId: folderId, tenantId: session.tenantId },
      select: { id: true },
    });
    for (const child of children) await wipe(child.id);
    await prisma.document.deleteMany({ where: { folderId, tenantId: session.tenantId } });
    await prisma.folder.delete({ where: { id: folderId } });
  }

  await wipe(id);
  revalidatePath("/documents");
}

export async function markNotificationsReadAction() {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: session.userId, read: false },
    data: { read: true },
  });
  revalidatePath("/documents");
}
