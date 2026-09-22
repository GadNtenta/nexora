"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { canManageUsers } from "@/lib/auth/rbac";

const userSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(["LECTEUR", "EDITEUR", "VALIDATEUR", "ADMIN_ESPACE", "SUPER_ADMIN"]),
  departmentId: z.string().optional(),
  password: z.string().min(8),
});

export async function createUserAction(formData: FormData) {
  const session = await requireSession();
  if (!canManageUsers(session.role)) throw new Error("FORBIDDEN");

  const parsed = userSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || undefined,
    password: formData.get("password"),
  });
  if (!parsed.success) throw new Error("Données utilisateur invalides");
  if (parsed.data.role === Role.SUPER_ADMIN && session.role !== Role.SUPER_ADMIN) {
    throw new Error("FORBIDDEN");
  }

  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        fullName: parsed.data.fullName,
        role: parsed.data.role,
        departmentId: parsed.data.departmentId,
        tenantId: session.tenantId,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      throw new Error("Cette adresse e-mail est déjà utilisée.");
    }
    throw error;
  }
  revalidatePath("/settings/users");
}

export async function createDepartmentAction(formData: FormData) {
  const session = await requireSession();
  if (!canManageUsers(session.role)) throw new Error("FORBIDDEN");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nom requis");
  try {
    await prisma.department.create({
      data: { name, tenantId: session.tenantId },
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      throw new Error("Un département porte déjà ce nom.");
    }
    throw error;
  }
  revalidatePath("/settings/departments");
}

export async function updateDepartmentAction(formData: FormData) {
  const session = await requireSession();
  if (!canManageUsers(session.role)) throw new Error("FORBIDDEN");
  const id = String(formData.get("departmentId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) throw new Error("Département invalide");
  try {
    const result = await prisma.department.updateMany({
      where: { id, tenantId: session.tenantId },
      data: { name },
    });
    if (result.count === 0) throw new Error("Département introuvable");
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      throw new Error("Un département porte déjà ce nom.");
    }
    throw error;
  }
  revalidatePath("/settings/departments");
}

export async function deleteDepartmentAction(formData: FormData) {
  const session = await requireSession();
  if (!canManageUsers(session.role)) throw new Error("FORBIDDEN");
  const id = String(formData.get("departmentId") ?? "");
  const dept = await prisma.department.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { _count: { select: { users: true, documents: true, folders: true } } },
  });
  if (!dept) throw new Error("Département introuvable");
  if (dept._count.users + dept._count.documents + dept._count.folders > 0) {
    throw new Error("Impossible de supprimer : des utilisateurs, dossiers ou documents y sont encore liés.");
  }
  await prisma.department.delete({ where: { id } });
  revalidatePath("/settings/departments");
}

export async function updateUserAction(formData: FormData) {
  const session = await requireSession();
  if (!canManageUsers(session.role)) throw new Error("FORBIDDEN");
  const id = String(formData.get("userId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  const departmentId = String(formData.get("departmentId") ?? "") || null;
  const password = String(formData.get("password") ?? "");
  if (!id || !fullName || !role) throw new Error("Utilisateur invalide");
  if (role === Role.SUPER_ADMIN && session.role !== Role.SUPER_ADMIN) throw new Error("FORBIDDEN");

  const user = await prisma.user.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!user) throw new Error("Utilisateur introuvable");

  await prisma.user.update({
    where: { id },
    data: {
      fullName,
      role,
      departmentId,
      ...(password.length >= 8 ? { passwordHash: await hashPassword(password) } : {}),
    },
  });
  revalidatePath("/settings/users");
}

export async function deleteUserAction(formData: FormData) {
  const session = await requireSession();
  if (!canManageUsers(session.role)) throw new Error("FORBIDDEN");
  const id = String(formData.get("userId") ?? "");
  if (id === session.userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  const user = await prisma.user.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!user) throw new Error("Utilisateur introuvable");
  if (user.role === Role.SUPER_ADMIN && session.role !== Role.SUPER_ADMIN) throw new Error("FORBIDDEN");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/settings/users");
}
