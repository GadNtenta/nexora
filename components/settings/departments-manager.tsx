"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Building2, FileText, Folder, Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { createDepartmentAction, deleteDepartmentAction, updateDepartmentAction } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";

export type DirectoryDepartment = {
  id: string;
  name: string;
  createdAt: string;
  users: number;
  folders: number;
  documents: number;
};

function actionError(error: unknown) {
  const message = error instanceof Error ? error.message : "Action impossible";
  if (message === "FORBIDDEN") return "Action non autorisée.";
  if (message === "Nom requis" || message === "Département invalide") {
    return "Indiquez un nom de département.";
  }
  return message;
}

function isLinked(department: DirectoryDepartment) {
  return department.users + department.folders + department.documents > 0;
}

export function DepartmentsManager({ departments }: { departments: DirectoryDepartment[] }) {
  const [query, setQuery] = useState("");

  const userTotal = departments.reduce((sum, item) => sum + item.users, 0);
  const folderTotal = departments.reduce((sum, item) => sum + item.folders, 0);
  const documentTotal = departments.reduce((sum, item) => sum + item.documents, 0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return departments;
    return departments.filter((item) => item.name.toLowerCase().includes(needle));
  }, [departments, query]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4 lg:col-start-1 lg:row-start-1">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={Building2} label="Départements" value={String(departments.length)} />
          <StatCard icon={Users} label="Personnes rattachées" value={String(userTotal)} />
          <StatCard icon={Folder} label="Dossiers / documents" value={`${folderTotal} / ${documentTotal}`} />
        </div>

        <label className="relative block">
          <span className="sr-only">Rechercher un département</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un département…"
            className="pl-9"
          />
        </label>

        {departments.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            Aucun département. Créez-en un pour classer les dossiers, ou laissez-les en dossier commun.
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            Aucun département ne correspond à la recherche.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((department) => (
              <li key={department.id}>
                <DepartmentCard department={department} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="order-first lg:order-none lg:col-start-2 lg:row-start-1">
        <CreateDepartmentForm />
      </aside>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function DepartmentCard({ department }: { department: DirectoryDepartment }) {
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const linked = isLinked(department);

  return (
    <article className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-sm font-semibold text-primary">
          {department.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold">{department.name}</h2>
            {linked ? <Badge variant="outline">En service</Badge> : <Badge variant="secondary">Vide</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">Créé {formatDate(department.createdAt)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {department.users} personne{department.users > 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Folder className="h-3 w-3" />
              {department.folders} dossier{department.folders > 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              {department.documents} document{department.documents > 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      </div>

      <form
        className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_auto] sm:items-end"
        action={(formData) => {
          start(async () => {
            try {
              await updateDepartmentAction(formData);
              toast.success("Département mis à jour.");
            } catch (error) {
              toast.error(actionError(error));
            }
          });
        }}
      >
        <input type="hidden" name="departmentId" value={department.id} />
        <div className="space-y-1">
          <Label htmlFor={`name-${department.id}`}>Nom</Label>
          <Input id={`name-${department.id}`} name="name" defaultValue={department.name} required />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Enregistrer
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={linked}
            title={
              linked
                ? "Retirez d’abord les utilisateurs, dossiers et documents rattachés."
                : "Supprimer ce département"
            }
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
            Supprimer
          </Button>
        </div>
      </form>
      {linked ? (
        <p className="mt-3 text-xs text-muted-foreground">
          La suppression est bloquée tant que des personnes, dossiers ou documents y sont encore rattachés.
        </p>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer {department.name} ?</DialogTitle>
            <DialogDescription>
              Ce département sera définitivement retiré. Les dossiers communs ne sont pas concernés.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-wrap justify-end gap-2"
            action={(formData) => {
              start(async () => {
                try {
                  await deleteDepartmentAction(formData);
                  toast.success("Département supprimé.");
                  setConfirmOpen(false);
                } catch (error) {
                  toast.error(actionError(error));
                }
              });
            }}
          >
            <input type="hidden" name="departmentId" value={department.id} />
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Supprimer
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function CreateDepartmentForm() {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        start(async () => {
          try {
            await createDepartmentAction(formData);
            toast.success("Département créé.");
            formRef.current?.reset();
          } catch (error) {
            toast.error(actionError(error));
          }
        });
      }}
      className="sticky top-0 space-y-3 rounded-2xl border bg-card p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Plus className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">Nouveau département</h2>
          <p className="text-sm text-muted-foreground">
            Les dossiers peuvent aussi rester communs, sans département.
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="department-name">Nom</Label>
        <Input id="department-name" name="name" required placeholder="Ex. Juridique, RH, Finance" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus />}
        Créer le département
      </Button>
    </form>
  );
}
