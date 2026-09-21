import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      include: {
        sender: true,
        recipients: {
          include: {
            contact: true,
            messages: {
              include: { events: true },
              orderBy: { createdAt: "desc" }
            }
          },
          orderBy: { updatedAt: "desc" }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const recipients = campaign.recipients;
    const total = recipients.length;

    let sent = 0;
    let delivered = 0;
    let opened = 0;
    let clicked = 0;
    let replied = 0;
    let bounced = 0;
    let failed = 0;

    const allEvents: any[] = [];

    for (const r of recipients) {
      if (["SENT", "OPENED", "CLICKED", "REPLIED"].includes(r.status)) {
        sent++;
        delivered++;
      }
      if (["OPENED", "CLICKED", "REPLIED"].includes(r.status)) {
        opened++;
      }
      if (["CLICKED", "REPLIED"].includes(r.status)) {
        clicked++;
      }
      if (r.status === "REPLIED") {
        replied++;
      }
      if (r.status === "BOUNCED") {
        bounced++;
      }
      if (r.status === "FAILED") {
        failed++;
      }

      for (const msg of r.messages) {
        for (const ev of msg.events) {
          allEvents.push({
            id: ev.id,
            type: ev.eventType,
            occurredAt: ev.occurredAt,
            recipientEmail: r.emailSnapshot,
            recipientName: [r.contact.firstName, r.contact.lastName].filter(Boolean).join(" "),
            metadata: ev.metadataJson ? JSON.parse(ev.metadataJson) : {}
          });
        }
      }
    }

    allEvents.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0";
    const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0";
    const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0";
    const bounceRate = total > 0 ? ((bounced / total) * 100).toFixed(1) : "0";

    return NextResponse.json({
      success: true,
      metrics: {
        total,
        sent,
        delivered,
        opened,
        clicked,
        replied,
        bounced,
        failed,
        openRate,
        clickRate,
        replyRate,
        bounceRate
      },
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        senderEmail: campaign.sender?.email,
        createdAt: campaign.createdAt
      },
      recipients: recipients.map((r) => ({
        id: r.id,
        email: r.emailSnapshot,
        name: [r.contact.firstName, r.contact.lastName].filter(Boolean).join(" ") || r.emailSnapshot,
        company: r.contact.company || "-",
        status: r.status,
        providerMessageId: r.providerMessageId,
        lastError: r.lastError,
        updatedAt: r.updatedAt,
        messagesCount: r.messages.length
      })),
      recentEvents: allEvents.slice(0, 50)
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
