import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  classifyRemoteFetch,
  privacySafeRequestMetadata,
  resolveTrackingToken,
} from "@/lib/email/tracking";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const trackingToken = await resolveTrackingToken(params.token, "CLICK").catch(() => null);
  if (!trackingToken?.emailMessage || !trackingToken.destinationUrl) {
    return new NextResponse("Not found", { status: 404 });
  }

  let destination: URL;
  try {
    destination = new URL(trackingToken.destinationUrl);
    if (!["https:", "http:"].includes(destination.protocol)) throw new Error("Invalid destination");
  } catch {
    return new NextResponse("Invalid destination", { status: 400 });
  }

  try {
    const quality = classifyRemoteFetch(req.headers.get("user-agent"));
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.emailEvent.create({
        data: {
          emailMessageId: trackingToken.emailMessageId!,
          eventType: "LINK_CLICKED",
          source: "PIXEL",
          quality,
          metadataJson: JSON.stringify({
            destinationHost: destination.host,
            ...JSON.parse(privacySafeRequestMetadata(req)),
          }),
        },
      });

      if (quality !== "QUALIFIED") return;
      await tx.emailMessage.update({
        where: { id: trackingToken.emailMessageId! },
        data: {
          firstClickedAt: trackingToken.emailMessage.firstClickedAt || now,
          lastClickedAt: now,
          qualifiedClickCount: { increment: 1 },
        },
      });

      if (trackingToken.campaignRecipient.status !== "REPLIED") {
        await tx.campaignRecipient.update({
          where: { id: trackingToken.campaignRecipientId },
          data: { status: "CLICKED" },
        });
      }
      await tx.sequenceEnrollment.updateMany({
        where: { campaignRecipientId: trackingToken.campaignRecipientId, status: "ACTIVE" },
        data: { lastQualifiedEventAt: now, branchKey: "CLICKED" },
      });
    });
  } catch (error) {
    console.error("Click tracking error", error);
  }

  return NextResponse.redirect(destination, 302);
}
