import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE = "ds_session";
export const TWO_FA_COOKIE = "ds_2fa_pending";
const SESSION_TTL = "8h";

export type RoleName = "LECTEUR" | "EDITEUR" | "VALIDATEUR" | "ADMIN_ESPACE" | "SUPER_ADMIN";

export type SessionPayload = {
  userId: string;
  tenantId: string;
  role: RoleName;
  email: string;
  fullName: string;
  departmentId: string | null;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET manquant ou trop court");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.tenantId !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.fullName !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role as RoleName,
      email: payload.email,
      fullName: payload.fullName,
      departmentId: typeof payload.departmentId === "string" ? payload.departmentId : null,
    };
  } catch {
    return null;
  }
}
