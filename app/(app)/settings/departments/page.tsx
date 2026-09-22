import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { SettingsNav } from "@/components/settings/settings-nav";
import { DepartmentsManager } from "@/components/settings/departments-manager";

export default async function DepartmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN_ESPACE" && session.role !== "SUPER_ADMIN") redirect("/documents");
  const departments = await prisma.department.findMany({
    where: { tenantId: session.tenantId },
    include: { _count: { select: { users: true, documents: true, folders: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="overflow-hidden rounded-2xl border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Départements</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Organisez l’espace : un dossier appartient à un département, ou reste commun à toute l’organisation.
              </p>
            </div>
          </div>
          <SettingsNav />
        </div>
      </header>

      <DepartmentsManager
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
          createdAt: department.createdAt.toISOString(),
          users: department._count.users,
          folders: department._count.folders,
          documents: department._count.documents,
        }))}
      />
    </div>
  );
}
