import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionContext();
    const sequences = await prisma.sequence.findMany({
      where: { organizationId: session.organizationId },
      include: {
        steps: { orderBy: { stepNo: "asc" } },
        _count: { select: { enrollments: true, campaigns: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ success: true, sequences });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const { name, steps } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "Sequence name is required" }, { status: 400 });
    }

    const sequence = await prisma.sequence.create({
      data: {
        organizationId: session.organizationId,
        name,
        status: "ACTIVE",
        steps: {
          create: (steps || []).map((s: any, idx: number) => ({
            stepNo: idx + 1,
            delaySeconds: s.delaySeconds || 86400 * 2,
            subject: s.subject || "",
            htmlBody: s.htmlBody || "",
            conditionsJson: JSON.stringify(s.conditions || { stopOnReply: true, stopOnBounce: true })
          }))
        }
      },
      include: { steps: true }
    });

    return NextResponse.json({ success: true, sequence });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
