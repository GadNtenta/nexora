import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { can, canAccessFolder, filterVisibleFolders, isAdmin } from "@/lib/auth/rbac";
import { loadFolderGraph } from "@/lib/data";
import { FolderTree } from "@/components/documents/folder-tree";
import { FolderForm } from "@/components/documents/folder-form";
import { UploadModal } from "@/components/documents/upload-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DOC_STATUS_LABEL, MIN_VIEW_ROLE_OPTIONS, formatDate } from "@/lib/utils";
import { deleteFolderAction } from "@/app/actions/documents";
import Link from "next/link";
import { BackLink } from "@/components/layout/back-link";

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const departments = await prisma.department.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, name: true },
  });
  const folders = await prisma.folder.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
  });
  const deptById = new Map(departments.map((d) => [d.id, d]));
  const folderGraph = await loadFolderGraph(session.tenantId);
  const folder = folders.find((f) => f.id === id);
  if (!folder) redirect("/documents");
  if (!canAccessFolder({ session, folderId: id, folders: folderGraph })) redirect("/documents");
  const folderDepartment = folder.departmentId ? deptById.get(folder.departmentId) : undefined;
  const visibleFolders = filterVisibleFolders(session, folders, folderGraph);
  const documents = await prisma.document.findMany({
    where: { tenantId: session.tenantId, folderId: id },
    include: { owner: true, permissions: true },
    orderBy: { createdAt: "desc" },
  });
  const visible = documents.filter((d) => can({ session, action: "VIEW", document: d, folders: folderGraph }));
  const canUpload = session.role === "EDITEUR" || isAdmin(session.role);
  const visLabel = MIN_VIEW_ROLE_OPTIONS.find((o) => o.value === folder.minViewRole)?.label ?? folder.minViewRole;
  const parent = folder.parentId ? folders.find((item) => item.id === folder.parentId) : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <FolderTree
        folders={visibleFolders.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          departmentId: f.departmentId,
          departmentName: f.departmentId ? deptById.get(f.departmentId)?.name ?? null : null,
        }))}
        currentId={id}
        canCreate={canUpload}
        departments={departments}
      />
      <div className="space-y-4">
        <div className="space-y-2">
          <BackLink
            href={parent ? `/folders/${parent.id}` : "/documents"}
            label={parent ? parent.name : "Documents"}
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Dossier</p>
              <h1 className="text-2xl font-semibold">{folder.name}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{folderDepartment?.name ?? "Dossier commun"}</Badge>
                <Badge variant="secondary">{visLabel}</Badge>
              </div>
            </div>
            {canUpload ? <UploadModal folderId={id} /> : null}
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="rounded-xl border bg-card p-8 text-sm text-muted-foreground">Ce dossier est vide.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {visible.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between p-3">
                <Link href={`/documents/${doc.id}`} className="font-medium hover:underline">
                  {doc.title}
                </Link>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{DOC_STATUS_LABEL[doc.status]}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {isAdmin(session.role) ? (
          <div className="grid gap-3 md:grid-cols-2">
            <FolderForm
              mode="edit"
              folderId={folder.id}
              defaultName={folder.name}
              defaultDepartmentId={folder.departmentId}
              defaultMinViewRole={folder.minViewRole}
              departments={departments}
            />
            <form
              action={deleteFolderAction}
              className="flex flex-col justify-between rounded-xl border bg-card p-3"
            >
              <div>
                <p className="font-medium">Supprimer le dossier</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Supprime aussi les sous-dossiers et documents. Action irréversible.
                </p>
              </div>
              <input type="hidden" name="folderId" value={folder.id} />
              <Button type="submit" variant="destructive" className="mt-4 w-full">
                Supprimer
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
