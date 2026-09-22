import {
  DocStatus,
  Role,
  Sensitivity,
  type Document,
  type DocumentPermission,
  type FolderPermission,
} from "@prisma/client";
import type { SessionPayload } from "@/lib/auth/session";

export type PermissionAction = "VIEW" | "DOWNLOAD" | "UPDATE" | "DELETE" | "VALIDATE" | "ADMIN";

export type FolderNode = {
  id: string;
  parentId: string | null;
  departmentId: string | null;
  minViewRole: Role;
  permissions: FolderPermission[];
};

export type DocumentAuthContext = Pick<
  Document,
  "id" | "ownerId" | "tenantId" | "status" | "sensitivity" | "folderId"
> & {
  permissions: DocumentPermission[];
};

const ROLE_RANK: Record<Role, number> = {
  LECTEUR: 1,
  EDITEUR: 2,
  VALIDATEUR: 3,
  ADMIN_ESPACE: 4,
  SUPER_ADMIN: 5,
};

export function isAdmin(role: Role | SessionPayload["role"]): boolean {
  return role === Role.ADMIN_ESPACE || role === Role.SUPER_ADMIN;
}

export function canManageUsers(role: Role | SessionPayload["role"]): boolean {
  return isAdmin(role);
}

function defaultAllows(role: Role | SessionPayload["role"], action: PermissionAction): boolean {
  switch (action) {
    case "VIEW":
    case "DOWNLOAD":
      return true;
    case "UPDATE":
      return role === Role.EDITEUR || isAdmin(role);
    case "DELETE":
      return isAdmin(role);
    case "VALIDATE":
      return role === Role.VALIDATEUR || isAdmin(role);
    case "ADMIN":
      return isAdmin(role);
    default:
      return false;
  }
}

function resolveOverride(
  perms: { role: Role; canView: boolean; canEdit: boolean; canValidate: boolean; canDelete: boolean }[],
  role: Role | SessionPayload["role"],
  action: PermissionAction,
): boolean | null {
  const match = perms.find((p) => p.role === role);
  if (!match) return null;
  switch (action) {
    case "VIEW":
    case "DOWNLOAD":
      return match.canView;
    case "UPDATE":
      return match.canEdit;
    case "VALIDATE":
      return match.canValidate;
    case "DELETE":
      return match.canDelete;
    default:
      return null;
  }
}

export function roleAtLeast(role: Role | SessionPayload["role"], min: Role): boolean {
  return ROLE_RANK[role as Role] >= ROLE_RANK[min];
}

export function canAccessFolder(params: {
  session: SessionPayload;
  folderId: string;
  folders: FolderNode[];
  action?: PermissionAction;
}): boolean {
  const { session, folderId, folders, action = "VIEW" } = params;
  if (session.role === Role.SUPER_ADMIN) return true;
  if (session.role === Role.ADMIN_ESPACE) return true;

  const byId = new Map(folders.map((f) => [f.id, f]));
  let current = byId.get(folderId);
  const seen = new Set<string>();
  let minRequired: Role = Role.LECTEUR;

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.departmentId && current.departmentId !== session.departmentId) {
      return false;
    }
    if (ROLE_RANK[current.minViewRole] > ROLE_RANK[minRequired]) {
      minRequired = current.minViewRole;
    }
    const override = resolveOverride(current.permissions, session.role, action);
    if (override === false) return false;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  if (!roleAtLeast(session.role, minRequired)) return false;
  if (action === "VIEW" || action === "DOWNLOAD") return true;
  return defaultAllows(session.role, action);
}

export function filterVisibleFolders<T extends { id: string }>(
  session: SessionPayload,
  folders: T[],
  graph: FolderNode[],
): T[] {
  return folders.filter((folder) => canAccessFolder({ session, folderId: folder.id, folders: graph }));
}

export function can(params: {
  session: SessionPayload;
  action: PermissionAction;
  document?: DocumentAuthContext;
  folders?: FolderNode[];
}): boolean {
  const { session, action, document, folders = [] } = params;

  if (session.role === Role.SUPER_ADMIN) return true;
  if (session.role === Role.ADMIN_ESPACE && (!document || document.tenantId === session.tenantId)) {
    return true;
  }

  if (document && document.tenantId !== session.tenantId) return false;

  if (action === "ADMIN") {
    return isAdmin(session.role);
  }

  if (document && !canAccessFolder({ session, folderId: document.folderId, folders, action })) {
    return false;
  }

  if (!document) {
    return defaultAllows(session.role, action);
  }

  const docOverride = resolveOverride(document.permissions, session.role, action);
  if (docOverride !== null) return docOverride;

  if (
    (document.sensitivity === Sensitivity.CONFIDENTIEL || document.sensitivity === Sensitivity.SECRET) &&
    session.role === Role.EDITEUR &&
    (action === "UPDATE" || action === "DELETE")
  ) {
    return false;
  }

  if (document.status === DocStatus.EN_REVISION && action === "UPDATE") {
    return false;
  }

  if (document.status === DocStatus.ARCHIVE && (action === "UPDATE" || action === "DELETE")) {
    return isAdmin(session.role);
  }

  if (action === "UPDATE" && session.role === Role.EDITEUR && document.ownerId === session.userId) {
    return true;
  }

  return defaultAllows(session.role, action);
}

export function assertCan(params: Parameters<typeof can>[0]) {
  if (!can(params)) {
    const error = new Error("FORBIDDEN");
    error.name = "ForbiddenError";
    throw error;
  }
}
