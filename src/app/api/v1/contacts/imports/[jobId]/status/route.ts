import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { VerificationJobEngine } from "@/lib/verification/job-engine";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getSessionContext();
    const jobId = params.jobId;

    if (!jobId) {
      return NextResponse.json({ success: false, error: "Job ID is required" }, { status: 400 });
    }

    const progress = await VerificationJobEngine.getJobProgress(jobId, session.organizationId);

    if (!progress) {
      return NextResponse.json({ success: false, error: "Verification job not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...progress
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
