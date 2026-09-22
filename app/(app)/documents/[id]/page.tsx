import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { Download, FileSearch, GitBranch, History, Info } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/rbac";
import { loadFolderGraph } from "@/lib/data";
import { getRequestMeta } from "@/lib/audit/log";
import { DocumentCanvas } from "@/components/documents/document-canvas";
import { VersionHistory } from "@/components/documents/version-history";
import { ValidationPanel } from "@/components/workflow/validation-panel";
import { UploadModal } from "@/components/documents/upload-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDocumentMetaAction } from "@/app/actions/documents";
import { OcrPanel } from "@/components/documents/ocr-panel";
import { ConvertPdfButton } from "@/components/documents/convert-pdf-button";
import { FileTypeIcon } from "@/components/documents/file-type-icon";
import { CopyHash } from "@/components/documents/copy-hash";
import {
  DOC_STATUS_LABEL,
  SENSITIVITY_LABEL,
  formatBytes,
  formatDate,
  formatDateUtc,
  sensitivityVariant,
  statusVariant,
} from "@/lib/utils";
import { documentTypeLabel, isPdfMime } from "@/lib/documents/mime";
import { BackLink } from "@/components/layout/back-link";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const folders = await loadFolderGraph(session.tenantId);
  const document = await prisma.document.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      owner: true,
      folder: true,
      department: true,
      tags: true,
      permissions: true,
      versions: { include: { createdBy: true }, orderBy: { createdAt: "desc" } },
      validations: { include: { assignee: true, requester: true }, orderBy: { createdAt: "desc" }, take: 5 },
      ocrJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!document) notFound();
  if (!can({ session, action: "VIEW", document, folders })) notFound();

  const { ipAddress } = await getRequestMeta();
  const watermark = `CONFIDENTIEL - ${session.email} - ${formatDateUtc()} - IP: ${ipAddress}`;
  const pending = document.validations.find((v) => v.status === "PENDING") ?? null;
  const locked = document.status === "EN_REVISION";
  const canUpdate = can({ session, action: "UPDATE", document, folders }) && !locked;
  const canValidate = can({ session, action: "VALIDATE", document, folders });
  const canRestore = session.role === Role.ADMIN_ESPACE || session.role === Role.SUPER_ADMIN;
  const canDownload = can({ session, action: "DOWNLOAD", document, folders });
  const validators = await prisma.user.findMany({
    where: {
      tenantId: session.tenantId,
      role: { in: [Role.VALIDATEUR, Role.ADMIN_ESPACE, Role.SUPER_ADMIN] },
    },
    select: { id: true, fullName: true, email: true },
  });
  const ocr = document.ocrJobs[0];
  const currentVersion = document.versions[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink href={`/folders/${document.folderId}`} label={document.folder.name} />

      {locked ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Document verrouillé pendant la revue
          {pending ? ` — en attente de ${pending.assignee.fullName}` : ""}.
        </div>
      ) : null}

      <header className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 md:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <FileTypeIcon mimeType={document.mimeType} size="lg" />
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                {document.folder.name}
                <span className="mx-1.5 text-border">·</span>
                {document.department.name}
              </p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{document.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(document.status)}>{DOC_STATUS_LABEL[document.status]}</Badge>
                <Badge variant={sensitivityVariant(document.sensitivity)}>
                  {SENSITIVITY_LABEL[document.sensitivity]}
                </Badge>
                <Badge variant="outline">{documentTypeLabel(document.mimeType)}</Badge>
                {document.tags.map((t) => (
                  <Badge key={t.id} variant="outline">
                    {t.name}
                  </Badge>
                ))}
              </div>
              <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <div>
                  <dt className="sr-only">Auteur</dt>
                  <dd>{document.owner.fullName}</dd>
                </div>
                <div>
                  <dt className="sr-only">Date</dt>
                  <dd>{formatDate(document.createdAt)}</dd>
                </div>
                <div>
                  <dt className="sr-only">Taille</dt>
                  <dd>{formatBytes(document.fileSize)}</dd>
                </div>
                {currentVersion ? (
                  <div>
                    <dt className="sr-only">Version</dt>
                    <dd>{currentVersion.version}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canDownload ? (
              <Button asChild variant="outline">
                <a href={`/api/files/${document.id}?download=1`}>
                  <Download />
                  Télécharger
                </a>
              </Button>
            ) : null}
            {isPdfMime(document.mimeType) && (canUpdate || canDownload) ? (
              <ConvertPdfButton
                documentId={document.id}
                title={document.title}
                mode={canUpdate ? "save" : "download"}
              />
            ) : null}
            {canUpdate ? <UploadModal documentId={document.id} triggerLabel="Nouvelle version" /> : null}
          </div>
        </div>
      </header>

      <DocumentCanvas
        documentId={document.id}
        mimeType={document.mimeType}
        title={document.title}
        watermark={watermark}
        canEdit={canUpdate}
        locked={locked}
      />

      <Tabs defaultValue="info">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="info" className="gap-2">
            <Info className="h-4 w-4" />
            Infos
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-2">
            <History className="h-4 w-4" />
            Versions
            <span className="rounded-full bg-background/80 px-1.5 text-xs text-muted-foreground">
              {document.versions.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="workflow" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Validation
          </TabsTrigger>
          <TabsTrigger value="ocr" className="gap-2">
            <FileSearch className="h-4 w-4" />
            Texte extrait
          </TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <MetaItem label="Auteur" value={document.owner.fullName} />
            <MetaItem label="Créé" value={formatDate(document.createdAt)} />
            <MetaItem label="Date détectée" value={document.detectedDate ? formatDate(document.detectedDate) : "—"} />
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Empreinte SHA-256</p>
              <CopyHash hash={document.fileHash} />
            </div>
          </div>
          {canUpdate ? (
            <form action={updateDocumentMetaAction} className="mt-6 rounded-xl bg-muted/40 p-4">
              <p className="mb-3 text-sm font-medium">Modifier les informations</p>
              <input type="hidden" name="documentId" value={document.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="title">Titre</Label>
                  <Input id="title" name="title" defaultValue={document.title} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sensitivity">Confidentialité</Label>
                  <select
                    id="sensitivity"
                    name="sensitivity"
                    defaultValue={document.sensitivity}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(SENSITIVITY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="submit" className="mt-4 w-fit">
                Enregistrer
              </Button>
            </form>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              {locked ? "Édition bloquée pendant la revue." : "Lecture seule pour votre rôle."}
            </p>
          )}
        </TabsContent>
        <TabsContent value="versions" className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <VersionHistory documentId={document.id} versions={document.versions} canRestore={canRestore} />
        </TabsContent>
        <TabsContent value="workflow" className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <ValidationPanel
            documentId={document.id}
            locked={locked}
            canSubmit={canUpdate || session.role === "EDITEUR" || session.role === "ADMIN_ESPACE" || session.role === "SUPER_ADMIN"}
            canDecide={Boolean(pending) && canValidate}
            validators={validators}
            pending={pending}
          />
        </TabsContent>
        <TabsContent value="ocr" className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <OcrPanel
            documentId={document.id}
            status={ocr?.status ?? null}
            error={ocr?.error ?? null}
            extractedText={document.extractedText}
            canReindex={canUpdate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
