"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { encryptSecret, decryptSecret } from "@/lib/auth/crypto";
import { generateTotpSecret, totpKeyUri, verifyTotp, isDemoTwoFactorPin, DEMO_2FA_PIN } from "@/lib/auth/totp";
import { getRequestMeta } from "@/lib/audit/log";
import {
  clearSessionCookie,
  clearTwoFactorCookie,
  getTwoFactorCookie,
  setSessionCookie,
  setTwoFactorCookie,
  signSession,
} from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type AuthState = { error?: string; ok?: boolean };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Identifiants invalides." };

  let user;
  try {
    user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  } catch (error) {
    console.error("login db error", error);
    return {
      error:
        "Base de données injoignable. Ouvre le dashboard Supabase, restaure le projet s’il est en pause, puis copie l’URI pooler (Connect) dans DATABASE_URL / DIRECT_URL.",
    };
  }
  if (!user) return { error: "Identifiants invalides." };

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return { error: "Identifiants invalides." };

  if (!user.is2FAEnabled) {
    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encryptSecret(secret) },
    });
  }

  const token = randomBytes(32).toString("hex");
  await prisma.twoFactorChallenge.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  await setTwoFactorCookie(token);
  redirect("/login/2fa");
}

export async function getTwoFactorSetup() {
  const token = await getTwoFactorCookie();
  if (!token) return null;
  const challenge = await prisma.twoFactorChallenge.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!challenge || challenge.expiresAt < new Date()) return null;
  const demoPin = process.env.NODE_ENV === "production" ? null : DEMO_2FA_PIN;
  if (challenge.user.is2FAEnabled || !challenge.user.twoFactorSecret) {
    return { setup: false as const, email: challenge.user.email, demoPin };
  }
  const secret = decryptSecret(challenge.user.twoFactorSecret);
  const uri = totpKeyUri(challenge.user.email, secret);
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { setup: true as const, email: challenge.user.email, qrDataUrl, demoPin };
}

export async function verifyTwoFactorAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return { error: "Le code doit contenir 6 chiffres." };

  const token = await getTwoFactorCookie();
  if (!token) return { error: "Session 2FA expirée. Reconnectez-vous." };

  const challenge = await prisma.twoFactorChallenge.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!challenge || challenge.expiresAt < new Date()) {
    await clearTwoFactorCookie();
    return { error: "Jeton 2FA expiré (5 minutes). Reconnectez-vous." };
  }
  if (!challenge.user.twoFactorSecret) return { error: "2FA non initialisé." };

  const secret = decryptSecret(challenge.user.twoFactorSecret);
  if (!verifyTotp(code, secret) && !isDemoTwoFactorPin(code)) {
    return { error: "Code invalide." };
  }

  if (!challenge.user.is2FAEnabled) {
    await prisma.user.update({
      where: { id: challenge.user.id },
      data: { is2FAEnabled: true },
    });
  }

  await prisma.twoFactorChallenge.deleteMany({ where: { userId: challenge.user.id } });
  await clearTwoFactorCookie();

  const jwt = await signSession({
    userId: challenge.user.id,
    tenantId: challenge.user.tenantId,
    role: challenge.user.role,
    email: challenge.user.email,
    fullName: challenge.user.fullName,
    departmentId: challenge.user.departmentId,
  });
  await setSessionCookie(jwt);
  const meta = await getRequestMeta();
  await prisma.auditLog.create({
    data: {
      action: "LOGIN",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      userEmail: challenge.user.email,
      userId: challenge.user.id,
      tenantId: challenge.user.tenantId,
    },
  });
  redirect("/documents");
}

export async function logoutAction() {
  await clearSessionCookie();
  await clearTwoFactorCookie();
  redirect("/login");
}
