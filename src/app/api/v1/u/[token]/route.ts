import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveTrackingToken } from "@/lib/email/tracking";

export const dynamic = "force-dynamic";

function page(message: string, showForm = false, action = ""): NextResponse {
  const form = showForm
    ? `<form method="post" action="${action}"><button type="submit">Unsubscribe</button></form>`
    : "";
  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Email preferences</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:5rem auto;padding:0 1.5rem;color:#172033"><h1>Email preferences</h1><p>${message}</p>${form}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

async function suppress(token: string) {
  const trackingToken = await resolveTrackingToken(token, "UNSUBSCRIBE");
  if (!trackingToken?.emailMessage) return false;

  const recipient = trackingToken.campaignRecipient;
  const activeRecipients = await prisma.campaignRecipient.findMany({
    where: {
      contactId: recipient.contactId,
      status: { in: ["PENDING", "QUEUED", "SENT", "OPENED", "CLICKED"] },
    },
    select: { id: true },
  });
  const recipientIds = activeRecipients.map((item) => item.id);

  await prisma.$transaction([
    prisma.suppression.upsert({
      where: {
        organizationId_email_scope: {
          organizationId: recipient.campaign.organizationId,
          email: recipient.emailSnapshot.trim().toLowerCase(),
          scope: "MARKETING",
        },
      },
      create: {
        organizationId: recipient.campaign.organizationId,
        email: recipient.emailSnapshot.trim().toLowerCase(),
        scope: "MARKETING",
        reason: "UNSUBSCRIBED",
        source: "RECIPIENT",
      },
      update: {},
    }),
    prisma.contact.update({ where: { id: recipient.contactId }, data: { status: "UNSUBSCRIBED" } }),
    prisma.campaignRecipient.updateMany({
      where: { id: { in: recipientIds } },
      data: { status: "UNSUBSCRIBED" },
    }),
    prisma.sequenceEnrollment.updateMany({
      where: { campaignRecipientId: { in: recipientIds }, status: "ACTIVE" },
      data: { status: "STOPPED", stopReason: "UNSUBSCRIBED" },
    }),
    prisma.emailEvent.create({
      data: {
        emailMessageId: trackingToken.emailMessageId,
        eventType: "UNSUBSCRIBED",
        source: "RECIPIENT",
        quality: "QUALIFIED",
        dedupeKey: `unsubscribe:${trackingToken.id}`,
      },
    }),
    prisma.trackingToken.update({ where: { id: trackingToken.id }, data: { revokedAt: new Date() } }),
  ]);
  return true;
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const valid = await resolveTrackingToken(params.token, "UNSUBSCRIBE").catch(() => null);
  if (!valid) return page("This preference link is no longer valid.");
  return page("Would you like to stop receiving marketing emails from this sender?", true, req.nextUrl.pathname);
}

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    await suppress(params.token);
  } catch (error) {
    console.error("Unsubscribe error", error);
  }
  return page("Your marketing-email preference has been updated.");
}
