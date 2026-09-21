import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const { rows, mappings, listName, listId } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: "No rows provided for import" }, { status: 400 });
    }

    if (!mappings || !mappings.email) {
      return NextResponse.json({ success: false, error: "Email column mapping is required" }, { status: 400 });
    }

    // Determine target list
    let targetListId = listId;
    if (!targetListId && listName) {
      const newList = await prisma.contactList.create({
        data: {
          organizationId: session.organizationId,
          name: listName,
          description: `Imported on ${new Date().toLocaleDateString()}`
        }
      });
      targetListId = newList.id;
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const row of rows) {
      const rawEmail = row[mappings.email];
      if (!rawEmail || !emailRegex.test(String(rawEmail).trim())) {
        skipped++;
        continue;
      }

      const email = String(rawEmail).trim().toLowerCase();
      const firstName = mappings.firstName ? String(row[mappings.firstName] || "").trim() : undefined;
      const lastName = mappings.lastName ? String(row[mappings.lastName] || "").trim() : undefined;
      const company = mappings.company ? String(row[mappings.company] || "").trim() : undefined;
      const title = mappings.title ? String(row[mappings.title] || "").trim() : undefined;

      // Extract custom fields from other mapped columns
      const customFields: Record<string, any> = {};
      for (const [colKey, targetField] of Object.entries(mappings)) {
        if (!["email", "firstName", "lastName", "company", "title"].includes(targetField as string)) {
          customFields[targetField as string] = row[colKey];
        }
      }

      try {
        const contact = await prisma.contact.upsert({
          where: {
            organizationId_email: {
              organizationId: session.organizationId,
              email
            }
          },
          create: {
            organizationId: session.organizationId,
            email,
            firstName: firstName || null,
            lastName: lastName || null,
            company: company || null,
            title: title || null,
            customFieldsJson: Object.keys(customFields).length ? JSON.stringify(customFields) : null,
            status: "ACTIVE"
          },
          update: {
            firstName: firstName !== undefined ? firstName : undefined,
            lastName: lastName !== undefined ? lastName : undefined,
            company: company !== undefined ? company : undefined,
            title: title !== undefined ? title : undefined,
            customFieldsJson: Object.keys(customFields).length ? JSON.stringify(customFields) : undefined
          }
        });

        if (targetListId) {
          await prisma.contactListMember.upsert({
            where: {
              listId_contactId: {
                listId: targetListId,
                contactId: contact.id
              }
            },
            create: {
              listId: targetListId,
              contactId: contact.id
            },
            update: {}
          });
        }

        imported++;
      } catch (e: any) {
        skipped++;
        errors.push(`${email}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      listId: targetListId,
      errors: errors.slice(0, 10)
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
