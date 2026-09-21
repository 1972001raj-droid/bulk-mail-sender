import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { SmtpProviderAdapter } from "@/lib/providers/smtp";
import { ResendProviderAdapter } from "@/lib/providers/resend";

export async function GET() {
  try {
    const session = await getSessionContext();
    const senders = await prisma.sender.findMany({
      where: { organizationId: session.organizationId },
      include: { providerAccounts: true },
      orderBy: { createdAt: "desc" }
    });

    // Safely format senders without exposing raw passwords / API keys
    const safeSenders = senders.map((s) => {
      const accounts = s.providerAccounts.map((acc) => {
        let host = null;
        let port = null;
        let hasAuth = false;
        let isResend = acc.provider === "resend";

        if (acc.tokenRef) {
          try {
            const parsed = JSON.parse(acc.tokenRef);
            if (parsed.apiKey) {
              isResend = true;
              hasAuth = true;
            }
            host = parsed.host || (isResend ? "api.resend.com" : null);
            port = parsed.port || (isResend ? 443 : null);
            if (parsed.user && parsed.pass) {
              hasAuth = true;
            }
          } catch {
            // ignore
          }
        }
        return {
          id: acc.id,
          provider: isResend ? "resend" : acc.provider,
          status: acc.status,
          host: isResend ? "api.resend.com" : host,
          port: isResend ? 443 : port,
          hasAuth
        };
      });

      return {
        id: s.id,
        email: s.email,
        displayName: s.displayName,
        status: s.status,
        sentToday: s.sentToday,
        createdAt: s.createdAt,
        providerAccounts: accounts
      };
    });

    return NextResponse.json({ success: true, senders: safeSenders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const { email, displayName, provider, apiKey, host, port, secure, user, pass } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: "Sender email is required" }, { status: 400 });
    }

    const providerType = (provider || "resend").toLowerCase();
    let tokenRef: string | null = null;

    // 1. Resend Provider (Easiest API Key Integration)
    if (providerType === "resend") {
      const key = apiKey || pass;
      if (!key) {
        return NextResponse.json({
          success: false,
          error: "Resend API key is required (starts with re_). Get yours at https://resend.com/api-keys"
        }, { status: 400 });
      }

      // Test real Resend API connection
      try {
        const adapter = new ResendProviderAdapter({
          apiKey: key.trim(),
          senderEmail: email.trim(),
          displayName: displayName || email.split("@")[0]
        });
        await adapter.connect();
      } catch (testErr: any) {
        return NextResponse.json({
          success: false,
          error: `Resend verification failed: ${testErr.message}`
        }, { status: 400 });
      }

      tokenRef = JSON.stringify({
        apiKey: key.trim()
      });
    }
    // 2. SMTP Provider (Gmail App Password, Outlook, or Custom SMTP)
    else if (providerType !== "sandbox") {
      const smtpHost = host || (providerType === "gmail" ? "smtp.gmail.com" : providerType === "microsoft" ? "smtp.office365.com" : "");
      const smtpPort = Number(port) || (secure ? 465 : 587);
      const smtpUser = user || email;
      const smtpPass = pass;

      if (!smtpHost) {
        return NextResponse.json({ success: false, error: "SMTP Host is required" }, { status: 400 });
      }
      if (!smtpPass) {
        return NextResponse.json({
          success: false,
          error: providerType === "gmail"
            ? "Google 16-character App Password is required. Generate one at myaccount.google.com/apppasswords"
            : "Mailbox Password or App Password is required."
        }, { status: 400 });
      }

      // Test real connection before saving
      try {
        const adapter = new SmtpProviderAdapter({
          host: smtpHost,
          port: smtpPort,
          secure: secure ?? (smtpPort === 465),
          user: smtpUser,
          pass: smtpPass,
          email,
          displayName: displayName || email.split("@")[0]
        });
        await adapter.connect();
      } catch (testErr: any) {
        return NextResponse.json({
          success: false,
          error: `Failed to connect to ${smtpHost}:${smtpPort} — ${testErr.message}`
        }, { status: 400 });
      }

      tokenRef = JSON.stringify({
        host: smtpHost,
        port: smtpPort,
        secure: secure ?? (smtpPort === 465),
        user: smtpUser,
        pass: smtpPass
      });
    }

    // Check if sender already exists in this org
    const existingSender = await prisma.sender.findUnique({
      where: {
        organizationId_email: {
          organizationId: session.organizationId,
          email: email.trim()
        }
      }
    });

    let sender;
    if (existingSender) {
      // Update existing
      sender = await prisma.sender.update({
        where: { id: existingSender.id },
        data: {
          displayName: displayName || email.split("@")[0],
          status: "CONNECTED",
          providerAccounts: {
            deleteMany: {},
            create: {
              provider: providerType,
              providerAccountId: `${providerType}_${Date.now()}`,
              tokenRef,
              status: "ACTIVE"
            }
          }
        },
        include: { providerAccounts: true }
      });
    } else {
      // Create new sender
      sender = await prisma.sender.create({
        data: {
          organizationId: session.organizationId,
          email: email.trim(),
          displayName: displayName || email.split("@")[0],
          dailyQuota: 999999, // Uncapped sending
          status: "CONNECTED",
          providerAccounts: {
            create: {
              provider: providerType,
              providerAccountId: `${providerType}_${Date.now()}`,
              tokenRef,
              status: "ACTIVE"
            }
          }
        },
        include: { providerAccounts: true }
      });
    }

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "SENDER_CONNECTED",
        entityType: "sender",
        entityId: sender.id,
        metadataJson: JSON.stringify({ email, provider: providerType })
      }
    });

    return NextResponse.json({ success: true, sender });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
