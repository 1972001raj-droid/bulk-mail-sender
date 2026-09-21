import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const msgId = searchParams.get("msgId");
  const target = searchParams.get("target");

  const destination = target ? decodeURIComponent(target) : "/";

  if (msgId) {
    try {
      const message = await prisma.emailMessage.findUnique({
        where: { id: msgId },
        include: { campaignRecipient: true }
      });

      if (message) {
        await prisma.emailEvent.create({
          data: {
            emailMessageId: message.id,
            eventType: "LINK_CLICKED",
            metadataJson: JSON.stringify({
              targetUrl: destination,
              ip: req.headers.get("x-forwarded-for") || req.ip || "unknown",
              userAgent: req.headers.get("user-agent") || "unknown"
            })
          }
        });

        // Update recipient state to CLICKED (unless already REPLIED)
        if (message.campaignRecipient.status !== "REPLIED") {
          await prisma.campaignRecipient.update({
            where: { id: message.campaignRecipientId },
            data: { status: "CLICKED" }
          });
        }
      }
    } catch (e) {
      console.error("Click tracking error:", e);
    }
  }

  // Redirect to original destination
  return NextResponse.redirect(destination, 302);
}
