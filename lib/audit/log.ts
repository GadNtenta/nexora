import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";

export type AuditAction =
  | "VIEW"
  | "DOWNLOAD"
  | "UPDATE"
  | "DELETE"
  | "VALIDATE"
  | "CREATE"
  | "RESTORE"
  | "SUBMIT"
  | "LOGIN"
  | "CONVERT";

export async function getRequestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
  const userAgent = h.get("user-agent") || "unknown";
  return { ipAddress, userAgent };
}

export async function writeAuditLog(params: {
  session: SessionPayload;
  action: AuditAction;
  documentId?: string | null;
}) {
  const { ipAddress, userAgent } = await getRequestMeta();
  await prisma.auditLog.create({
    data: {
      action: params.action,
      ipAddress,
      userAgent,
      userEmail: params.session.email,
      userId: params.session.userId,
      documentId: params.documentId ?? null,
      tenantId: params.session.tenantId,
    },
  });
}
