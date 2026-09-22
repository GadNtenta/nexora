import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function notifyUser(params: {
  userId: string;
  title: string;
  body: string;
  href?: string;
  email?: string;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      body: params.body,
      href: params.href,
    },
  });

  const config = env();
  const to = params.email;
  if (!to) return;

  const text = `${params.body}\n\n${params.href ? `${config.APP_URL}${params.href}` : ""}`;

  if (!config.SMTP_HOST) {
    console.info("[mail:dev]", { to, subject: params.title, text });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT ?? 587,
    secure: (config.SMTP_PORT ?? 587) === 465,
    auth: config.SMTP_USER
      ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: config.SMTP_FROM ?? "DocuShield AI <noreply@localhost>",
    to,
    subject: params.title,
    text,
  });
}
