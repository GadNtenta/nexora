"use client";

import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/layout/back-link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-8 text-center">
      <div className="mb-4 flex justify-center">
        <BackLink href="/documents" label="Documents" />
      </div>
      <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message || "Veuillez réessayer."}</p>
      <Button className="mt-4" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
