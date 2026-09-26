import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { rapidQueueEngine } from "@/lib/queue/rapid-queue";

/**
 * POST /api/v1/campaigns/[id]/queue/pause
 * Safely pauses worker dispatch for the campaign.
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

    await rapidQueueEngine.pauseCampaign(campaign.id);
    const metrics = await rapidQueueEngine.getStatus(campaign.id);

    return NextResponse.json({
      success: true,
      message: "Campaign queue paused",
      metrics,
    });
  } catch (err: any) {
    console.error("[Queue Pause API] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
