import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { renderPersonalizedText, extractVariables } from "@/lib/email/personalization";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const body = await req.json().catch(() => ({}));
    const { recipientIndex = 0, subjectOverride, htmlBodyOverride } = body;

    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      include: {
        recipients: {
          include: { contact: true },
          take: 50
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const recipients = campaign.recipients;
    if (recipients.length === 0) {
      // Return preview with sample contact if no recipients added yet
      const sample = {
        email: "sarah.connor@techflow.io",
        firstName: "Sarah",
        lastName: "Connor",
        company: "TechFlow",
        title: "CEO",
        customFields: { city: "San Francisco", dealSize: "$45k" }
      };

      const subj = subjectOverride !== undefined ? subjectOverride : campaign.subject || "";
      const bodyHtml = htmlBodyOverride !== undefined ? htmlBodyOverride : campaign.htmlBody || "";

      return NextResponse.json({
        success: true,
        preview: {
          recipientIndex: 0,
          totalRecipients: 0,
          recipient: sample,
          subject: renderPersonalizedText(subj, sample),
          htmlBody: renderPersonalizedText(bodyHtml, sample),
          variablesDetected: Array.from(new Set([...extractVariables(subj), ...extractVariables(bodyHtml)]))
        }
      });
    }

    const safeIndex = Math.min(Math.max(0, recipientIndex), recipients.length - 1);
    const targetRecipient = recipients[safeIndex];
    const contact = targetRecipient.contact;

    const recipientData = {
      email: targetRecipient.emailSnapshot,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      title: contact.title,
      customFields: contact.customFieldsJson ? JSON.parse(contact.customFieldsJson) : {}
    };

    const subj = subjectOverride !== undefined ? subjectOverride : campaign.subject || "";
    const bodyHtml = htmlBodyOverride !== undefined ? htmlBodyOverride : campaign.htmlBody || "";

    const renderedSubject = renderPersonalizedText(subj, recipientData);
    const renderedHtml = renderPersonalizedText(bodyHtml, recipientData);

    return NextResponse.json({
      success: true,
      preview: {
        recipientIndex: safeIndex,
        totalRecipients: recipients.length,
        recipient: recipientData,
        subject: renderedSubject,
        htmlBody: renderedHtml,
        variablesDetected: Array.from(new Set([...extractVariables(subj), ...extractVariables(bodyHtml)]))
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
