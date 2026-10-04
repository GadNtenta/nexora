import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchema?: string;
};

const SCHEMA_ID = "supabase-pooler-v3";

function withRequiredSsl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "30");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

if (globalForPrisma.prismaSchema !== SCHEMA_ID) {
  void globalForPrisma.prisma?.$disconnect();
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaSchema = SCHEMA_ID;
}

const databaseUrl = withRequiredSsl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
