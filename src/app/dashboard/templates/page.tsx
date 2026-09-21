import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { TemplatesClientView } from "./TemplatesClientView";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await getSessionContext();
  const templates = await prisma.template.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { updatedAt: "desc" }
  });

  return <TemplatesClientView initialTemplates={templates} />;
}
