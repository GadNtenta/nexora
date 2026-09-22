import { prisma } from "@/lib/prisma";
import type { FolderNode } from "@/lib/auth/rbac";
import { Role } from "@prisma/client";

export async function loadFolderGraph(tenantId: string): Promise<FolderNode[]> {
  const folders = await prisma.folder.findMany({
    where: { tenantId },
    include: { permissions: true },
  });
  return folders.map((folder) => ({
    id: folder.id,
    parentId: folder.parentId,
    departmentId: folder.departmentId ?? null,
    minViewRole: folder.minViewRole ?? Role.LECTEUR,
    permissions: folder.permissions,
  }));
}

export async function getDocumentForAuth(id: string, tenantId: string) {
  return prisma.document.findFirst({
    where: { id, tenantId },
    include: { permissions: true },
  });
}

export function parseOptionalDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
