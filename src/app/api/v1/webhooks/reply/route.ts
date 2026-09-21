import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientId, email, replySnippet } = body;

    let targetRecipient;
    if (recipientId) {
      targetRecipient = await prisma.campaignRecipient.findUnique({
        where: { id: recipientId },
        include: {
          messages: { take: 1, orderBy: { createdAt: "desc" } }
        }
      });
    } else if (email) {
      targetRecipient = await prisma.campaignRecipient.findFirst({
        where: { emailSnapshot: email.toLowerCase() },
        include: {
          messages: { take: 1, orderBy: { createdAt: "desc" } }
        },
        orderBy: { createdAt: "desc" }
      });
    }

    if (!targetRecipient) {
      return NextResponse.json({ success: false, error: "Recipient not found" }, { status: 404 });
    }

    // 1. Mark recipient as REPLIED
    await prisma.campaignRecipient.update({
      where: { id: targetRecipient.id },
      data: { status: "REPLIED" }
    });

    // 2. Stop follow-up sequence immediately (Document 03 Section 8)
    await prisma.sequenceEnrollment.updateMany({
      where: { campaignRecipientId: targetRecipient.id },
      data: { status: "STOPPED" }
    });

    // 3. Record REPLY_DETECTED event
    if (targetRecipient.messages[0]) {
      await prisma.emailEvent.create({
        data: {
          emailMessageId: targetRecipient.messages[0].id,
          eventType: "REPLY_DETECTED",
          metadataJson: JSON.stringify({
            snippet: replySnippet || "Interested in learning more, thanks!",
            detectedAt: new Date().toISOString()
          })
        }
      });
    }

    return NextResponse.json({
      success: true,
      recipientId: targetRecipient.id,
      status: "REPLIED",
      sequenceStatus: "STOPPED"
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
