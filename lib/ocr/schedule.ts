import { after } from "next/server";
import { prisma } from "@/lib/prisma";

export async function scheduleOcr(documentId: string) {
  const job = await prisma.ocrJob.create({ data: { documentId } });
  after(async () => {
    try {
      const { processOcrJob } = await import("@/lib/ocr/worker");
      await processOcrJob(job.id);
    } catch (error) {
      console.error("ocr job failed", job.id, error);
    }
  });
  return job;
}
