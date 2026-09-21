import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    try {
      const recipient = await prisma.campaignRecipient.findUnique({
        where: { id },
        include: { messages: { take: 1, orderBy: { createdAt: "desc" } } }
      });

      if (recipient) {
        await prisma.campaignRecipient.update({
          where: { id },
          data: { status: "UNSUBSCRIBED" }
        });

        // Halt sequence enrollment if any
        await prisma.sequenceEnrollment.updateMany({
          where: { campaignRecipientId: id },
          data: { status: "STOPPED" }
        });

        if (recipient.messages[0]) {
          await prisma.emailEvent.create({
            data: {
              emailMessageId: recipient.messages[0].id,
              eventType: "UNSUBSCRIBED"
            }
          });
        }
      }
    } catch (e) {
      console.error("Unsubscribe error:", e);
    }
  }

  return new NextResponse(
    `<!DOCTYPE html>
    <html>
      <head><title>Unsubscribed</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f172a;color:#f8fafc;} .box{text-align:center;padding:40px;background:#1e293b;border-radius:12px;border:1px solid #334155;max-width:400px;}</style></head>
      <body>
        <div class="box">
          <h2 style="color:#10b981;margin-top:0;">Unsubscribed Successfully</h2>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;">You will no longer receive automated follow-ups for this campaign.</p>
        </div>
      </body>
    </html>`,
    {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    }
  );
}
