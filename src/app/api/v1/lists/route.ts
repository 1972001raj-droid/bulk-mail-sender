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

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    let deleteContacts = searchParams.get("deleteContacts") === "true";

    if (!id) {
      try {
        const body = await req.json();
        if (body?.id) {
          id = body.id;
          if (body.deleteContacts !== undefined) {
            deleteContacts = Boolean(body.deleteContacts);
          }
        }
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "List ID is required" }, { status: 400 });
    }

    const list = await prisma.contactList.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        _count: { select: { members: true } }
      }
    });

    if (!list) {
      return NextResponse.json({ success: false, error: "Audience list not found" }, { status: 404 });
    }

    if (deleteContacts) {
      const members = await prisma.contactListMember.findMany({
        where: { listId: id },
        select: { contactId: true }
      });
      const contactIds = members.map((m) => m.contactId);
      if (contactIds.length > 0) {
        await prisma.contact.deleteMany({
          where: { id: { in: contactIds }, organizationId: session.organizationId }
        });
      }
    }

    await prisma.contactList.delete({
      where: { id: list.id }
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "LIST_DELETED",
        entityType: "contact_list",
        entityId: list.id,
        metadataJson: JSON.stringify({ name: list.name, deleteContacts })
      }
    });

    return NextResponse.json({
      success: true,
      message: `Audience list "${list.name}" deleted successfully`
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

