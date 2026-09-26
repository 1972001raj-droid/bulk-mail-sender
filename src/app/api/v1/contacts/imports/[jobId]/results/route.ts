import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getSessionContext();
    const jobId = params.jobId;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const job = await prisma.emailVerificationJob.findFirst({
      where: { id: jobId, organizationId: session.organizationId }
    });

    if (!job) {
      return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
    }

    const where: any = { jobId };
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (search) {
      where.email = { contains: search.toLowerCase().trim() };
    }

    const records = await prisma.emailVerificationRecord.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 500
    });

    const parsedRecords = records.map((r) => ({
      id: r.id,
      email: r.email,
      status: r.status,
      reason: r.reason,
      details: r.detailsJson ? JSON.parse(r.detailsJson) : null,
      row: r.rawRowJson ? JSON.parse(r.rawRowJson) : null,
      createdAt: r.createdAt
    }));

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        total: job.total,
        processed: job.processed,
        safeCount: job.safeCount,
        riskyCount: job.riskyCount,
        invalidCount: job.invalidCount,
        unknownCount: job.unknownCount
      },
      records: parsedRecords
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
