import { authenticator } from "otplib";

authenticator.options = {
  digits: 6,
  step: 30,
  window: 1,
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

/** PIN 2FA de démo, accepté uniquement hors production. */
export const DEMO_2FA_PIN = "123456";

export function isDemoTwoFactorPin(token: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return token.replace(/\s/g, "") === (process.env.DEMO_2FA_PIN || DEMO_2FA_PIN);
}
