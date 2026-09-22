import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  TWO_FA_COOKIE,
  signSession,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/jwt";

export { SESSION_COOKIE, TWO_FA_COOKIE, signSession, verifySessionToken };
export type { SessionPayload };

function isProd() {
  return process.env.NODE_ENV === "production";
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function setTwoFactorCookie(token: string) {
  const jar = await cookies();
  jar.set(TWO_FA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    path: "/",
    maxAge: 60 * 5,
  });
}

export async function getTwoFactorCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(TWO_FA_COOKIE)?.value;
}

export async function clearTwoFactorCookie() {
  const jar = await cookies();
  jar.delete(TWO_FA_COOKIE);
}
