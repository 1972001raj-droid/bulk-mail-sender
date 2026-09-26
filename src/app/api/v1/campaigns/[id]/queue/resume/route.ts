import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { rapidQueueEngine } from "@/lib/queue/rapid-queue";

/**
 * POST /api/v1/campaigns/[id]/queue/resume
 * Resumes worker dispatch for a paused campaign.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    await rapidQueueEngine.resumeCampaign(campaign.id);
    const metrics = await rapidQueueEngine.getStatus(campaign.id);

    return NextResponse.json({
      success: true,
      message: "Campaign queue resumed",
      metrics,
    });
  } catch (err: any) {
    console.error("[Queue Resume API] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
