"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { loginAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {} as AuthState);

  return (
    <form action={action} className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Shield className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">DocuShield AI</p>
          <h1 className="text-xl font-semibold">Connexion sécurisée</h1>
        </div>
      </div>
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Identifiant</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="prenom.nom@entreprise.fr" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Vérification…" : "Continuer vers le 2FA"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Démo : mot de passe <span className="font-mono">Password123!</span>, code 2FA{" "}
        <span className="font-mono">123456</span>.{" "}
        <Link href="/" className="underline">
          Retour à l&apos;accueil
        </Link>
      </p>
    </form>
  );
}
