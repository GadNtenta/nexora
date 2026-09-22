import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/storage/minio";
import { runOcr } from "@/lib/ocr/tesseract";
import { mergeDocumentTags } from "@/lib/ocr/tags";
import { OcrJobStatus } from "@prisma/client";

const STALE_RUNNING_MS = 10 * 60 * 1000;

export async function processOcrJob(jobId: string) {
  const job = await prisma.ocrJob.findUnique({
    where: { id: jobId },
    include: { document: { include: { tags: true } } },
  });
  if (!job) return;
  if (job.status === OcrJobStatus.DONE) return;
  if (
    job.status === OcrJobStatus.RUNNING &&
    Date.now() - job.updatedAt.getTime() < STALE_RUNNING_MS
  ) {
    return;
  }

  await prisma.ocrJob.update({
    where: { id: jobId },
    data: { status: OcrJobStatus.RUNNING, error: null },
  });

  try {
    const buffer = await getObjectBuffer(job.document.fileUrl);
    const result = await runOcr({
      buffer,
      mimeType: job.document.mimeType,
      fallbackTitle: job.document.title,
    });

    const tags = await mergeDocumentTags({
      tenantId: job.document.tenantId,
      names: result.tags,
      existingIds: job.document.tags.map((tag) => tag.id),
    });

    await prisma.document.update({
      where: { id: job.documentId },
      data: {
        extractedText: result.text || job.document.extractedText || null,
        detectedDate: result.detectedDate ?? job.document.detectedDate,
        tags: tags.length ? { set: tags } : undefined,
      },
    });

    await prisma.ocrJob.update({
      where: { id: jobId },
      data: { status: OcrJobStatus.DONE },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR failed";
    console.error("ocr job error", jobId, error);
    await prisma.ocrJob.update({
      where: { id: jobId },
      data: { status: OcrJobStatus.FAILED, error: message },
    });
  }
}

export async function processPendingOcrJobs(limit = 3) {
  const jobs = await prisma.ocrJob.findMany({
    where: { status: { in: [OcrJobStatus.PENDING, OcrJobStatus.FAILED] } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const job of jobs) {
    await processOcrJob(job.id);
  }
  return jobs.length;
}
