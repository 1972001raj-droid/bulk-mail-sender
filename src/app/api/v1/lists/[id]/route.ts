import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionContext();
    const list = await prisma.contactList.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      include: {
        _count: {
          select: { members: true, campaigns: true }
        }
      }
    });

    if (!list) {
      return NextResponse.json({ success: false, error: "Audience list not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, list });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionContext();
    const id = params.id;
    const { searchParams } = new URL(req.url);
    const deleteContacts = searchParams.get("deleteContacts") === "true";

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
