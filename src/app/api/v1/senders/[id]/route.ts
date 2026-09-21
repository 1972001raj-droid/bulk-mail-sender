import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const sender = await prisma.sender.findFirst({
      where: { id: params.id, organizationId: session.organizationId }
    });

    if (!sender) {
      return NextResponse.json({ success: false, error: "Sender not found" }, { status: 404 });
    }

    // Nullify senderId on any campaigns referencing this sender
    await prisma.campaign.updateMany({
      where: { senderId: sender.id },
      data: { senderId: null }
    });

    // Delete associated provider accounts and sender
    await prisma.emailProviderAccount.deleteMany({
      where: { senderId: sender.id }
    });

    await prisma.sender.delete({
      where: { id: sender.id }
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "SENDER_DISCONNECTED",
        entityType: "sender",
        entityId: sender.id,
        metadataJson: JSON.stringify({ email: sender.email })
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
