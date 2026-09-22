"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { reindexOcrAction } from "@/app/actions/documents";
import { OCR_STATUS_LABEL } from "@/lib/utils";

function ocrVariant(status: string | null) {
  if (status === "DONE") return "success" as const;
  if (status === "RUNNING" || status === "PENDING") return "warning" as const;
  if (status === "FAILED") return "destructive" as const;
  return "secondary" as const;
}

export function OcrPanel({
  documentId,
  status,
  error,
  extractedText,
  canReindex,
}: {
  documentId: string;
  status: string | null;
  error: string | null;
  extractedText: string | null;
  canReindex: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [waited, setWaited] = useState(false);
  const inFlight = status === "PENDING" || status === "RUNNING";

  useEffect(() => {
    if (!inFlight) return;
    const timer = window.setInterval(() => {
      setWaited(true);
      router.refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [inFlight, router]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Indexation plein texte</p>
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <Badge variant={ocrVariant(status)}>{status ? OCR_STATUS_LABEL[status] ?? status : "Jamais lancée"}</Badge>
            {inFlight ? <span className="text-sm text-muted-foreground">Extraction en cours…</span> : null}
          </div>
        </div>
        {canReindex ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending || status === "RUNNING"}
            onClick={() => {
              start(async () => {
                try {
                  await reindexOcrAction(documentId);
                  toast.success("Indexation relancée.");
                  router.refresh();
                } catch {
                  toast.error("Impossible de relancer l’OCR.");
                }
              });
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Relancer l’OCR
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {inFlight && waited ? (
        <p className="text-xs text-muted-foreground">
          Les PDF scannés peuvent prendre jusqu’à une minute. La recherche sera disponible dès que le statut passera à
          Indexé.
        </p>
      ) : null}
      {!extractedText && !inFlight ? (
        <p className="rounded-xl border border-dashed bg-muted/40 p-5 text-sm text-muted-foreground">
          Aucun texte extrait. Relancez l’OCR ou éditez le document Word pour l’indexer.
        </p>
      ) : (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed">
          {extractedText || "Extraction en cours…"}
        </pre>
      )}
    </div>
  );
}
