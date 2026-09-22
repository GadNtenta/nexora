import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateUtc(value: Date | string = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

export const DOC_STATUS_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  EN_REVISION: "En révision",
  VALIDE: "Validé",
  REJETE: "Rejeté",
  ARCHIVE: "Archivé",
};

export const SENSITIVITY_LABEL: Record<string, string> = {
  PUBLIC: "Public",
  INTERNE: "Interne",
  CONFIDENTIEL: "Confidentiel",
  SECRET: "Secret",
};

export function statusVariant(status: string) {
  if (status === "VALIDE") return "success" as const;
  if (status === "EN_REVISION") return "warning" as const;
  if (status === "REJETE") return "destructive" as const;
  return "secondary" as const;
}

export function sensitivityVariant(sensitivity: string) {
  if (sensitivity === "SECRET") return "destructive" as const;
  if (sensitivity === "CONFIDENTIEL") return "warning" as const;
  if (sensitivity === "PUBLIC") return "secondary" as const;
  return "outline" as const;
}

export const ROLE_LABEL: Record<string, string> = {
  LECTEUR: "Lecteur",
  EDITEUR: "Éditeur",
  VALIDATEUR: "Validateur",
  ADMIN_ESPACE: "Admin espace",
  SUPER_ADMIN: "Super admin",
};

export const OCR_STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  RUNNING: "En cours",
  DONE: "Indexé",
  FAILED: "Échec",
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  VIEW: "Consultation",
  DOWNLOAD: "Téléchargement",
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  VALIDATE: "Validation",
  SUBMIT: "Soumission",
  RESTORE: "Restauration",
  LOGIN: "Connexion",
  CONVERT: "Conversion",
};

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABEL);

export function auditActionVariant(action: string) {
  if (action === "DELETE") return "destructive" as const;
  if (action === "CREATE" || action === "VALIDATE") return "success" as const;
  if (action === "UPDATE" || action === "SUBMIT" || action === "CONVERT") return "warning" as const;
  if (action === "LOGIN" || action === "RESTORE") return "secondary" as const;
  return "outline" as const;
}

export const MIN_VIEW_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "LECTEUR", label: "Tout le monde (Lecteur et plus)" },
  { value: "EDITEUR", label: "Éditeur et plus" },
  { value: "VALIDATEUR", label: "Validateur et plus" },
  { value: "ADMIN_ESPACE", label: "Administrateurs uniquement" },
];

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export {
  ALLOWED_MIME_TYPES,
  UPLOAD_ACCEPT,
  UPLOAD_TYPES_LABEL,
  resolveUploadMime,
  isWordMime,
} from "@/lib/documents/mime";
