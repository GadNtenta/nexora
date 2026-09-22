import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Shield } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  AUDIT_ACTION_LABEL,
  AUDIT_ACTIONS,
  auditActionVariant,
  formatDate,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SELECT_CLASS =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN_ESPACE" && session.role !== "SUPER_ADMIN") redirect("/documents");
  const sp = await searchParams;
  const action = sp.action && AUDIT_ACTIONS.includes(sp.action) ? sp.action : undefined;
  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId: session.tenantId,
      action,
      userEmail: sp.email ? { contains: sp.email, mode: "insensitive" } : undefined,
      document: sp.document ? { title: { contains: sp.document, mode: "insensitive" } } : undefined,
    },
    include: { document: { select: { id: true, title: true } }, user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const uniqueUsers = new Set(logs.map((log) => log.userEmail)).size;
  const uniqueDocuments = new Set(logs.map((log) => log.documentId).filter(Boolean)).size;
  const filtered = Boolean(sp.email || action || sp.document);

  const csv = [
    ["created_at", "user_email", "action", "document", "ip_address", "user_agent"].join(","),
    ...logs.map((l) =>
      [l.createdAt.toISOString(), l.userEmail, l.action, l.document?.title ?? "", l.ipAddress, `"${l.userAgent.replace(/"/g, '""')}"`].join(","),
    ),
  ].join("\n");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="overflow-hidden rounded-2xl border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
              <Shield className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Journal d&apos;audit</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Registre immuable : les UPDATE et DELETE sont refusés par PostgreSQL. 200 derniers événements.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download="audit-docushield.csv">
              <Download />
              Exporter CSV
            </a>
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Événements affichés" value={String(logs.length)} />
        <StatCard label="Utilisateurs" value={String(uniqueUsers)} />
        <StatCard label="Documents concernés" value={String(uniqueDocuments)} />
      </div>

      <form className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="space-y-1">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" defaultValue={sp.email ?? ""} placeholder="ex. admin@acme.local" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="document">Document</Label>
          <Input id="document" name="document" defaultValue={sp.document ?? ""} placeholder="Titre du fichier" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="action">Action</Label>
          <select id="action" name="action" defaultValue={action ?? ""} className={SELECT_CLASS}>
            <option value="">Toutes les actions</option>
            {AUDIT_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {AUDIT_ACTION_LABEL[item]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" className="flex-1">
            Filtrer
          </Button>
          {filtered ? (
            <Button asChild variant="ghost">
              <Link href="/audit">Réinitialiser</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {logs.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          {filtered ? "Aucun événement ne correspond aux filtres." : "Aucun événement enregistré pour le moment."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Horodatage UTC</th>
                  <th className="p-3 font-medium">Utilisateur</th>
                  <th className="p-3 font-medium">Action</th>
                  <th className="p-3 font-medium">Document</th>
                  <th className="p-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t align-top hover:bg-muted/30">
                    <td className="whitespace-nowrap p-3 text-muted-foreground">{formatDate(log.createdAt)}</td>
                    <td className="p-3">
                      <p className="font-medium">{log.user.fullName}</p>
                      <p className="text-xs text-muted-foreground">{log.userEmail}</p>
                    </td>
                    <td className="p-3">
                      <Badge variant={auditActionVariant(log.action)}>{AUDIT_ACTION_LABEL[log.action] ?? log.action}</Badge>
                    </td>
                    <td className="p-3">
                      {log.document ? (
                        <Link href={`/documents/${log.document.id}`} className="font-medium hover:underline">
                          {log.document.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-mono text-xs">{log.ipAddress}</p>
                      <p className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground" title={log.userAgent}>
                        {log.userAgent}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
