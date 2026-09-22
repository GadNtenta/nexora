import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const tenant = await prisma.tenant.upsert({
    where: { slug: "acme" },
    update: {},
    create: {
      name: "Acme Industrie",
      slug: "acme",
      storagePrefix: "acme",
    },
  });

  const department = await prisma.department.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Direction juridique" } },
    update: {},
    create: {
      name: "Direction juridique",
      tenantId: tenant.id,
    },
  });

  const root = await prisma.folder.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: { name: "Documents", tenantId: tenant.id, departmentId: null, minViewRole: "LECTEUR" },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Documents",
      tenantId: tenant.id,
      departmentId: null,
      minViewRole: "LECTEUR",
    },
  });

  const confidential = await prisma.folder.upsert({
    where: { id: "00000000-0000-4000-8000-000000000002" },
    update: {
      name: "Confidentiel",
      parentId: root.id,
      tenantId: tenant.id,
      departmentId: department.id,
      minViewRole: "EDITEUR",
    },
    create: {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Confidentiel",
      parentId: root.id,
      tenantId: tenant.id,
      departmentId: department.id,
      minViewRole: "EDITEUR",
    },
  });

  await prisma.folderPermission.upsert({
    where: { folderId_role: { folderId: confidential.id, role: Role.EDITEUR } },
    update: { canView: true, canEdit: false, canDelete: false, canValidate: false },
    create: {
      folderId: confidential.id,
      role: Role.EDITEUR,
      canView: true,
      canEdit: false,
      canDelete: false,
      canValidate: false,
    },
  });

  const users: Array<{ email: string; fullName: string; role: Role }> = [
    { email: "lecteur@acme.local", fullName: "Léa Lecteur", role: Role.LECTEUR },
    { email: "editeur@acme.local", fullName: "Émile Éditeur", role: Role.EDITEUR },
    { email: "validateur@acme.local", fullName: "Vera Validateur", role: Role.VALIDATEUR },
    { email: "admin@acme.local", fullName: "Adam Admin", role: Role.ADMIN_ESPACE },
    { email: "super@acme.local", fullName: "Sophie Super", role: Role.SUPER_ADMIN },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        role: u.role,
        tenantId: tenant.id,
        departmentId: department.id,
        passwordHash,
      },
      create: {
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        tenantId: tenant.id,
        departmentId: department.id,
        passwordHash,
        is2FAEnabled: false,
      },
    });
  }

  await prisma.tag.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "contrat" } },
    update: {},
    create: { tenantId: tenant.id, name: "contrat" },
  });

  console.log("Seed OK");
  console.log("Comptes démo (mot de passe: Password123!)");
  users.forEach((u) => console.log(`  ${u.role.padEnd(14)} ${u.email}`));
  console.log("Premier login: configuration 2FA via QR code.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
