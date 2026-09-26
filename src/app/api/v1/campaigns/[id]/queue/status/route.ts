import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { rapidQueueEngine } from "@/lib/queue/rapid-queue";

/**
 * GET /api/v1/campaigns/[id]/queue/status
 * Returns real-time metrics, active worker statuses, throughput, and estimated completion.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const metrics = await rapidQueueEngine.getStatus(campaign.id);

    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (err: any) {
    console.error("[Queue Status API] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
