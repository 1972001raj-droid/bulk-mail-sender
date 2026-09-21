import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { SendersClientView } from "./SendersClientView";

export const dynamic = "force-dynamic";

export default async function SendersPage() {
  const session = await getSessionContext();
  const senders = await prisma.sender.findMany({
    where: { organizationId: session.organizationId },
    include: { providerAccounts: true },
    orderBy: { createdAt: "desc" }
  });

  return <SendersClientView initialSenders={senders} />;
}
