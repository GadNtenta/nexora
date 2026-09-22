import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Folder, Search } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { searchDocuments } from "@/lib/search/fts";
import { can } from "@/lib/auth/rbac";
import { loadFolderGraph, getDocumentForAuth } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { FilterBar } from "@/components/documents/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileTypeIcon } from "@/components/documents/file-type-icon";
import { BackLink } from "@/components/layout/back-link";
import { DOC_STATUS_LABEL, formatDate, statusVariant } from "@/lib/utils";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const q = sp.q ?? "";
  const authors = await prisma.user.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, fullName: true },
  });
  const departments = await prisma.department.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, name: true },
  });
  const folders = await loadFolderGraph(session.tenantId);
  const hasFilters = Boolean(sp.author || sp.department || sp.status || sp.sensitivity || sp.from || sp.to);

  const hits =
    q.trim().length >= 2
      ? await searchDocuments({
          tenantId: session.tenantId,
          query: q,
          authorId: sp.author,
          departmentId: sp.department,
          status: sp.status,
          sensitivity: sp.sensitivity,
          from: sp.from ? new Date(sp.from) : undefined,
          to: sp.to ? new Date(`${sp.to}T23:59:59.000Z`) : undefined,
          limit: 50,
        })
      : [];

  const visible = [];
  for (const hit of hits) {
    const document = await getDocumentForAuth(hit.id, session.tenantId);
    if (document && can({ session, action: "VIEW", document, folders })) visible.push(hit);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink href="/documents" label="Documents" />

      <header className="overflow-hidden rounded-2xl border bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <Search className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Recherche plein texte</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Titre, tags et contenu indexé (OCR / Word). Extraits surlignés, aussi disponible via ⌘K.
            </p>
          </div>
        </div>

        <form className="mt-5 flex flex-col gap-2 sm:flex-row">
          {(["author", "department", "status", "sensitivity", "from", "to"] as const).map((key) =>
            sp[key] ? <input key={key} type="hidden" name={key} value={sp[key]} /> : null,
          )}
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Requête</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Rechercher un titre, un tag ou un passage du document"
              className="pl-9"
            />
          </label>
          <Button type="submit">Rechercher</Button>
        </form>
      </header>

      <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-muted" />}>
        <FilterBar
          authors={authors.map((a) => ({ id: a.id, name: a.fullName }))}
          departments={departments}
        />
      </Suspense>

      {q.trim().length < 2 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-10 text-center">
          <p className="text-sm font-medium">Saisissez au moins deux caractères</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ou ouvrez la recherche universelle avec{" "}
            <kbd className="rounded border bg-background px-1.5 py-0.5 text-xs">⌘K</kbd>
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-10 text-center">
          <p className="text-sm font-medium">Aucun résultat pour « {q} »</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Essayez un autre mot, ou élargissez les filtres.
            {hasFilters ? (
              <>
                {" "}
                <Link href={`/search?q=${encodeURIComponent(q)}`} className="underline">
                  Réinitialiser les filtres
                </Link>
              </>
            ) : null}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {visible.length} résultat{visible.length > 1 ? "s" : ""} pour « {q} »
          </p>
          <ul className="space-y-3">
            {visible.map((hit) => (
              <li key={hit.id}>
                <article className="rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20">
                  <div className="flex items-start gap-3">
                    <FileTypeIcon mimeType={hit.mimeType} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/documents/${hit.id}`} className="font-semibold hover:underline">
                          {hit.title}
                        </Link>
                        <Badge variant={statusVariant(hit.status)}>{DOC_STATUS_LABEL[hit.status] ?? hit.status}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <Link href={`/folders/${hit.folderId}`} className="inline-flex items-center gap-1 hover:underline">
                          <Folder className="h-3 w-3" />
                          {hit.folderName}
                        </Link>
                        <span>{formatDate(hit.createdAt)}</span>
                      </div>
                      <p
                        className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: hit.snippet }}
                      />
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
