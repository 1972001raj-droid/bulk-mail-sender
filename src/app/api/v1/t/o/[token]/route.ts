import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  classifyRemoteFetch,
  privacySafeRequestMetadata,
  resolveTrackingToken,
} from "@/lib/email/tracking";

export const dynamic = "force-dynamic";

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = await resolveTrackingToken(params.token, "OPEN");
    if (token?.emailMessage) {
      const quality = classifyRemoteFetch(req.headers.get("user-agent"));
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.emailEvent.create({
          data: {
            emailMessageId: token.emailMessageId!,
            eventType: "EMAIL_OPENED",
            source: "PIXEL",
            quality,
            metadataJson: privacySafeRequestMetadata(req),
          },
        });

        if (quality !== "QUALIFIED") return;

        await tx.emailMessage.update({
          where: { id: token.emailMessageId! },
          data: {
            firstOpenedAt: token.emailMessage.firstOpenedAt || now,
            lastOpenedAt: now,
            qualifiedOpenCount: { increment: 1 },
          },
        });

        if (["SENT", "QUEUED", "PENDING"].includes(token.campaignRecipient.status)) {
          await tx.campaignRecipient.update({
            where: { id: token.campaignRecipientId },
            data: { status: "OPENED" },
          });
        }

        await tx.sequenceEnrollment.updateMany({
          where: { campaignRecipientId: token.campaignRecipientId, status: "ACTIVE" },
          data: { lastQualifiedEventAt: now },
        });
      });
    }
  } catch (error) {
    console.error("Open tracking error", error);
  }

  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "private, no-store, no-cache, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
