import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = { organizationId: session.organizationId };
    if (status) {
      where.status = status;
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        sender: true,
        contactList: true,
        sequence: true,
        _count: {
          select: { recipients: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Compute basic status counts for each campaign
    const enriched = await Promise.all(
      campaigns.map(async (c) => {
        const counts = await prisma.campaignRecipient.groupBy({
          by: ["status"],
          where: { campaignId: c.id },
          _count: { status: true }
        });

        const statusMap: Record<string, number> = {};
        counts.forEach((item) => {
          statusMap[item.status] = item._count.status;
        });

        return {
          ...c,
          metrics: {
            total: c._count.recipients,
            sent: (statusMap["SENT"] || 0) + (statusMap["OPENED"] || 0) + (statusMap["CLICKED"] || 0) + (statusMap["REPLIED"] || 0),
            opened: (statusMap["OPENED"] || 0) + (statusMap["CLICKED"] || 0) + (statusMap["REPLIED"] || 0),
            clicked: (statusMap["CLICKED"] || 0) + (statusMap["REPLIED"] || 0),
            replied: statusMap["REPLIED"] || 0,
            bounced: statusMap["BOUNCED"] || 0,
            failed: statusMap["FAILED"] || 0
          }
        };
      })
    );

    return NextResponse.json({ success: true, campaigns: enriched });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const {
      name,
      senderId,
      contactListId,
      contactIds,
      sequenceId,
      subject,
      htmlBody,
      textBody,
      timezone,
      scheduledAt,
      settings
    } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "Campaign name is required" }, { status: 400 });
    }

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: session.organizationId,
        name,
        senderId: senderId || null,
        contactListId: contactListId || null,
        sequenceId: sequenceId || null,
        status: scheduledAt ? "SCHEDULED" : "DRAFT",
        subject: subject || "",
        htmlBody: htmlBody || "",
        textBody: textBody || "",
        timezone: timezone || "UTC",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        settingsJson: settings ? JSON.stringify(settings) : JSON.stringify({ tracking: { opens: true, clicks: true } }),
        createdById: session.userId
      }
    });

    // Populate recipients if contactListId or contactIds provided
    let targetContactIds: string[] = [];

    if (Array.isArray(contactIds) && contactIds.length > 0) {
      targetContactIds = contactIds;
    } else if (contactListId) {
      const listMembers = await prisma.contactListMember.findMany({
        where: { listId: contactListId },
        select: { contactId: true }
      });
      targetContactIds = listMembers.map((m) => m.contactId);
    }

    if (targetContactIds.length > 0) {
      const contacts = await prisma.contact.findMany({
        where: { id: { in: targetContactIds }, status: "ACTIVE" }
      });

      for (const contact of contacts) {
        await prisma.campaignRecipient.create({
          data: {
            campaignId: campaign.id,
            contactId: contact.id,
            emailSnapshot: contact.email,
            personalizationJson: JSON.stringify({
              firstName: contact.firstName,
              lastName: contact.lastName,
              company: contact.company,
              title: contact.title,
              customFields: contact.customFieldsJson ? JSON.parse(contact.customFieldsJson) : {}
            }),
            status: "PENDING"
          }
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "CAMPAIGN_CREATED",
        entityType: "campaign",
        entityId: campaign.id,
        metadataJson: JSON.stringify({ name, recipientCount: targetContactIds.length })
      }
    });

    return NextResponse.json({ success: true, campaign });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
