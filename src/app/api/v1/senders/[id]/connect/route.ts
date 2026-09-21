import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { ProviderFactory } from "@/lib/providers/factory";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const sender = await prisma.sender.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      include: { providerAccounts: true }
    });

    if (!sender) {
      return NextResponse.json({ success: false, error: "Sender not found" }, { status: 404 });
    }

    const providerAccount = sender.providerAccounts[0];
    const provider = ProviderFactory.getProvider({
      provider: providerAccount?.provider || "smtp",
      senderEmail: sender.email,
      displayName: sender.displayName,
      tokenRef: providerAccount?.tokenRef
    });

    try {
      const connResult = await provider.connect();

      await prisma.sender.update({
        where: { id: sender.id },
        data: { status: "CONNECTED" }
      });

      if (providerAccount) {
        await prisma.emailProviderAccount.update({
          where: { id: providerAccount.id },
          data: { status: "ACTIVE", lastError: null }
        });
      }

      return NextResponse.json({
        success: true,
        connected: connResult.connected,
        sender: {
          id: sender.id,
          email: sender.email,
          displayName: sender.displayName,
          status: "CONNECTED"
        }
      });
    } catch (connErr: any) {
      const errorMsg = connErr.message || "Connection failed";
      await prisma.sender.update({
        where: { id: sender.id },
        data: { status: "REAUTH_REQUIRED" }
      });

      if (providerAccount) {
        await prisma.emailProviderAccount.update({
          where: { id: providerAccount.id },
          data: { status: "REVOKED", lastError: errorMsg }
        });
      }

      return NextResponse.json({
        success: false,
        error: errorMsg
      }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
