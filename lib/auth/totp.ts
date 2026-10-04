import { authenticator } from "otplib";

authenticator.options = {
  digits: 6,
  step: 30,
  window: 2,
};

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpKeyUri(email: string, secret: string): string {
  return authenticator.keyuri(email, "DocuShield AI", secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  return authenticator.check(token.replace(/\s/g, ""), secret);
}

/** PIN 2FA de démo (Vercel inclus). Désactiver avec DEMO_2FA_PIN=off. */
export const DEMO_2FA_PIN = "123456";

export function demoTwoFactorPin(): string | null {
  const raw = process.env.DEMO_2FA_PIN;
  if (raw === "off" || raw === "false" || raw === "0") return null;
  const pin = (raw ?? DEMO_2FA_PIN).trim();
  if (!/^\d{6}$/.test(pin)) return null;
  return pin;
}

export function isDemoTwoFactorPin(token: string): boolean {
  const pin = demoTwoFactorPin();
  if (!pin) return false;
  return token.replace(/\s/g, "") === pin;
}
