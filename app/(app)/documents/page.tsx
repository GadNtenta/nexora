import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { can, filterVisibleFolders, isAdmin } from "@/lib/auth/rbac";
import { loadFolderGraph } from "@/lib/data";
import { FolderTree } from "@/components/documents/folder-tree";
import { UploadModal } from "@/components/documents/upload-modal";
import { FilterBar } from "@/components/documents/filter-bar";
import { Badge } from "@/components/ui/badge";
import { DOC_STATUS_LABEL, OCR_STATUS_LABEL, SENSITIVITY_LABEL, formatBytes, formatDate, statusVariant } from "@/lib/utils";
import type { DocStatus, Sensitivity } from "@prisma/client";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const departments = await prisma.department.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, name: true },
  });
  const folders = await prisma.folder.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
  });
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const folderGraph = await loadFolderGraph(session.tenantId);
  const visibleFolders = filterVisibleFolders(session, folders, folderGraph);
  const authors = await prisma.user.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, fullName: true },
  });

  const documents = await prisma.document.findMany({
    where: {
      tenantId: session.tenantId,
      ownerId: sp.author,
      departmentId: sp.department,
      status: sp.status as DocStatus | undefined,
      sensitivity: sp.sensitivity as Sensitivity | undefined,
      createdAt: {
        gte: sp.from ? new Date(sp.from) : undefined,
        lte: sp.to ? new Date(`${sp.to}T23:59:59.000Z`) : undefined,
      },
    },
    include: {
      owner: true,
      folder: true,
      department: true,
      ocrJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      permissions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const visible = documents.filter((doc) => can({ session, action: "VIEW", document: doc, folders: folderGraph }));
  const canUpload = session.role === "EDITEUR" || session.role === "ADMIN_ESPACE" || session.role === "SUPER_ADMIN";

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <FolderTree
        folders={visibleFolders.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          departmentId: f.departmentId,
          departmentName: f.departmentId ? deptName.get(f.departmentId) ?? null : null,
        }))}
        canCreate={session.role === "EDITEUR" || isAdmin(session.role)}
        departments={departments}
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Documents</h1>
            <p className="text-sm text-muted-foreground">{visible.length} document(s) visible(s)</p>
          </div>
          {canUpload ? <UploadModal /> : null}
        </div>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-muted" />}>
          <FilterBar
            authors={authors.map((a) => ({ id: a.id, name: a.fullName }))}
            departments={departments}
          />
        </Suspense>
        {visible.length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Aucun document. {canUpload ? "Déposez un PDF, un Word ou une image pour lancer l'OCR." : "Aucun fichier n'est encore accessible."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Titre</th>
                  <th className="p-3 font-medium">Dossier</th>
                  <th className="p-3 font-medium">Auteur</th>
                  <th className="p-3 font-medium">Statut</th>
                  <th className="p-3 font-medium">OCR</th>
                  <th className="p-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((doc) => {
                  const ocr = doc.ocrJobs[0]?.status ?? "PENDING";
                  return (
                    <tr key={doc.id} className="border-t hover:bg-muted/40">
                      <td className="p-3">
                        <Link href={`/documents/${doc.id}`} className="font-medium hover:underline">
                          {doc.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {SENSITIVITY_LABEL[doc.sensitivity]} · {formatBytes(doc.fileSize)}
                        </p>
                      </td>
                      <td className="p-3">{doc.folder.name}</td>
                      <td className="p-3">{doc.owner.fullName}</td>
                      <td className="p-3">
                        <Badge variant={statusVariant(doc.status)}>{DOC_STATUS_LABEL[doc.status]}</Badge>
                      </td>
                      <td className="p-3 text-xs">{OCR_STATUS_LABEL[ocr] ?? ocr}</td>
                      <td className="p-3">{formatDate(doc.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
