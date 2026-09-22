import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildPrefixTsQuery, sanitizeLikeContains } from "@/lib/search/query";

export type SearchHit = {
  id: string;
  title: string;
  folderId: string;
  folderName: string;
  snippet: string;
  status: string;
  mimeType: string;
  createdAt: Date;
};

export async function searchDocuments(params: {
  tenantId: string;
  query: string;
  limit?: number;
  authorId?: string;
  from?: Date;
  to?: Date;
  status?: string;
  departmentId?: string;
  sensitivity?: string;
}): Promise<SearchHit[]> {
  const q = params.query.trim();
  if (!q) return [];

  const ts = buildPrefixTsQuery(q);
  const like = sanitizeLikeContains(q);

  const conditions: Prisma.Sql[] = [Prisma.sql`d."tenantId" = ${params.tenantId}`];

  const tagMatch = Prisma.sql`EXISTS (
    SELECT 1
    FROM "_DocumentTags" j
    INNER JOIN "Tag" t ON t.id = j."B"
    WHERE j."A" = d.id AND t.name ILIKE ${like}
  )`;

  if (ts) {
    conditions.push(
      Prisma.sql`(
        d."contentVector" @@ to_tsquery('french_unaccent', ${ts})
        OR d.title ILIKE ${like}
        OR ${tagMatch}
      )`,
    );
  } else {
    conditions.push(Prisma.sql`(d.title ILIKE ${like} OR ${tagMatch})`);
  }

  if (params.authorId) conditions.push(Prisma.sql`d."ownerId" = ${params.authorId}`);
  if (params.departmentId) conditions.push(Prisma.sql`d."departmentId" = ${params.departmentId}`);
  if (params.status) conditions.push(Prisma.sql`d.status = ${params.status}::"DocStatus"`);
  if (params.sensitivity) {
    conditions.push(Prisma.sql`d.sensitivity = ${params.sensitivity}::"Sensitivity"`);
  }
  if (params.from) conditions.push(Prisma.sql`d."createdAt" >= ${params.from}`);
  if (params.to) conditions.push(Prisma.sql`d."createdAt" <= ${params.to}`);

  const where = Prisma.join(conditions, " AND ");
  const limit = params.limit ?? 20;
  const snippetSql = ts
    ? Prisma.sql`ts_headline(
        'french',
        coalesce(nullif(d."extractedText", ''), d.title),
        to_tsquery('french_unaccent', ${ts}),
        'MaxFragments=2, MaxWords=24, MinWords=8, StartSel=<mark>, StopSel=</mark>'
      )`
    : Prisma.sql`left(coalesce(nullif(d."extractedText", ''), d.title), 160)`;

  const rankSql = ts
    ? Prisma.sql`ts_rank_cd(d."contentVector", to_tsquery('french_unaccent', ${ts})) DESC`
    : Prisma.sql`d."createdAt" DESC`;

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        folderId: string;
        folderName: string;
        snippet: string;
        status: string;
        mimeType: string;
        createdAt: Date;
      }>
    >(Prisma.sql`
    SELECT
      d.id,
      d.title,
      f.id AS "folderId",
      f.name AS "folderName",
      ${snippetSql} AS snippet,
      d.status::text AS status,
      d."mimeType",
      d."createdAt"
    FROM "Document" d
    JOIN "Folder" f ON f.id = d."folderId"
    WHERE ${where}
    ORDER BY
      CASE WHEN d.title ILIKE ${like} THEN 0 ELSE 1 END,
      ${rankSql}
    LIMIT ${limit}
  `);

    return rows.map((row) => ({
      ...row,
      snippet: row.snippet || row.title,
    }));
  } catch (error) {
    console.error("searchDocuments failed", error);
    return [];
  }
}

export async function listDocumentsFiltered(params: {
  tenantId: string;
  folderId?: string;
  authorId?: string;
  from?: Date;
  to?: Date;
  status?: string;
  departmentId?: string;
  sensitivity?: string;
}) {
  return prisma.document.findMany({
    where: {
      tenantId: params.tenantId,
      folderId: params.folderId,
      ownerId: params.authorId,
      departmentId: params.departmentId,
      status: params.status as never,
      sensitivity: params.sensitivity as never,
      createdAt: {
        gte: params.from,
        lte: params.to,
      },
    },
    include: {
      owner: { select: { id: true, fullName: true, email: true } },
      department: { select: { id: true, name: true } },
      folder: { select: { id: true, name: true } },
      tags: true,
      ocrJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
}
