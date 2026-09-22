import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { objectKey, putObject } from "@/lib/storage/minio";
import { nextVersion } from "@/lib/documents/version";

export async function commitNewFileVersion(params: {
  documentId: string;
  tenantId: string;
  userId: string;
  title: string;
  buffer: Buffer;
  mimeType: string;
  filename: string;
  extractedText?: string | null;
  tagIds?: { id: string }[];
  currentVersion: string;
}) {
  const hash = createHash("sha256").update(params.buffer).digest("hex");
  const key = objectKey(params.tenantId, randomUUID(), params.filename);
  await putObject(key, params.buffer, params.mimeType, params.buffer.byteLength);
  const bumped = nextVersion(params.currentVersion);

  await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        version: bumped,
        fileUrl: key,
        fileHash: hash,
        fileSize: params.buffer.byteLength,
        mimeType: params.mimeType,
        documentId: params.documentId,
        createdById: params.userId,
      },
    }),
    prisma.document.update({
      where: { id: params.documentId },
      data: {
        fileUrl: key,
        fileHash: hash,
        fileSize: params.buffer.byteLength,
        mimeType: params.mimeType,
        extractedText: params.extractedText,
        tags: params.tagIds?.length ? { set: params.tagIds } : undefined,
      },
    }),
  ]);

  return { version: bumped, hash };
}
