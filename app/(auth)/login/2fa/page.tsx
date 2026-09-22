import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTwoFactorSetup } from "@/app/actions/auth";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { BackLink } from "@/components/layout/back-link";

export const metadata: Metadata = { title: "Vérification 2FA" };

export default async function TwoFactorPage() {
  const setup = await getTwoFactorSetup();
  if (!setup) redirect("/login");
  return (
    <div className="space-y-4">
      <BackLink href="/login" label="Connexion" />
      <TwoFactorForm
        setup={setup.setup}
        qrDataUrl={setup.setup ? setup.qrDataUrl : undefined}
        email={setup.email}
        demoPin={setup.demoPin}
      />
    </div>
  );
}
