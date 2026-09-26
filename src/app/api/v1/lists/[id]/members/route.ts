import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionContext();
    const listId = params.id;
    const body = await req.json();
    const { contactIds } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ success: false, error: "contactIds array is required" }, { status: 400 });
    }

    const list = await prisma.contactList.findFirst({
      where: { id: listId, organizationId: session.organizationId }
    });

    if (!list) {
      return NextResponse.json({ success: false, error: "Audience list not found" }, { status: 404 });
    }

    // Verify contacts belong to organization
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        organizationId: session.organizationId
      },
      select: { id: true }
    });

    let addedCount = 0;
    for (const c of contacts) {
      await prisma.contactListMember.upsert({
        where: {
          listId_contactId: {
            listId,
            contactId: c.id
          }
        },
        create: {
          listId,
          contactId: c.id
        },
        update: {}
      });
      addedCount++;
    }

    return NextResponse.json({
      success: true,
      addedCount,
      message: `Added ${addedCount} contact(s) to "${list.name}"`
    });
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
    const listId = params.id;
    const body = await req.json();
    const { contactIds } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ success: false, error: "contactIds array is required" }, { status: 400 });
    }

    const result = await prisma.contactListMember.deleteMany({
      where: {
        listId,
        contactId: { in: contactIds },
        list: { organizationId: session.organizationId }
      }
    });

    return NextResponse.json({
      success: true,
      removedCount: result.count
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
