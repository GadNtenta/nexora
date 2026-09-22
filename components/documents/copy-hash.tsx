"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyHash({ hash }: { hash: string }) {
  const short = `${hash.slice(0, 10)}…${hash.slice(-8)}`;

  return (
    <button
      type="button"
      className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md px-1 text-left font-mono text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Copier l’empreinte SHA-256"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(hash);
          toast.success("Empreinte copiée");
        } catch {
          toast.error("Copie impossible");
        }
      }}
    >
      <span className="hidden break-all sm:inline">{hash}</span>
      <span className="sm:hidden">{short}</span>
      <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}
