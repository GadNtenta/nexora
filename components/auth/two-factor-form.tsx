"use client";

import { useActionState } from "react";
import { verifyTwoFactorAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TwoFactorForm({
  setup,
  qrDataUrl,
  email,
  demoPin,
}: {
  setup: boolean;
  qrDataUrl?: string;
  email: string;
  demoPin?: string | null;
}) {
  const [state, action, pending] = useActionState(verifyTwoFactorAction, {} as AuthState);

  return (
    <form action={action} className="space-y-5">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Authentification à deux facteurs</p>
        <h1 className="text-xl font-semibold">{setup ? "Initialiser votre 2FA" : "Code de vérification"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{email}</p>
      </div>
      {demoPin ? (
        <Alert>
          <AlertDescription>
            Mode démo : saisissez le code <strong className="font-mono tracking-widest">{demoPin}</strong>
          </AlertDescription>
        </Alert>
      ) : null}
      {setup && qrDataUrl ? (
        <div className="rounded-lg border bg-white p-4 text-center">
          {/* data URL : next/image n'est pas adapté */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR code d'initialisation 2FA" width={220} height={220} className="mx-auto" />
          <p className="mt-2 text-xs text-muted-foreground">
            Optionnel : scannez ce QR avec Authenticator, ou utilisez le code démo ci-dessus.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {demoPin
            ? "Saisissez le code démo ou celui de votre application Authenticator."
            : "Saisissez le code généré par votre application Authenticator. Ce jeton expire dans 5 minutes."}
        </p>
      )}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="code">Code à 6 chiffres</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          className="tracking-[0.4em] text-center text-lg"
          placeholder="••••••"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Validation…" : "Valider le code"}
      </Button>
    </form>
  );
}
