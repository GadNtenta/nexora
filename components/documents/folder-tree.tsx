import Link from "next/link";
import { FolderForm } from "@/components/documents/folder-form";
import { cn } from "@/lib/utils";

export type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
};

export function FolderTree({
  folders,
  currentId,
  canCreate,
  departments,
}: {
  folders: FolderItem[];
  currentId?: string;
  canCreate: boolean;
  departments: { id: string; name: string }[];
}) {
  const roots = folders.filter((f) => !f.parentId);

  function render(parentId: string | null, depth = 0) {
    return folders
      .filter((f) => f.parentId === parentId)
      .map((folder) => (
        <div key={folder.id} style={{ paddingLeft: depth * 12 }}>
          <Link
            href={`/folders/${folder.id}`}
            className={cn(
              "flex min-h-11 flex-col justify-center rounded-md px-2 text-sm hover:bg-accent",
              currentId === folder.id && "bg-accent font-medium",
            )}
          >
            <span>{folder.name}</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {folder.departmentName ?? "Commun"}
            </span>
          </Link>
          {render(folder.id, depth + 1)}
        </div>
      ));
  }

  return (
    <div className="rounded-xl border bg-card p-3 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Dossiers</p>
        <Link href="/documents" className="text-xs text-muted-foreground hover:underline">
          Tous
        </Link>
      </div>
      {roots.length === 0 ? <p className="text-sm text-muted-foreground">Aucun dossier.</p> : render(null)}
      {canCreate ? (
        <div className="mt-3">
          <FolderForm
            mode="create"
            parentId={currentId ?? roots[0]?.id ?? null}
            departments={departments}
            defaultDepartmentId={
              currentId ? folders.find((f) => f.id === currentId)?.departmentId ?? "common" : "common"
            }
          />
        </div>
      ) : null}
    </div>
  );
}
