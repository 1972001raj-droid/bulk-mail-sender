import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { verifyEmailAddress, getVerificationExpiryDate } from "@/lib/verification/verifier";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const contact = await prisma.contact.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      include: {
        listMemberships: {
          include: { list: true }
        }
      }
    });

    if (!contact) {
      return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, contact });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
      verificationResult
    } = body;

    const contact = await prisma.contact.findFirst({
      where: { id: params.id, organizationId: session.organizationId }
    });

    if (!contact) {
      return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : undefined;

    // Check if new email conflicts with another contact in the same org
    if (cleanEmail && cleanEmail !== contact.email) {
      const conflict = await prisma.contact.findUnique({
        where: {
          organizationId_email: {
            organizationId: session.organizationId,
            email: cleanEmail
          }
        }
      });
      if (conflict) {
        return NextResponse.json(
          { success: false, error: "A contact with this email already exists." },
          { status: 400 }
        );
      }
    }

    // Determine verification state if email changed or verification was triggered
    let verResult = verificationResult;
    if (cleanEmail && cleanEmail !== contact.email && !verResult && verifyEmail !== false) {
      verResult = await verifyEmailAddress(cleanEmail, session.organizationId);
    }

    const expiresAt = verResult ? getVerificationExpiryDate() : undefined;

    const updated = await prisma.contact.update({
      where: { id: params.id },
      data: {
        email: cleanEmail !== undefined ? cleanEmail : undefined,
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
        company: company !== undefined ? company : undefined,
        title: title !== undefined ? title : undefined,
        status: status !== undefined ? status : undefined,
        customFieldsJson: customFields !== undefined ? JSON.stringify(customFields) : undefined,
        verificationStatus: verResult ? verResult.status : undefined,
        verificationReason: verResult ? verResult.reason : undefined,
        verificationCheckedAt: verResult ? new Date(verResult.checkedAt) : undefined,
        verificationExpiresAt: expiresAt,
        verificationMetadata: verResult ? JSON.stringify(verResult) : undefined
      },
      include: {
        listMemberships: {
          include: { list: true }
        }
      }
    });

    // Update list membership if listId was provided
    if (listId !== undefined) {
      // Clear current list memberships
      await prisma.contactListMember.deleteMany({
        where: { contactId: params.id }
      });

      if (listId && listId !== "NONE" && listId !== "ALL") {
        await prisma.contactListMember.create({
          data: {
            listId,
            contactId: params.id
          }
        });
      }
    }

    return NextResponse.json({ success: true, contact: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const contact = await prisma.contact.findFirst({
      where: { id: params.id, organizationId: session.organizationId }
    });

    if (!contact) {
      return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 });
    }

    // Delete contact list memberships
    await prisma.contactListMember.deleteMany({
      where: { contactId: params.id }
    });

    // Delete campaign recipient records
    await prisma.campaignRecipient.deleteMany({
      where: { contactId: params.id }
    });

    await prisma.contact.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
