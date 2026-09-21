import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const { searchParams } = new URL(req.url);
    const listId = searchParams.get("listId");
    const search = searchParams.get("search");

    const where: any = { organizationId: session.organizationId };

    if (listId && listId !== "ALL") {
      where.listMemberships = {
        some: { listId }
      };
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { company: { contains: search } },
        { title: { contains: search } }
      ];
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        listMemberships: {
          include: { list: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 500
    });

    return NextResponse.json({ success: true, contacts });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const { email, firstName, lastName, company, title, status, customFields, listId } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const contact = await prisma.contact.upsert({
      where: {
        organizationId_email: {
          organizationId: session.organizationId,
          email: email.trim().toLowerCase()
        }
      },
      create: {
        organizationId: session.organizationId,
        email: email.trim().toLowerCase(),
        firstName,
        lastName,
        company,
        title,
        status: status || "ACTIVE",
        customFieldsJson: customFields ? JSON.stringify(customFields) : null
      },
      update: {
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
        company: company !== undefined ? company : undefined,
        title: title !== undefined ? title : undefined,
        status: status !== undefined ? status : undefined,
        customFieldsJson: customFields !== undefined ? JSON.stringify(customFields) : undefined
      }
    });

    if (listId && listId !== "ALL" && listId !== "NONE") {
      await prisma.contactListMember.upsert({
        where: {
          listId_contactId: {
            listId,
            contactId: contact.id
          }
        },
        create: {
          listId,
          contactId: contact.id
        },
        update: {}
      });
    }

    return NextResponse.json({ success: true, contact });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: "Array of contact IDs is required" }, { status: 400 });
    }

    // Verify contacts belong to current organization
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: ids },
        organizationId: session.organizationId
      },
      select: { id: true }
    });

    const validIds = contacts.map((c) => c.id);

    if (validIds.length > 0) {
      await prisma.contactListMember.deleteMany({
        where: { contactId: { in: validIds } }
      });

      await prisma.campaignRecipient.deleteMany({
        where: { contactId: { in: validIds } }
      });

      await prisma.contact.deleteMany({
        where: { id: { in: validIds } }
      });
    }

    return NextResponse.json({ success: true, deletedCount: validIds.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
