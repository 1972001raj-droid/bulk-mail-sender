import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF bytes
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const msgId = searchParams.get("msgId");

    if (msgId) {
      const message = await prisma.emailMessage.findUnique({
        where: { id: msgId },
        include: { campaignRecipient: true }
      });

      if (message) {
        // Record immutable open event
        await prisma.emailEvent.create({
          data: {
            emailMessageId: message.id,
            eventType: "EMAIL_OPENED",
            metadataJson: JSON.stringify({
              ip: req.headers.get("x-forwarded-for") || req.ip || "unknown",
              userAgent: req.headers.get("user-agent") || "unknown"
            })
          }
        });

        // Update recipient state if not already CLICKED or REPLIED
        if (["SENT", "QUEUED", "PENDING"].includes(message.campaignRecipient.status)) {
          await prisma.campaignRecipient.update({
            where: { id: message.campaignRecipientId },
            data: { status: "OPENED" }
          });
        }
      }
    }
  } catch (e) {
    console.error("Open tracking error:", e);
  }

  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}
