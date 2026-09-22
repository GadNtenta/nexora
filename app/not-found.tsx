import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/layout/back-link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <BackLink href="/documents" label="Documents" />
      <h1 className="text-2xl font-semibold">Ressource introuvable</h1>
      <p className="text-sm text-muted-foreground">Ce document ou cette page n&apos;existe pas, ou vous n&apos;y avez pas accès.</p>
      <Button asChild>
        <Link href="/documents">Retour aux documents</Link>
      </Button>
    </div>
  );
}
