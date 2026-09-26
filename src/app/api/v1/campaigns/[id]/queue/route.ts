import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { rapidQueueEngine } from "@/lib/queue/rapid-queue";

/**
 * POST /api/v1/campaigns/[id]/queue
 * Starts or enqueues a campaign using the Rapid Email Queue engine.
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

    let customConfig = undefined;
    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        customConfig = body.config;
      }
    } catch {
      // Body is optional
    }

    // Trigger asynchronous queue execution
    await rapidQueueEngine.enqueueCampaign(campaign.id, customConfig);

    const status = await rapidQueueEngine.getStatus(campaign.id);

    return NextResponse.json({
      success: true,
      message: "Campaign enqueued in Rapid Email Queue",
      status,
    });
  } catch (err: any) {
    console.error("[Queue API POST] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/v1/campaigns/[id]/queue
 * Returns summary status for the campaign queue.
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

    const status = await rapidQueueEngine.getStatus(campaign.id);
    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
