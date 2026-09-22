"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/settings/users", label: "Utilisateurs", icon: Users },
  { href: "/settings/departments", label: "Départements", icon: Building2 },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Paramètres"
      className="inline-flex h-auto flex-wrap gap-1 rounded-lg bg-muted p-1 text-muted-foreground"
    >
      {LINKS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-background text-foreground shadow" : "hover:text-foreground",
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
