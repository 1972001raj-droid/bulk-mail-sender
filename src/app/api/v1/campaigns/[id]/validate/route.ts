import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { runPreflightValidation } from "@/lib/email/preflight";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      include: {
        sender: true,
        recipients: {
          include: { contact: true }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const recipientsData = campaign.recipients.map((r) => ({
      email: r.emailSnapshot,
      firstName: r.contact.firstName,
      lastName: r.contact.lastName,
      company: r.contact.company,
      title: r.contact.title,
      customFields: r.contact.customFieldsJson ? JSON.parse(r.contact.customFieldsJson) : {}
    }));

    const validation = runPreflightValidation({
      sender: campaign.sender,
      subject: campaign.subject,
      htmlBody: campaign.htmlBody,
      recipients: recipientsData
    });

    // Update campaign status to READY if valid and currently DRAFT
    if (validation.canSend && campaign.status === "DRAFT") {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "READY" }
      });
    }

    return NextResponse.json({
      success: true,
      canSend: validation.canSend,
      checks: validation.checks,
      stats: validation.stats
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
