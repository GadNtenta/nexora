import { NextRequest, NextResponse } from "next/server";
import { processOcrJob, processPendingOcrJobs } from "@/lib/ocr/worker";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-ocr-secret");
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (process.env.NODE_ENV === "production" && secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (jobId) {
    await processOcrJob(jobId);
    return NextResponse.json({ ok: true, jobId });
  }
  const count = await processPendingOcrJobs();
  return NextResponse.json({ ok: true, processed: count });
}

export async function GET() {
  const count = await processPendingOcrJobs(1);
  return NextResponse.json({ ok: true, processed: count });
}
