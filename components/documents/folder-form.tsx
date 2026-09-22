import { createFolderAction, updateFolderAction } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_VIEW_ROLE_OPTIONS } from "@/lib/utils";

type Dept = { id: string; name: string };

export function FolderForm({
  mode,
  folderId,
  parentId,
  defaultName,
  defaultDepartmentId,
  defaultMinViewRole,
  departments,
}: {
  mode: "create" | "edit";
  folderId?: string;
  parentId?: string | null;
  defaultName?: string;
  defaultDepartmentId?: string | null;
  defaultMinViewRole?: string;
  departments: Dept[];
}) {
  const action = mode === "edit" ? updateFolderAction : createFolderAction;

  return (
    <form action={action} className="space-y-3 rounded-xl border bg-card p-3">
      {mode === "edit" ? <input type="hidden" name="folderId" value={folderId} /> : null}
      {mode === "create" ? <input type="hidden" name="parentId" value={parentId ?? ""} /> : null}
      <div className="space-y-1">
        <Label htmlFor={`folder-name-${folderId ?? "new"}`}>Nom du dossier</Label>
        <Input
          id={`folder-name-${folderId ?? "new"}`}
          name="name"
          required
          defaultValue={defaultName}
          placeholder="Ex. Contrats 2026"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`folder-dept-${folderId ?? "new"}`}>Appartenance</Label>
        <select
          id={`folder-dept-${folderId ?? "new"}`}
          name="departmentId"
          defaultValue={defaultDepartmentId ?? "common"}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="common">Dossier commun (tous les départements)</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} uniquement
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`folder-vis-${folderId ?? "new"}`}>Qui peut le voir</Label>
        <select
          id={`folder-vis-${folderId ?? "new"}`}
          name="minViewRole"
          defaultValue={defaultMinViewRole ?? "LECTEUR"}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {MIN_VIEW_ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Les administrateurs voient et gèrent toujours tous les dossiers.
        </p>
      </div>
      <Button type="submit" variant={mode === "edit" ? "default" : "secondary"} className="w-full">
        {mode === "edit" ? "Enregistrer le dossier" : "Créer le dossier"}
      </Button>
    </form>
  );
}
