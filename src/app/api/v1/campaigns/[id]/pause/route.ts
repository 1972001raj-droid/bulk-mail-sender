import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, organizationId: session.organizationId }
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const newStatus = campaign.status === "RUNNING" ? "PAUSED" : "RUNNING";

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: newStatus }
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: newStatus === "PAUSED" ? "CAMPAIGN_PAUSED" : "CAMPAIGN_RESUMED",
        entityType: "campaign",
        entityId: campaign.id
      }
    });

    return NextResponse.json({ success: true, status: updated.status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
