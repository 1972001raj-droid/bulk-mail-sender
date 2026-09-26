import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { verifyEmailAddress, getVerificationExpiryDate } from "@/lib/verification/verifier";

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
    const {
      email,
      firstName,
      lastName,
      company,
      title,
      status,
      customFields,
      listId,
      verifyEmail,
      verificationResult,
      allowInvalid
    } = body;

    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Determine verification result:
    // 1. Use pre-calculated result if client ran manual check
    // 2. Otherwise auto-verify unless explicitly set to false
    let verResult = verificationResult;
    if (!verResult && verifyEmail !== false) {
      verResult = await verifyEmailAddress(cleanEmail, session.organizationId);
    }

    // Block invalid/non-existent emails unless user explicitly opted to allow/override
    if (verResult && verResult.status === "INVALID" && !allowInvalid) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot add invalid email: ${verResult.message || "Mailbox does not exist"}`,
          verification: verResult
        },
        { status: 422 }
      );
    }

    const expiresAt = verResult ? getVerificationExpiryDate() : null;

    const contact = await prisma.contact.upsert({
      where: {
        organizationId_email: {
          organizationId: session.organizationId,
          email: cleanEmail
        }
      },
      create: {
        organizationId: session.organizationId,
        email: cleanEmail,
        firstName,
        lastName,
        company,
        title,
        status: status || "ACTIVE",
        customFieldsJson: customFields ? JSON.stringify(customFields) : null,
        verificationStatus: verResult ? verResult.status : null,
        verificationReason: verResult ? verResult.reason : null,
        verificationCheckedAt: verResult ? new Date(verResult.checkedAt) : null,
        verificationExpiresAt: expiresAt,
        verificationMetadata: verResult ? JSON.stringify(verResult) : null
      },
      update: {
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
        company: company !== undefined ? company : undefined,
        title: title !== undefined ? title : undefined,
        status: status !== undefined ? status : undefined,
        customFieldsJson: customFields !== undefined ? JSON.stringify(customFields) : undefined,
        verificationStatus: verResult ? verResult.status : undefined,
        verificationReason: verResult ? verResult.reason : undefined,
        verificationCheckedAt: verResult ? new Date(verResult.checkedAt) : undefined,
        verificationExpiresAt: expiresAt !== null ? expiresAt : undefined,
        verificationMetadata: verResult ? JSON.stringify(verResult) : undefined
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

    return NextResponse.json({ success: true, contact, verification: verResult });
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
