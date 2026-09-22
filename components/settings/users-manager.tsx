"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Building2, Loader2, Search, ShieldCheck, ShieldOff, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { createUserAction, deleteUserAction, updateUserAction } from "@/app/actions/admin";
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
import { ROLE_LABEL, cn, formatDate } from "@/lib/utils";

export type DirectoryUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  departmentId: string | null;
  departmentName: string | null;
  is2FAEnabled: boolean;
  createdAt: string;
};

const SELECT_CLASS =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function roleVariant(role: string) {
  if (role === "SUPER_ADMIN" || role === "ADMIN_ESPACE") return "default" as const;
  if (role === "VALIDATEUR") return "warning" as const;
  if (role === "EDITEUR") return "outline" as const;
  return "secondary" as const;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? parts[0]?.[1] ?? ""}`;
  return letters.toUpperCase() || "?";
}

function UserAvatar({ name }: { name: string }) {
  return (
    <span
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-sm font-semibold text-primary"
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function actionError(error: unknown) {
  const message = error instanceof Error ? error.message : "Action impossible";
  if (message === "FORBIDDEN") return "Action non autorisée.";
  if (message === "Données utilisateur invalides") return "Vérifiez le nom, l’e-mail et le mot de passe (8 caractères minimum).";
  return message;
}

export function UsersManager({
  users,
  departments,
  roles,
  currentUserId,
}: {
  users: DirectoryUser[];
  departments: { id: string; name: string }[];
  roles: string[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const twoFaCount = users.filter((user) => user.is2FAEnabled).length;
  const noDeptCount = users.filter((user) => !user.departmentId).length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!needle) return true;
      return [user.fullName, user.email, user.departmentName ?? "", ROLE_LABEL[user.role] ?? user.role]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [users, query, roleFilter]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4 lg:col-start-1 lg:row-start-1">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={Users} label="Comptes" value={String(users.length)} />
          <StatCard icon={ShieldCheck} label="2FA actif" value={`${twoFaCount}/${users.length}`} />
          <StatCard icon={Building2} label="Sans département" value={String(noDeptCount)} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Rechercher un utilisateur</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, e-mail, département…"
              className="pl-9"
            />
          </label>
          <select
            aria-label="Filtrer par rôle"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className={cn(SELECT_CLASS, "sm:w-48")}
          >
            <option value="all">Tous les rôles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            Aucun utilisateur ne correspond à la recherche.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((user) => (
              <li key={user.id}>
                <UserCard
                  user={user}
                  departments={departments}
                  roles={roles}
                  isSelf={user.id === currentUserId}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="order-first lg:order-none lg:col-start-2 lg:row-start-1">
        <CreateUserForm departments={departments} roles={roles} />
      </aside>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
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

function UserCard({
  user,
  departments,
  roles,
  isSelf,
}: {
  user: DirectoryUser;
  departments: { id: string; name: string }[];
  roles: string[];
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <article className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <UserAvatar name={user.fullName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold">{user.fullName}</h2>
            {isSelf ? <Badge variant="secondary">Vous</Badge> : null}
            <Badge variant={roleVariant(user.role)}>{ROLE_LABEL[user.role]}</Badge>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {user.is2FAEnabled ? (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                2FA actif
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <ShieldOff className="h-3 w-3" />
                2FA à activer
              </Badge>
            )}
            <Badge variant="outline">{user.departmentName ?? "Sans département"}</Badge>
            <span className="self-center text-xs text-muted-foreground">Créé {formatDate(user.createdAt)}</span>
          </div>
        </div>
      </div>

      <form
        className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2"
        action={(formData) => {
          start(async () => {
            try {
              await updateUserAction(formData);
              toast.success("Compte mis à jour.");
            } catch (error) {
              toast.error(actionError(error));
            }
          });
        }}
      >
        <input type="hidden" name="userId" value={user.id} />
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor={`name-${user.id}`}>Nom</Label>
          <Input id={`name-${user.id}`} name="fullName" defaultValue={user.fullName} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`role-${user.id}`}>Rôle</Label>
          <select id={`role-${user.id}`} name="role" defaultValue={user.role} className={SELECT_CLASS}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`dept-${user.id}`}>Département</Label>
          <select
            id={`dept-${user.id}`}
            name="departmentId"
            defaultValue={user.departmentId ?? ""}
            className={SELECT_CLASS}
          >
            <option value="">Sans département</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor={`password-${user.id}`}>Nouveau mot de passe</Label>
          <Input
            id={`password-${user.id}`}
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="Laisser vide pour ne pas changer"
          />
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Enregistrer
          </Button>
          {!isSelf ? (
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)}>
              <Trash2 />
              Supprimer
            </Button>
          ) : null}
        </div>
      </form>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer {user.fullName} ?</DialogTitle>
            <DialogDescription>
              Le compte {user.email} sera définitivement retiré de l’espace. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-wrap justify-end gap-2"
            action={(formData) => {
              start(async () => {
                try {
                  await deleteUserAction(formData);
                  toast.success("Utilisateur supprimé.");
                  setConfirmOpen(false);
                } catch (error) {
                  toast.error(actionError(error));
                }
              });
            }}
          >
            <input type="hidden" name="userId" value={user.id} />
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

function CreateUserForm({
  departments,
  roles,
}: {
  departments: { id: string; name: string }[];
  roles: string[];
}) {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        start(async () => {
          try {
            await createUserAction(formData);
            toast.success("Utilisateur créé. Il devra activer la 2FA à la première connexion.");
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
          <UserPlus className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">Nouvel utilisateur</h2>
          <p className="text-sm text-muted-foreground">Un mot de passe temporaire, puis 2FA à l’activation.</p>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="fullName">Nom</Label>
        <Input id="fullName" name="fullName" required autoComplete="name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Mot de passe temporaire</Label>
        <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="role">Rôle</Label>
        <select id="role" name="role" className={SELECT_CLASS} defaultValue="LECTEUR">
          {roles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="departmentId">Département</Label>
        <select id="departmentId" name="departmentId" className={SELECT_CLASS}>
          <option value="">Sans département</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
        Créer le compte
      </Button>
    </form>
  );
}
