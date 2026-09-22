# DocuShield AI

Plateforme GED intelligente et souveraine (SaaS multi-tenant / on-premise).

Stack : Next.js 15 (App Router), TypeScript strict, Tailwind CSS, shadcn/ui, PostgreSQL + Prisma, stockage S3 (Supabase Storage), Tesseract.js, otplib.

## Démarrage (Supabase)

1. Crée un projet [Supabase](https://supabase.com) (région `eu-central-1` recommandée).
2. Active l’extension `unaccent` (Database → Extensions).
3. Crée un bucket Storage **privé** nommé `docushield`.
4. Génère des clés S3 (Storage → S3) et copie les URI Postgres **pooler** (Settings → Database).

```bash
cp .env.example .env
# Renseigne DATABASE_URL, DIRECT_URL et les variables S3_
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

- Application : http://localhost:3000
- `DATABASE_URL` : pooler transactionnel (port **6543**, `?pgbouncer=true`)
- `DIRECT_URL` : pooler session (port **5432**) pour les migrations
- Fichiers : `S3_ENDPOINT=https://<PROJECT_REF>.supabase.co/storage/v1/s3`

Ne commite jamais `.env`. Après un collage de secrets (chat, ticket…), rotate le mot de passe DB et le jeton S3.

Verrouiller l’API REST PostgREST (une fois les migrations appliquées) :

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
```

L’auth de l’app (JWT + TOTP) reste interne. N’ajoute pas `NEXT_PUBLIC_SUPABASE_*`.

### Optionnel : Postgres + MinIO en local

```bash
docker compose up -d
```

Pointe alors `DATABASE_URL` / `DIRECT_URL` vers `localhost:5432` et `S3_ENDPOINT` vers `http://127.0.0.1:9000`.

## Comptes de démonstration

Mot de passe commun : `Password123!`

| Rôle | E-mail |
|---|---|
| Lecteur | lecteur@acme.local |
| Éditeur | editeur@acme.local |
| Validateur | validateur@acme.local |
| Admin espace | admin@acme.local |
| Super admin | super@acme.local |

Code 2FA de démo (hors production) : `123456`

Vous pouvez aussi scanner le QR avec Google Authenticator ou Authy.

## Modules

- **A** — Auth 2FA TOTP (jeton 5 min) + RBAC (héritage dossier, overrides, Confidentiel en lecture seule pour Éditeur)
- **B** — Upload UUID + SHA-256 → S3 `tenants/{tenantId}/{uuid}` + OCR asynchrone
- **C** — Recherche `plainto_tsquery` / `ts_headline` (Cmd+K) + filtres
- **D** — `AuditLog` immuable (trigger SQL) + visionneuse filigrane
- **E** — Versions (restauration = nouvelle version) + circuit Soumission / Validé / Rejeté

## OCR manuel

Si l'OCR n'a pas tourné en arrière-plan :

```bash
curl -X POST http://localhost:3000/api/ocr/worker
```
