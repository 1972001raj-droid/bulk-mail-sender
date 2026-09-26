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

    const job = await prisma.emailVerificationJob.findFirst({
      where: { id: jobId, organizationId: session.organizationId },
      include: { records: true }
    });

    if (!job) {
      return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
    }

    const mappings: Record<string, string> = job.mappingsJson ? JSON.parse(job.mappingsJson) : {};

    // Helper to escape CSV values
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const header = [
      "Email Address",
      "Verification Status",
      "Reason",
      "First Name",
      "Last Name",
      "Company",
      "Job Title",
      "Checked At"
    ].join(",");

    const lines = job.records.map((r) => {
      const row = r.rawRowJson ? JSON.parse(r.rawRowJson) : {};
      const firstName = mappings.firstName ? row[mappings.firstName] : "";
      const lastName = mappings.lastName ? row[mappings.lastName] : "";
      const company = mappings.company ? row[mappings.company] : "";
      const title = mappings.title ? row[mappings.title] : "";

      return [
        escapeCsv(r.email),
        escapeCsv(r.status),
        escapeCsv(r.reason),
        escapeCsv(firstName),
        escapeCsv(lastName),
        escapeCsv(company),
        escapeCsv(title),
        escapeCsv(r.createdAt.toISOString())
      ].join(",");
    });

    const csvContent = [header, ...lines].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="verification-results-${jobId.substring(0, 8)}.csv"`
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
