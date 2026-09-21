import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionContext();
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: session.organizationId },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: { organizationId: session.organizationId },
      include: { actorUser: true },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    return NextResponse.json({ success: true, members, auditLogs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const { email, name, role } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    // Upsert user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          status: "ACTIVE"
        }
      });
    }

    const member = await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: session.organizationId,
          userId: user.id
        }
      },
      create: {
        organizationId: session.organizationId,
        userId: user.id,
        role: role || "MEMBER",
        status: "ACTIVE"
      },
      update: {
        role: role || undefined
      },
      include: { user: true }
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "MEMBER_INVITED",
        entityType: "member",
        entityId: member.id,
        metadataJson: JSON.stringify({ email, role: member.role })
      }
    });

    return NextResponse.json({ success: true, member });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
