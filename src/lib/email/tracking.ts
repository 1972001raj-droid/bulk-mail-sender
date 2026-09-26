import crypto from "crypto";
import { prisma } from "@/lib/db";

export type TrackingPurpose = "OPEN" | "CLICK" | "UNSUBSCRIBE";

export interface TrackingUrls {
  openTrackingUrl?: string;
  unsubscribeUrl: string;
  clickTrackingUrls: Map<string, string>;
}

function trackingKey(): string {
  const key = process.env.TRACKING_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (key) return key;
  if (process.env.NODE_ENV === "production") {
    throw new Error("TRACKING_TOKEN_SECRET must be configured in production");
  }
  return "development-tracking-secret-not-for-production";
}

function hashToken(token: string): string {
  return crypto.createHmac("sha256", trackingKey()).update(token).digest("hex");
}

function publicOrigin(): string {
  const value = process.env.TRACKING_BASE_URL || process.env.APP_BASE_URL;
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TRACKING_BASE_URL or APP_BASE_URL must be configured in production");
    }
    return "http://localhost:3000";
  }

  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Tracking URLs must use HTTPS in production");
  }
  return url.origin;
}

function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function normalizeDestination(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function createToken(input: {
  purpose: TrackingPurpose;
  emailMessageId: string;
  campaignRecipientId: string;
  destinationUrl?: string;
}): Promise<string> {
  const token = newToken();
  await prisma.trackingToken.create({
    data: {
      tokenHash: hashToken(token),
      purpose: input.purpose,
      emailMessageId: input.emailMessageId,
      campaignRecipientId: input.campaignRecipientId,
      destinationUrl: input.destinationUrl,
    },
  });
  return token;
}

export async function createTrackingUrls(input: {
  emailMessageId: string;
  campaignRecipientId: string;
  trackOpens: boolean;
  destinations: string[];
}): Promise<TrackingUrls> {
  const origin = publicOrigin();
  const uniqueDestinations = Array.from(
    new Set(input.destinations.map(normalizeDestination).filter((url): url is string => Boolean(url)))
  );

  const [openToken, unsubscribeToken, clickTokenPairs] = await Promise.all([
    input.trackOpens
      ? createToken({
          purpose: "OPEN",
          emailMessageId: input.emailMessageId,
          campaignRecipientId: input.campaignRecipientId,
        })
      : Promise.resolve(undefined),
    createToken({
      purpose: "UNSUBSCRIBE",
      emailMessageId: input.emailMessageId,
      campaignRecipientId: input.campaignRecipientId,
    }),
    Promise.all(
      uniqueDestinations.map(async (destination) => ({
        destination,
        token: await createToken({
          purpose: "CLICK",
          emailMessageId: input.emailMessageId,
          campaignRecipientId: input.campaignRecipientId,
          destinationUrl: destination,
        }),
      }))
    ),
  ]);

  return {
    openTrackingUrl: openToken ? `${origin}/api/v1/t/o/${openToken}` : undefined,
    unsubscribeUrl: `${origin}/api/v1/u/${unsubscribeToken}`,
    clickTrackingUrls: new Map(
      clickTokenPairs.map(({ destination, token }) => [destination, `${origin}/api/v1/t/c/${token}`])
    ),
  };
}

export async function resolveTrackingToken(token: string, purpose: TrackingPurpose) {
  return prisma.trackingToken.findFirst({
    where: {
      tokenHash: hashToken(token),
      purpose,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      emailMessage: true,
      campaignRecipient: {
        include: {
          campaign: true,
          contact: true,
        },
      },
    },
  });
}

export function classifyRemoteFetch(userAgent: string | null): "QUALIFIED" | "PREFETCH" | "BOT" | "UNKNOWN" {
  const value = (userAgent || "").toLowerCase();
  if (/googleimageproxy|urlscan|proofpoint|mimecast|barracuda|safelinks/.test(value)) return "BOT";
  if (/applemail|mail privacy protection/.test(value)) return "PREFETCH";
  return value ? "QUALIFIED" : "UNKNOWN";
}

export function privacySafeRequestMetadata(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const userAgent = req.headers.get("user-agent") || "";
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${forwardedFor}|${userAgent}|${trackingKey()}`)
    .digest("hex")
    .slice(0, 16);
  return JSON.stringify({ requestFingerprint: fingerprint });
}

export function extractTrackableUrls(html: string): string[] {
  const urls: string[] = [];
  const regex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const href = match[2];
    if (!href.startsWith("mailto:") && !href.startsWith("#") && !href.includes("/api/v1/")) {
      urls.push(href);
    }
  }
  return urls;
}

export function createInternetMessageId(senderEmail: string, emailMessageId: string): string {
  const domain = senderEmail.split("@")[1]?.toLowerCase().replace(/[^a-z0-9.-]/g, "") || "localhost";
  return `<${emailMessageId}.${crypto.randomBytes(10).toString("hex")}@${domain}>`;
}
