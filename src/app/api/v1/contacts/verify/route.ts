import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyEmailAddress, getVerificationExpiryDate } from "@/lib/verification/verifier";
import { VerificationResult } from "@/lib/verification/types";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const skipDbCache = searchParams.get("skipCache") === "true";

    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, error: "Email query parameter is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const verification = await verifyEmailAddress(cleanEmail, session.organizationId, skipDbCache);

    return NextResponse.json({ success: true, verification });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const { email, saveToContactId, skipDbCache, contactIds } = body;

    // Bulk verification of existing contacts
    if (Array.isArray(contactIds) && contactIds.length > 0) {
      const contacts = await prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          organizationId: session.organizationId
        },
        select: { id: true, email: true }
      });

      const expiresAt = getVerificationExpiryDate();
      const results: Array<{ id: string; email: string; verification: VerificationResult }> = [];

      // Run verification with controlled concurrency
      const BATCH_SIZE = 5;
      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (c) => {
            const result = await verifyEmailAddress(c.email, session.organizationId, true);
            await prisma.contact.update({
              where: { id: c.id },
              data: {
                verificationStatus: result.status,
                verificationReason: result.reason,
                verificationCheckedAt: new Date(result.checkedAt),
                verificationExpiresAt: expiresAt,
                verificationMetadata: JSON.stringify(result)
              }
            }).catch(() => {});
            return { id: c.id, email: c.email, verification: result };
          })
        );
        results.push(...batchResults);
      }

      return NextResponse.json({ success: true, results, count: results.length });
    }

    // Single email verification (for manual contact adding or single contact check)
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ success: false, error: "Valid email address is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const verification = await verifyEmailAddress(cleanEmail, session.organizationId, !!skipDbCache);

    // If requested to persist result directly to an existing contact
    if (saveToContactId) {
      const existing = await prisma.contact.findFirst({
        where: { id: saveToContactId, organizationId: session.organizationId }
      });

      if (existing) {
        const expiresAt = getVerificationExpiryDate();
        await prisma.contact.update({
          where: { id: saveToContactId },
          data: {
            verificationStatus: verification.status,
            verificationReason: verification.reason,
            verificationCheckedAt: new Date(verification.checkedAt),
            verificationExpiresAt: expiresAt,
            verificationMetadata: JSON.stringify(verification)
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      verification
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
