const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting AeroSend database seed...");

  // Clean old records
  await prisma.emailEvent.deleteMany();
  await prisma.emailMessage.deleteMany();
  await prisma.sequenceEnrollment.deleteMany();
  await prisma.sequenceStep.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.campaignRecipient.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.contactListMember.deleteMany();
  await prisma.contactList.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.template.deleteMany();
  await prisma.emailProviderAccount.deleteMany();
  await prisma.sender.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // 1. Create Organization & User
  const user = await prisma.user.create({
    data: {
      email: "user@aerosend.dev",
      name: "Outreach Lead",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      status: "ACTIVE"
    }
  });

  const org = await prisma.organization.create({
    data: {
      name: "Outreach Workspace",
      slug: "outreach-workspace",
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE"
        }
      }
    }
  });

  // Note: No static mock senders are seeded.
  // Users connect their real Gmail (App Password), Outlook, or SMTP accounts via the dashboard.

  // 2. Create Contacts
  const contactsData = [
    {
      email: "sarah.connor@techflow.io",
      firstName: "Sarah",
      lastName: "Connor",
      company: "TechFlow",
      title: "CEO",
      customFieldsJson: JSON.stringify({ city: "San Francisco", industry: "SaaS", valuation: "$45M" })
    },
    {
      email: "david.miller@datascale.co",
      firstName: "David",
      lastName: "Miller",
      company: "DataScale",
      title: "VP of Growth",
      customFieldsJson: JSON.stringify({ city: "Austin", industry: "Data Analytics", valuation: "$20M" })
    },
    {
      email: "elena.rostova@aetherai.com",
      firstName: "Elena",
      lastName: "Rostova",
      company: "Aether AI",
      title: "CTO",
      customFieldsJson: JSON.stringify({ city: "New York", industry: "Artificial Intelligence", valuation: "$80M" })
    },
    {
      email: "marcus.brody@horizondynamics.org",
      firstName: "Marcus",
      lastName: "Brody",
      company: "Horizon Dynamics",
      title: "Founder",
      customFieldsJson: JSON.stringify({ city: "Chicago", industry: "Robotics", valuation: "$15M" })
    },
    {
      email: "priya.sharma@nextwavecloud.net",
      firstName: "Priya",
      lastName: "Sharma",
      company: "NextWave Cloud",
      title: "Head of BD",
      customFieldsJson: JSON.stringify({ city: "Seattle", industry: "Cloud Infrastructure", valuation: "$35M" })
    },
    {
      email: "lucas.vance@quantumleap.tech",
      firstName: "Lucas",
      lastName: "Vance",
      company: "Quantum Leap",
      title: "COO",
      customFieldsJson: JSON.stringify({ city: "Boston", industry: "Quantum Computing", valuation: "$50M" })
    }
  ];

  const createdContacts = [];
  for (const c of contactsData) {
    const contact = await prisma.contact.create({
      data: {
        organizationId: org.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        company: c.company,
        title: c.title,
        customFieldsJson: c.customFieldsJson,
        status: "ACTIVE"
      }
    });
    createdContacts.push(contact);
  }

  // 3. Create Contact List
  const list = await prisma.contactList.create({
    data: {
      organizationId: org.id,
      name: "Q4 High-Intent Tech Founders",
      description: "Curated series A/B technology decision makers"
    }
  });

  for (const c of createdContacts) {
    await prisma.contactListMember.create({
      data: {
        listId: list.id,
        contactId: c.id
      }
    });
  }

  // 4. Create Template
  const template = await prisma.template.create({
    data: {
      organizationId: org.id,
      name: "Founder Direct Introduction",
      subject: "Quick question regarding {{company}}'s outreach strategy",
      htmlBody: `<p>Hi {{firstName | "there"}},</p>
<p>I noticed {{company}} has been expanding fast and wanted to share a quick idea regarding your outbound engine.</p>
<p>We've helped teams scale personalized email outreach directly through your existing Google/Microsoft inbox, achieving 3x higher open rates than standard automation platforms.</p>
<p>Would you be open to a 10-minute coffee chat next Tuesday?</p>
<p>Best regards,<br/><strong>Outreach Team</strong></p>`,
      textBody: "Hi {{firstName}}, quick question regarding {{company}}...",
      variablesJson: JSON.stringify(["firstName", "company"])
    }
  });

  // 5. Create Follow-up Sequence
  const sequence = await prisma.sequence.create({
    data: {
      organizationId: org.id,
      name: "3-Step Founder Outreach Drip",
      status: "ACTIVE",
      steps: {
        create: [
          {
            stepNo: 1,
            delaySeconds: 86400 * 2, // 2 days
            subject: "Re: Quick question regarding {{company}}",
            htmlBody: "<p>Hi {{firstName}}, just following up on my previous note to see if you had 5 minutes this week?</p>",
            conditionsJson: JSON.stringify({ stopOnReply: true, stopOnBounce: true })
          },
          {
            stepNo: 2,
            delaySeconds: 86400 * 3, // 3 days
            subject: "Last thought on {{company}}",
            htmlBody: "<p>Hi {{firstName}}, I know you're super busy. If now isn't the right time, no worries at all! Just let me know if we should circle back next quarter.</p>",
            conditionsJson: JSON.stringify({ stopOnReply: true, stopOnBounce: true })
          }
        ]
      }
    }
  });

  // 6. Create a Sample Campaign draft
  await prisma.campaign.create({
    data: {
      organizationId: org.id,
      name: "September SaaS Founders Q3",
      contactListId: list.id,
      sequenceId: sequence.id,
      status: "DRAFT",
      subject: "Quick question regarding {{company}}'s outreach strategy",
      htmlBody: template.htmlBody,
      timezone: "America/New_York",
      settingsJson: JSON.stringify({ tracking: { opens: true, clicks: true } }),
      createdById: user.id
    }
  });

  console.log("✅ AeroSend database successfully seeded without static senders or subscription limits!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
