"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL, formatBytes } from "@/lib/utils";
import { resolveUploadMime } from "@/lib/documents/mime";

export function UploadModal({
  folderId,
  documentId,
  triggerLabel = "Déposer un document",
}: {
  folderId?: string;
  documentId?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  function onFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list);
    const invalid = next.find((f) => f.size > MAX_UPLOAD_BYTES || !resolveUploadMime(f));
    if (invalid) {
      setStatus("error");
      setMessage(`${UPLOAD_TYPES_LABEL}, 50 Mo maximum.`);
      return;
    }
    setFiles(next);
    setStatus("idle");
    setMessage("");
  }

  async function submit() {
    if (!files.length) return;
    setStatus("uploading");
    setMessage("Hachage SHA-256 et envoi vers MinIO…");
    const body = new FormData();
    files.forEach((f) => body.append("files", f));
    if (folderId) body.set("folderId", folderId);
    if (documentId) body.set("documentId", documentId);
    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const raw = await res.text();
      let data: { error?: string; documents?: { id: string; title: string }[] } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          throw new Error(res.ok ? "Réponse serveur invalide" : "Le stockage est indisponible. Réessayez dans un instant.");
        }
      }
      if (!res.ok) throw new Error(data.error || "Échec de l'upload");
      setStatus("done");
      setMessage("Fichier stocké. OCR en cours…");
      toast.success("Dépôt réussi, indexation OCR lancée.");
      setOpen(false);
      setFiles([]);
      router.refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur d'upload";
      setStatus("error");
      setMessage(msg);
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent aria-describedby="upload-desc">
        <DialogHeader>
          <DialogTitle>{documentId ? "Nouvelle version" : "Dépôt de documents"}</DialogTitle>
          <DialogDescription id="upload-desc">
            Glissez-déposez un ou plusieurs fichiers {UPLOAD_TYPES_LABEL} (50 Mo max). Un identifiant UUID et un hash
            SHA-256 sont générés à la réception. Les fichiers Word sont éditables dans l’application.
          </DialogDescription>
        </DialogHeader>
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
          className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 px-4 text-center"
        >
          <UploadCloud className="mb-2 h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">Déposer les fichiers ici</span>
          <span className="text-xs text-muted-foreground">ou cliquer pour parcourir</span>
          <input
            type="file"
            multiple={!documentId}
            accept={UPLOAD_ACCEPT}
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
        {files.length > 0 ? (
          <ul className="max-h-32 space-y-1 overflow-auto text-sm">
            {files.map((f) => (
              <li key={f.name} className="flex justify-between gap-2">
                <span className="truncate">{f.name}</span>
                <span className="text-muted-foreground">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {message ? (
          <p className={status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"} role="status">
            {message}
          </p>
        ) : null}
        <Button onClick={submit} disabled={!files.length || status === "uploading"} className="w-full">
          {status === "uploading" ? "Envoi en cours…" : "Importer"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
