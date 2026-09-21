import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      include: {
        sender: { include: { providerAccounts: true } },
        contactList: true,
        sequence: { include: { steps: true } },
        recipients: {
          include: { contact: true },
          take: 100
        },
        _count: {
          select: { recipients: true }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    // Aggregate recipient metrics
    const recipientGroups = await prisma.campaignRecipient.groupBy({
      by: ["status"],
      where: { campaignId: campaign.id },
      _count: { status: true }
    });

    const statusCounts: Record<string, number> = {};
    recipientGroups.forEach((g) => {
      statusCounts[g.status] = g._count.status;
    });

    const total = campaign._count.recipients;
    const sent = (statusCounts["SENT"] || 0) + (statusCounts["OPENED"] || 0) + (statusCounts["CLICKED"] || 0) + (statusCounts["REPLIED"] || 0);
    const opened = (statusCounts["OPENED"] || 0) + (statusCounts["CLICKED"] || 0) + (statusCounts["REPLIED"] || 0);
    const clicked = (statusCounts["CLICKED"] || 0) + (statusCounts["REPLIED"] || 0);
    const replied = statusCounts["REPLIED"] || 0;
    const bounced = statusCounts["BOUNCED"] || 0;
    const failed = statusCounts["FAILED"] || 0;

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        metrics: {
          total,
          sent,
          opened,
          clicked,
          replied,
          bounced,
          failed,
          openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0",
          clickRate: sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0",
          replyRate: sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0"
        }
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const { name, senderId, contactListId, sequenceId, subject, htmlBody, textBody, timezone, scheduledAt } = body;

    const campaign = await prisma.campaign.update({
      where: { id: params.id, organizationId: session.organizationId },
      data: {
        name: name !== undefined ? name : undefined,
        senderId: senderId !== undefined ? senderId : undefined,
        contactListId: contactListId !== undefined ? contactListId : undefined,
        sequenceId: sequenceId !== undefined ? sequenceId : undefined,
        subject: subject !== undefined ? subject : undefined,
        htmlBody: htmlBody !== undefined ? htmlBody : undefined,
        textBody: textBody !== undefined ? textBody : undefined,
        timezone: timezone !== undefined ? timezone : undefined,
        scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : undefined
      }
    });

    return NextResponse.json({ success: true, campaign });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
