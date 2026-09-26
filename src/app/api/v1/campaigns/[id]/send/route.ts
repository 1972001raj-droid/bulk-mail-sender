import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { DeliveryEngine } from "@/lib/queue/engine";
import { rapidQueueEngine } from "@/lib/queue/rapid-queue";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, organizationId: session.organizationId }
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    // Check Feature Flag for Rapid Email Queue
    const isRapidQueueEnabled = process.env.RAPID_EMAIL_QUEUE_ENABLED === "true";

    if (isRapidQueueEnabled) {
      // Execute via Rapid Email Queue layer
      await rapidQueueEngine.enqueueCampaign(campaign.id);
      const metrics = await rapidQueueEngine.getStatus(campaign.id);

      return NextResponse.json({
        success: true,
        mode: "rapid_queue",
        status: metrics.status,
        metrics
      });
    }

    // Backward Compatible Fallback: Existing Sending Engine
    if (campaign.status !== "RUNNING") {
      await DeliveryEngine.startCampaign(campaign.id);
    }

    // Process first batch immediately
    const batchResult = await DeliveryEngine.processCampaignBatch(campaign.id, 50);

    // Get current counts
    const counts = await prisma.campaignRecipient.groupBy({
      by: ["status"],
      where: { campaignId: campaign.id },
      _count: { status: true }
    });

    const updatedCampaign = await prisma.campaign.findUnique({
      where: { id: campaign.id }
    });

    return NextResponse.json({
      success: true,
      mode: "legacy_batch",
      status: updatedCampaign?.status,
      batch: batchResult,
      counts
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

