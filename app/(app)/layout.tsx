import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const unread = await prisma.notification.count({
    where: { userId: session.userId, read: false },
  });
  return (
    <AppShell session={session} unread={unread}>
      {children}
    </AppShell>
  );
}
