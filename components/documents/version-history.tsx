"use client";

import { useState } from "react";
import { restoreVersionAction } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileTypeIcon } from "@/components/documents/file-type-icon";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import { documentTypeLabel } from "@/lib/documents/mime";
import { toast } from "sonner";
import { ArrowRight, Download, Eye, GitCompare, History, Loader2, MoreHorizontal, RotateCcw } from "lucide-react";

type Version = {
  id: string;
  version: string;
  fileSize: number;
  mimeType: string;
  fileHash: string;
  createdAt: Date;
  createdBy: { fullName: string };
};

type PreviewPayload = {
  version: { version: string; mimeType: string; createdBy: string; createdAt: string };
  text: string;
  html: string | null;
  kind: "word" | "pdf" | "image" | "binary";
};

type DiffSegment = { type: "equal" | "add" | "remove"; value: string };

type DiffPayload = {
  from: { id: string; version: string; mimeType: string; fileSize: number; fileHash: string; createdBy: string };
  to: { id: string; version: string; mimeType: string; fileSize: number; fileHash: string; createdBy: string };
  segments: DiffSegment[];
  addedWords: number;
  removedWords: number;
  identical: boolean;
  hasText: boolean;
  hashChanged: boolean;
  mimeChanged: boolean;
  sizeDelta: number;
  error?: string;
};

export function VersionHistory({
  documentId,
  versions,
  canRestore,
}: {
  documentId: string;
  versions: Version[];
  canRestore: boolean;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "error">("idle");
  const [previewError, setPreviewError] = useState("");

  const [diffOpen, setDiffOpen] = useState(false);
  const [compareTab, setCompareTab] = useState<"changes" | "split">("changes");
  const [fromId, setFromId] = useState(versions[1]?.id ?? "");
  const [toId, setToId] = useState(versions[0]?.id ?? "");
  const [diff, setDiff] = useState<DiffPayload | null>(null);
  const [diffStatus, setDiffStatus] = useState<"idle" | "loading" | "error">("idle");
  const [diffError, setDiffError] = useState("");
  const [leftPreview, setLeftPreview] = useState<PreviewPayload | null>(null);
  const [rightPreview, setRightPreview] = useState<PreviewPayload | null>(null);

  const chronological = [...versions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  async function fetchPreview(versionId: string) {
    const res = await fetch(`/api/documents/${documentId}/versions/${versionId}`);
    const data = (await res.json()) as PreviewPayload & { error?: string };
    if (!res.ok) throw new Error(data.error || "Lecture impossible");
    return data;
  }

  async function loadPreview(versionId: string) {
    setPreviewId(versionId);
    setPreview(null);
    setPreviewStatus("loading");
    setPreviewError("");
    try {
      setPreview(await fetchPreview(versionId));
      setPreviewStatus("idle");
    } catch (error) {
      setPreviewStatus("error");
      setPreviewError(error instanceof Error ? error.message : "Lecture impossible");
    }
  }

  async function loadDiff(nextFrom = fromId, nextTo = toId) {
    if (!nextFrom || !nextTo || nextFrom === nextTo) {
      setDiffError("Choisissez deux versions différentes.");
      setDiffStatus("error");
      return;
    }
    setDiffStatus("loading");
    setDiffError("");
    setDiff(null);
    setLeftPreview(null);
    setRightPreview(null);
    try {
      const [diffRes, left, right] = await Promise.all([
        fetch(
          `/api/documents/${documentId}/diff?from=${encodeURIComponent(nextFrom)}&to=${encodeURIComponent(nextTo)}`,
        ),
        fetchPreview(nextFrom),
        fetchPreview(nextTo),
      ]);
      const data = (await diffRes.json()) as DiffPayload & { error?: string };
      if (!diffRes.ok) throw new Error(data.error || "Comparaison impossible");
      setDiff(data);
      setLeftPreview(left);
      setRightPreview(right);
      setDiffStatus("idle");
    } catch (error) {
      setDiffStatus("error");
      setDiffError(error instanceof Error ? error.message : "Comparaison impossible");
    }
  }

  function openCompare(olderId: string, newerId: string) {
    setFromId(olderId);
    setToId(newerId);
    setCompareTab("changes");
    setDiffOpen(true);
    void loadDiff(olderId, newerId);
  }

  const previewVersion = versions.find((item) => item.id === previewId);
  const fromVersion = versions.find((item) => item.id === fromId);
  const toVersion = versions.find((item) => item.id === toId);

  return (
    <div className="space-y-5">
      {versions.length >= 2 ? (
        <div className="rounded-2xl border bg-gradient-to-br from-accent/50 to-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" aria-hidden />
            <p className="text-sm font-medium">Comparer deux versions</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-44 flex-1 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Avant</p>
              <Select
                value={fromId}
                onValueChange={(value) => {
                  setFromId(value);
                  if (diffOpen) void loadDiff(value, toId);
                }}
              >
                <SelectTrigger aria-label="Version d’origine" className="bg-background">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {chronological.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.version} · {item.createdBy.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight className="mb-3 hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
            <div className="min-w-44 flex-1 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Après</p>
              <Select
                value={toId}
                onValueChange={(value) => {
                  setToId(value);
                  if (diffOpen) void loadDiff(fromId, value);
                }}
              >
                <SelectTrigger aria-label="Version comparée" className="bg-background">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {chronological.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.version} · {item.createdBy.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={() => openCompare(fromId, toId)} disabled={!fromId || !toId}>
              <GitCompare />
              Voir les modifications
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
          Une seule version est enregistrée. Déposez ou enregistrez une nouvelle version pour comparer les changements.
        </div>
      )}

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune version.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-5 sm:pl-6">
          {versions.map((item, index) => {
            const older = versions[index + 1];
            const current = index === 0;
            return (
              <li key={item.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[1.45rem] top-5 h-3 w-3 rounded-full border-2 border-background sm:-left-[1.7rem]",
                    current ? "bg-primary" : "bg-border",
                  )}
                  aria-hidden
                />
                <article
                  className={cn(
                    "rounded-2xl border bg-card p-4 shadow-sm transition-colors",
                    current && "border-primary/20 bg-accent/30",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <FileTypeIcon mimeType={item.mimeType} size="sm" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{item.version}</p>
                          {current ? <Badge variant="success">Actuelle</Badge> : null}
                          <Badge variant="outline">{documentTypeLabel(item.mimeType)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.createdBy.fullName} · {formatDate(item.createdAt)} · {formatBytes(item.fileSize)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => void loadPreview(item.id)}>
                        <Eye />
                        Aperçu
                      </Button>
                      {older ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openCompare(older.id, item.id)}
                        >
                          <GitCompare />
                          Modifications
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" aria-label={`Plus d’actions ${item.version}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              window.location.assign(`/api/files/${documentId}?versionId=${item.id}&download=1`);
                            }}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Télécharger
                          </DropdownMenuItem>
                          {canRestore && !current ? (
                            <DropdownMenuItem
                              onSelect={() => {
                                void (async () => {
                                  try {
                                    await restoreVersionAction(documentId, item.id);
                                    toast.success(`${item.version} restaurée (nouvelle version créée).`);
                                  } catch {
                                    toast.error("Restauration impossible.");
                                  }
                                })();
                              }}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Restaurer
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={Boolean(previewId)} onOpenChange={(open) => !open && setPreviewId(null)}>
        <DialogContent className="flex max-h-[92vh] w-[min(96vw,72rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4 pr-14 text-left">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Aperçu {previewVersion?.version ?? ""}
            </DialogTitle>
            <DialogDescription>
              {previewVersion
                ? `${previewVersion.createdBy.fullName} · ${formatDate(previewVersion.createdAt)} · ${documentTypeLabel(previewVersion.mimeType)}`
                : "Consultation d’une version précédente, en lecture seule."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/40 p-4">
            {previewStatus === "loading" ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground" aria-busy="true">
                <Loader2 className="animate-spin" />
                Chargement de la version…
              </div>
            ) : null}
            {previewStatus === "error" ? (
              <p className="text-sm text-destructive" role="alert">
                {previewError}
              </p>
            ) : null}
            {preview && previewVersion ? (
              <VersionPreviewBody documentId={documentId} version={previewVersion} payload={preview} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="flex max-h-[92vh] w-[min(96vw,80rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4 pr-14 text-left">
            <DialogTitle>Ce qui a changé</DialogTitle>
            <DialogDescription>
              {fromVersion && toVersion
                ? `${fromVersion.version} → ${toVersion.version}`
                : "Le texte supprimé apparaît en rouge, le texte ajouté en vert."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-1 border-b bg-muted/40 px-4 py-2">
            <Button
              type="button"
              size="sm"
              variant={compareTab === "changes" ? "secondary" : "ghost"}
              onClick={() => setCompareTab("changes")}
            >
              Modifications
            </Button>
            <Button
              type="button"
              size="sm"
              variant={compareTab === "split" ? "secondary" : "ghost"}
              onClick={() => setCompareTab("split")}
            >
              Côte à côte
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {diffStatus === "loading" ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground" aria-busy="true">
                <Loader2 className="animate-spin" />
                Comparaison en cours…
              </div>
            ) : null}
            {diffStatus === "error" ? (
              <p className="text-sm text-destructive" role="alert">
                {diffError}
              </p>
            ) : null}
            {diff && compareTab === "changes" ? <DiffBody diff={diff} /> : null}
            {diff && compareTab === "split" && fromVersion && toVersion ? (
              <SplitCompare
                documentId={documentId}
                fromVersion={fromVersion}
                toVersion={toVersion}
                left={leftPreview}
                right={rightPreview}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VersionPreviewBody({
  documentId,
  version,
  payload,
  compact = false,
}: {
  documentId: string;
  version: Version;
  payload: PreviewPayload;
  compact?: boolean;
}) {
  const fileSrc = `/api/files/${documentId}?versionId=${version.id}`;
  const frame = compact ? "h-[48vh]" : "h-[62vh]";
  if (payload.kind === "pdf") {
    return <iframe title={`Aperçu ${version.version}`} src={fileSrc} className={cn("w-full rounded-xl border bg-white shadow-sm", frame)} />;
  }
  if (payload.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={fileSrc} alt={`Aperçu ${version.version}`} className="mx-auto max-h-[62vh] rounded-xl object-contain shadow-sm" />
    );
  }
  if (payload.html) {
    return (
      <article
        className={cn(
          "office-preview overflow-auto rounded-xl border bg-white px-6 py-5 shadow-sm",
          compact ? "max-h-[48vh]" : "max-h-[62vh]",
        )}
        dangerouslySetInnerHTML={{ __html: payload.html }}
      />
    );
  }
  if (payload.text) {
    return (
      <pre className={cn("overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-sm shadow-sm", compact ? "max-h-[48vh]" : "max-h-[62vh]")}>
        {payload.text}
      </pre>
    );
  }
  return <p className="text-sm text-muted-foreground">Aucun aperçu pour ce fichier. Utilisez Télécharger.</p>;
}

function SplitCompare({
  documentId,
  fromVersion,
  toVersion,
  left,
  right,
}: {
  documentId: string;
  fromVersion: Version;
  toVersion: Version;
  left: PreviewPayload | null;
  right: PreviewPayload | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {fromVersion.version} · avant
        </p>
        {left ? (
          <VersionPreviewBody documentId={documentId} version={fromVersion} payload={left} compact />
        ) : (
          <p className="text-sm text-muted-foreground">Aperçu indisponible.</p>
        )}
      </section>
      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {toVersion.version} · après
        </p>
        {right ? (
          <VersionPreviewBody documentId={documentId} version={toVersion} payload={right} compact />
        ) : (
          <p className="text-sm text-muted-foreground">Aperçu indisponible.</p>
        )}
      </section>
    </div>
  );
}

function DiffBody({ diff }: { diff: DiffPayload }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-muted/30 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avant {diff.from.version}</p>
          <p className="mt-1">
            {diff.from.createdBy} · {documentTypeLabel(diff.from.mimeType)} · {formatBytes(diff.from.fileSize)}
          </p>
        </div>
        <div className="rounded-xl border bg-accent/40 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Après {diff.to.version}</p>
          <p className="mt-1">
            {diff.to.createdBy} · {documentTypeLabel(diff.to.mimeType)} · {formatBytes(diff.to.fileSize)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
          +{diff.addedWords} mot{diff.addedWords > 1 ? "s" : ""}
        </span>
        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-900">
          −{diff.removedWords} mot{diff.removedWords > 1 ? "s" : ""}
        </span>
        {diff.mimeChanged ? <Badge>Type modifié</Badge> : null}
        {diff.sizeDelta !== 0 ? (
          <Badge variant="outline">
            Taille {diff.sizeDelta > 0 ? "+" : "−"}
            {formatBytes(Math.abs(diff.sizeDelta))}
          </Badge>
        ) : null}
        {!diff.hashChanged ? <Badge variant="secondary">Fichiers identiques</Badge> : null}
        <span className="ml-auto hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
          <span>
            <del className="rounded-sm bg-red-100 px-1 text-red-900">supprimé</del>
          </span>
          <span>
            <ins className="rounded-sm bg-emerald-100 px-1 text-emerald-950 no-underline">ajouté</ins>
          </span>
        </span>
      </div>
      {!diff.hasText ? (
        <p className="rounded-xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
          {diff.hashChanged
            ? "Le fichier a changé, mais aucun texte extractible n’est disponible (image ou PDF scanné). Passez sur l’onglet Côte à côte."
            : "Aucun changement détecté."}
        </p>
      ) : diff.identical ? (
        <p className="rounded-xl bg-muted/50 p-5 text-sm text-muted-foreground">Le texte extractible est identique.</p>
      ) : (
        <div className="max-h-[48vh] overflow-auto whitespace-pre-wrap rounded-xl border bg-white p-5 text-sm leading-relaxed shadow-sm">
          {diff.segments.map((segment, index) => (
            <DiffSegmentView key={index} segment={segment} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiffSegmentView({ segment }: { segment: DiffSegment }) {
  const [expanded, setExpanded] = useState(false);
  if (!segment.value) return null;
  if (segment.type === "add") {
    return <ins className="rounded-sm bg-emerald-100 text-emerald-950 no-underline">{segment.value}</ins>;
  }
  if (segment.type === "remove") {
    return <del className="rounded-sm bg-red-100 text-red-900">{segment.value}</del>;
  }
  const long = segment.value.length > 280;
  if (!long || expanded) {
    return <span className="text-foreground/80">{segment.value}</span>;
  }
  const start = segment.value.slice(0, 90);
  const end = segment.value.slice(-70);
  return (
    <span className="text-foreground/55">
      {start}
      <button
        type="button"
        className="mx-1 inline-flex min-h-11 items-center rounded-full bg-muted px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2"
        onClick={() => setExpanded(true)}
      >
        … texte inchangé …
      </button>
      {end}
    </span>
  );
}
