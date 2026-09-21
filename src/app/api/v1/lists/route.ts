import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionContext();
    const lists = await prisma.contactList.findMany({
      where: { organizationId: session.organizationId },
      include: {
        _count: {
          select: { members: true, campaigns: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ success: true, lists });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "List name is required" }, { status: 400 });
    }

    const list = await prisma.contactList.create({
      data: {
        organizationId: session.organizationId,
        name,
        description
      }
    });

    return NextResponse.json({ success: true, list });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
