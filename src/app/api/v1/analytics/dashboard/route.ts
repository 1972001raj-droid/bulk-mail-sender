import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionContext();
    const orgId = session.organizationId;

    const [
      campaignCount,
      contactCount,
      senderCount,
      senders,
      recentCampaigns,
      recipientStats
    ] = await Promise.all([
      prisma.campaign.count({ where: { organizationId: orgId } }),
      prisma.contact.count({ where: { organizationId: orgId } }),
      prisma.sender.count({ where: { organizationId: orgId } }),
      prisma.sender.findMany({
        where: { organizationId: orgId },
        include: { providerAccounts: true }
      }),
      prisma.campaign.findMany({
        where: { organizationId: orgId },
        include: {
          sender: true,
          _count: { select: { recipients: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      prisma.campaignRecipient.groupBy({
        by: ["status"],
        where: { campaign: { organizationId: orgId } },
        _count: { status: true }
      })
    ]);

    const statusCounts: Record<string, number> = {};
    recipientStats.forEach((s) => {
      statusCounts[s.status] = s._count.status;
    });

    const totalRecipients = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const sent = (statusCounts["SENT"] || 0) + (statusCounts["OPENED"] || 0) + (statusCounts["CLICKED"] || 0) + (statusCounts["REPLIED"] || 0);
    const opened = (statusCounts["OPENED"] || 0) + (statusCounts["CLICKED"] || 0) + (statusCounts["REPLIED"] || 0);
    const clicked = (statusCounts["CLICKED"] || 0) + (statusCounts["REPLIED"] || 0);
    const replied = statusCounts["REPLIED"] || 0;
    const bounced = statusCounts["BOUNCED"] || 0;

    const totalSentToday = senders.reduce((acc, s) => acc + s.sentToday, 0);

    return NextResponse.json({
      success: true,
      stats: {
        campaignCount,
        contactCount,
        senderCount,
        totalRecipients,
        sent,
        opened,
        clicked,
        replied,
        bounced,
        openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0",
        clickRate: sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0",
        replyRate: sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0",
        bounceRate: totalRecipients > 0 ? ((bounced / totalRecipients) * 100).toFixed(1) : "0",
        totalSentToday
      },
      senders: senders.map((s) => ({
        id: s.id,
        email: s.email,
        displayName: s.displayName,
        status: s.status,
        provider: s.providerAccounts[0]?.provider || "smtp",
        sentToday: s.sentToday
      })),
      recentCampaigns: recentCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        senderEmail: c.sender?.email || "No sender",
        recipientsCount: c._count.recipients,
        createdAt: c.createdAt
      }))
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
