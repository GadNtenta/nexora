"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROLE_LABEL } from "@/lib/utils";
import { CommandPalette } from "@/components/search/command-palette";
import type { SessionPayload } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/search", label: "Recherche", icon: Search },
  { href: "/audit", label: "Journal d'audit", icon: Shield, admin: true },
  { href: "/settings/users", label: "Utilisateurs", icon: Users, admin: true },
  { href: "/settings/departments", label: "Départements", icon: FolderTree, admin: true },
];

function NavLinks({
  session,
  onNavigate,
}: {
  session: SessionPayload;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const admin = session.role === "ADMIN_ESPACE" || session.role === "SUPER_ADMIN";
  return (
    <nav className="flex flex-col gap-1" aria-label="Navigation principale">
      {NAV.filter((item) => !item.admin || admin).map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  session,
  unread,
  children,
}: {
  session: SessionPayload;
  unread: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <CommandPalette />
      <aside className="hidden h-dvh w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">DocuShield AI</p>
            <p className="text-xs text-muted-foreground">GED souveraine</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <NavLinks session={session} />
        </div>
        <div className="shrink-0 border-t p-3 text-xs text-muted-foreground">
          <p className="font-medium text-sidebar-foreground">{session.fullName}</p>
          <p>{session.email}</p>
          <p>{ROLE_LABEL[session.role]}</p>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-card px-3 md:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Ouvrir le menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>DocuShield AI</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <NavLinks session={session} />
              </div>
            </SheetContent>
          </Sheet>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("docushield:search"))}
            className="hidden min-h-11 flex-1 items-center rounded-md border bg-muted/40 px-3 text-left text-sm text-muted-foreground md:flex"
          >
            Recherche universelle
            <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-xs">⌘K</kbd>
          </button>
          <Link href="/search" className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Recherche">
              <Search />
            </Button>
          </Link>
          {unread > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{unread}</span>
          ) : null}
          <Link href="/settings/users" className="hidden md:block">
            <Button variant="ghost" size="icon" aria-label="Paramètres">
              <Settings />
            </Button>
          </Link>
          <form action={logoutAction}>
            <Button variant="outline" type="submit" aria-label="Se déconnecter">
              <LogOut />
              <span className="hidden sm:inline">Quitter</span>
            </Button>
          </form>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
