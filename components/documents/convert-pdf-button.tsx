"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileOutput, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { convertPdfToWordAction } from "@/app/actions/documents";

export function ConvertPdfButton({
  documentId,
  title,
  mode,
}: {
  documentId: string;
  title: string;
  mode: "save" | "download";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const busy = pending || downloading;

  async function downloadWord() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/pdf-to-word`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Conversion impossible");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title.replace(/[<>:"/\\|?*]+/g, "_") || "document"}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Fichier Word téléchargé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Conversion impossible");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={busy}
      aria-label={mode === "save" ? "Convertir le PDF en Word et enregistrer une version" : "Télécharger le PDF converti en Word"}
      onClick={() => {
        if (mode === "download") {
          void downloadWord();
          return;
        }
        start(async () => {
          try {
            const result = await convertPdfToWordAction(documentId);
            toast.success(`Version Word ${result.version} créée. Vous pouvez l’éditer dans l’application.`);
            router.refresh();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Conversion impossible");
          }
        });
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <FileOutput />}
      {busy ? "Conversion…" : mode === "save" ? "Convertir en Word" : "Télécharger en Word"}
    </Button>
  );
}
