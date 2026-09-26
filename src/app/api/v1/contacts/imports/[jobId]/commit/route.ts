import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { VerificationJobEngine } from "@/lib/verification/job-engine";
import { ImportPolicy } from "@/lib/verification/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getSessionContext();
    const jobId = params.jobId;
    const body = await req.json();
    const { importPolicy = "SAFE", targetListId, targetListName } = body;

    const validPolicies: ImportPolicy[] = ["SAFE", "SAFE_RISKY", "SAFE_RISKY_UNKNOWN", "ALL"];
    const policy: ImportPolicy = validPolicies.includes(importPolicy) ? importPolicy : "SAFE";

    const result = await VerificationJobEngine.commitImport(
      jobId,
      session.organizationId,
      policy,
      targetListId,
      targetListName
    );

    return NextResponse.json({
      success: true,
      imported: result.importedCount,
      skipped: result.skippedCount,
      listId: result.listId
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
