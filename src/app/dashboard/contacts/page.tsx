import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { ContactsClientView } from "./ContactsClientView";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const session = await getSessionContext();
  const orgId = session.organizationId;

  const [contacts, lists] = await Promise.all([
    prisma.contact.findMany({
      where: { organizationId: orgId },
      include: {
        listMemberships: {
          include: { list: true }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.contactList.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { members: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return <ContactsClientView initialContacts={contacts} initialLists={lists} />;
}
