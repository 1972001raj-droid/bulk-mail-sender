import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { ingestInboundEmail } from "@/lib/email/inbound";

function hasValidSecret(req: NextRequest): boolean {
  const configured = process.env.REPLY_WEBHOOK_SECRET;
  if (!configured) return process.env.NODE_ENV !== "production";
  const provided = req.headers.get("x-reply-webhook-secret") || "";
  if (provided.length !== configured.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(configured));
}

export async function POST(req: NextRequest) {
  try {
    if (!hasValidSecret(req)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const senderId = String(body.senderId || "");
    const providerMessageId = String(body.providerMessageId || "");
    const fromEmail = String(body.fromEmail || "").trim().toLowerCase();
    if (!senderId || !providerMessageId || !fromEmail) {
      return NextResponse.json({ success: false, error: "senderId, providerMessageId, and fromEmail are required" }, { status: 400 });
    }

    const sender = await prisma.sender.findUnique({ where: { id: senderId }, select: { organizationId: true } });
    if (!sender) return NextResponse.json({ success: false, error: "Sender not found" }, { status: 404 });

    const result = await ingestInboundEmail({
      organizationId: sender.organizationId,
      senderId,
      provider: String(body.provider || "smtp").toLowerCase(),
      providerMessageId,
      providerThreadId: body.providerThreadId ? String(body.providerThreadId) : null,
      internetMessageId: body.internetMessageId ? String(body.internetMessageId) : null,
      inReplyTo: body.inReplyTo ? String(body.inReplyTo) : null,
      references: Array.isArray(body.references) ? body.references.map(String).slice(0, 20) : [],
      fromEmail,
      subject: body.subject ? String(body.subject).slice(0, 500) : null,
      snippet: body.snippet ? String(body.snippet).slice(0, 500) : null,
      receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
