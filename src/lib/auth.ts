import { prisma } from "./db";

export interface SessionContext {
  userId: string;
  organizationId: string;
  role: string;
  userEmail: string;
  userName: string;
  orgName: string;
}

/**
 * Resolves or bootstraps the active user and organization session.
 * Does not insert static mock senders, allowing users to connect their real mailboxes.
 */
export async function getSessionContext(): Promise<SessionContext> {
  // Look for existing primary organization
  let org = await prisma.organization.findFirst({
    include: { members: { include: { user: true } } }
  });

  if (!org) {
    // Create default organization and owner user
    const user = await prisma.user.create({
      data: {
        email: "alex.founder@aerosend.dev",
        name: "Alex Vance",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        status: "ACTIVE"
      }
    });

    org = await prisma.organization.create({
      data: {
        name: "Acme Growth Labs",
        slug: "acme-growth-labs",
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
            status: "ACTIVE"
          }
        }
      },
      include: { members: { include: { user: true } } }
    });
  }

  const member = org.members[0];
  const user = member?.user;

  return {
    organizationId: org.id,
    userId: user ? user.id : "user-default",
    role: member ? member.role : "OWNER",
    userEmail: user ? user.email : "user@aerosend.dev",
    userName: user ? user.name : "Alex Vance",
    orgName: org.name
  };
}
