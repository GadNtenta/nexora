import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { Users } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { SettingsNav } from "@/components/settings/settings-nav";
import { UsersManager } from "@/components/settings/users-manager";

export default async function UsersSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN_ESPACE" && session.role !== "SUPER_ADMIN") redirect("/documents");
  const users = await prisma.user.findMany({
    where: { tenantId: session.tenantId },
    include: { department: true },
    orderBy: { createdAt: "asc" },
  });
  const departments = await prisma.department.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
  });
  const roles = Object.values(Role).filter((role) => role !== Role.SUPER_ADMIN || session.role === Role.SUPER_ADMIN);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="overflow-hidden rounded-2xl border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Créez les comptes, attribuez un rôle et un département. La 2FA se configure à la connexion.
              </p>
            </div>
          </div>
          <SettingsNav />
        </div>
      </header>

      <UsersManager
        currentUserId={session.userId}
        roles={roles}
        departments={departments.map((department) => ({ id: department.id, name: department.name }))}
        users={users.map((user) => ({
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
          departmentName: user.department?.name ?? null,
          is2FAEnabled: user.is2FAEnabled,
          createdAt: user.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
