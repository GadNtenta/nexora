import { prisma } from "@/lib/prisma";

export async function mergeDocumentTags(params: {
  tenantId: string;
  names: string[];
  existingIds?: string[];
}) {
  const records: { id: string }[] = [];
  for (const name of params.names) {
    const tag = await prisma.tag.upsert({
      where: { tenantId_name: { tenantId: params.tenantId, name } },
      update: {},
      create: { tenantId: params.tenantId, name },
    });
    records.push({ id: tag.id });
  }
  const merged = new Map((params.existingIds ?? []).map((id) => [id, { id }]));
  for (const tag of records) merged.set(tag.id, tag);
  return [...merged.values()];
}
