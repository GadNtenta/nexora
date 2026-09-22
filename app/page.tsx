import Link from "next/link";
import { Shield, Lock, ScanText, Search, ScrollText, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollToModulesButton } from "@/components/marketing/scroll-to-modules-button";

const MODULES = [
  {
    icon: Lock,
    code: "A",
    title: "Authentification & RBAC",
    text: "Connexion 2FA TOTP, rôles Lecteur à Super Admin, héritage dossier et overrides document.",
  },
  {
    icon: ScanText,
    code: "B",
    title: "Acquisition & OCR",
    text: "Dépôt PDF / Word / PNG / JPEG, hash SHA-256, stockage MinIO, OCR et édition Word dans l’app.",
  },
  {
    icon: Search,
    code: "C",
    title: "Recherche plein texte",
    text: "Palette Cmd+K, to_tsquery PostgreSQL, extraits surlignés et filtres multicritères.",
  },
  {
    icon: ScrollText,
    code: "D",
    title: "Audit & filigrane",
    text: "Journal immuable (VIEW, DOWNLOAD, UPDATE…) et visionneuse avec filigrane email / date / IP.",
  },
  {
    icon: GitBranch,
    code: "E",
    title: "Versions & validation",
    text: "Historique v1.0 → v1.1, restauration admin et circuit Soumission / Validé / Rejeté.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e4efe8,_#f7f6f3_45%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-semibold">DocuShield AI</span>
        </div>
        <Button asChild>
          <Link href="/login">Se connecter</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">GED intelligente & souveraine</p>
        <h1 className="font-serif mt-3 max-w-3xl text-4xl leading-tight md:text-6xl">
          Vos documents, protégés, indexés, tracés.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Authentification 2FA, OCR Tesseract, recherche PostgreSQL, journal d&apos;audit immuable et circuit de
          validation. Déploiement SaaS multi-tenant ou on-premise.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/login">Accéder à l&apos;espace</Link>
          </Button>
          <ScrollToModulesButton />
        </div>
        <section id="modules" aria-labelledby="modules-heading" className="mt-24 scroll-mt-8">
          <h2 id="modules-heading" className="text-2xl font-semibold">
            Modules
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Les cinq piliers de la plateforme, de l&apos;accès à la validation.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((item) => (
              <article key={item.code} className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <item.icon className="h-6 w-6 text-primary" aria-hidden />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Module {item.code}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
