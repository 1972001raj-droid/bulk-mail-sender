import { prisma } from "@/lib/db";

export type InboundClassification = "HUMAN" | "OUT_OF_OFFICE" | "AUTO_REPLY" | "BOUNCE" | "UNKNOWN";

export interface InboundEmailInput {
  organizationId: string;
  senderId: string;
  provider: string;
  providerMessageId: string;
  providerThreadId?: string | null;
  internetMessageId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  fromEmail: string;
  subject?: string | null;
  snippet?: string | null;
  receivedAt: Date;
}

export function classifyInbound(input: Pick<InboundEmailInput, "fromEmail" | "subject" | "snippet">): InboundClassification {
  const haystack = `${input.fromEmail} ${input.subject || ""} ${input.snippet || ""}`.toLowerCase();
  if (/mailer-daemon|postmaster|delivery status notification|undeliverable|failure notice/.test(haystack)) return "BOUNCE";
  if (/out of office|automatic reply|auto(?:matic)?\s*response|on vacation|away from (the )?office/.test(haystack)) return "OUT_OF_OFFICE";
  if (/auto-?reply|do not reply|noreply/.test(haystack)) return "AUTO_REPLY";
  return input.fromEmail ? "HUMAN" : "UNKNOWN";
}

async function matchRecipient(input: InboundEmailInput) {
  const providerThreadMatch = input.providerThreadId
    ? await prisma.emailMessage.findFirst({
        where: {
          threadId: input.providerThreadId,
          campaignRecipient: { campaign: { organizationId: input.organizationId, senderId: input.senderId } },
        },
        include: { campaignRecipient: true },
        orderBy: { sentAt: "desc" },
      })
    : null;
  if (providerThreadMatch) return providerThreadMatch;

  const headerIds = [input.inReplyTo, ...(input.references || [])].filter(Boolean) as string[];
  if (headerIds.length) {
    const headerMatch = await prisma.emailMessage.findFirst({
      where: {
        internetMessageId: { in: headerIds },
        campaignRecipient: { campaign: { organizationId: input.organizationId, senderId: input.senderId } },
      },
      include: { campaignRecipient: true },
      orderBy: { sentAt: "desc" },
    });
    if (headerMatch) return headerMatch;
  }

  // A sender-scoped fallback keeps an unmatched reply out of a different tenant.
  return prisma.emailMessage.findFirst({
    where: {
      campaignRecipient: {
        emailSnapshot: input.fromEmail.trim().toLowerCase(),
        campaign: { organizationId: input.organizationId, senderId: input.senderId },
      },
    },
    include: { campaignRecipient: true },
    orderBy: { sentAt: "desc" },
  });
}

export async function ingestInboundEmail(input: InboundEmailInput) {
  const classification = classifyInbound(input);
  const outbound = await matchRecipient(input);
  const snippet = input.snippet?.slice(0, 500) || null;

  try {
    return await prisma.$transaction(async (tx) => {
      const inbound = await tx.inboundMessage.create({
        data: {
          organizationId: input.organizationId,
          senderId: input.senderId,
          campaignRecipientId: outbound?.campaignRecipientId,
          provider: input.provider,
          providerMessageId: input.providerMessageId,
          providerThreadId: input.providerThreadId,
          internetMessageId: input.internetMessageId,
          inReplyTo: input.inReplyTo,
          referencesJson: input.references?.length ? JSON.stringify(input.references) : null,
          fromEmail: input.fromEmail.trim().toLowerCase(),
          subject: input.subject,
          snippet,
          classification,
          receivedAt: input.receivedAt,
        },
      });

      if (!outbound) return { inbound, matched: false, classification };

      await tx.emailEvent.create({
        data: {
          emailMessageId: outbound.id,
          eventType: classification === "HUMAN" ? "REPLY_DETECTED" : "AUTO_REPLY_DETECTED",
          source: input.provider.toUpperCase(),
          quality: classification === "HUMAN" ? "QUALIFIED" : "UNKNOWN",
          dedupeKey: `inbound:${input.provider}:${input.senderId}:${input.providerMessageId}`,
          metadataJson: JSON.stringify({ classification, subject: input.subject?.slice(0, 200) || null }),
        },
      });

      if (classification === "HUMAN") {
        await tx.campaignRecipient.update({
          where: { id: outbound.campaignRecipientId },
          data: { status: "REPLIED" },
        });
        await tx.sequenceEnrollment.updateMany({
          where: { campaignRecipientId: outbound.campaignRecipientId, status: "ACTIVE" },
          data: { status: "STOPPED", stopReason: "REPLIED", lastQualifiedEventAt: input.receivedAt },
        });
      }

      return { inbound, matched: true, classification, campaignRecipientId: outbound.campaignRecipientId };
    });
  } catch (error: any) {
    // Webhook providers retry. Treat an already-ingested provider message as success.
    if (error?.code === "P2002") {
      return { matched: Boolean(outbound), classification, duplicate: true };
    }
    throw error;
  }
}
