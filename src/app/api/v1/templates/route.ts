import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { extractVariables } from "@/lib/email/personalization";

export async function GET() {
  try {
    const session = await getSessionContext();
    const templates = await prisma.template.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({ success: true, templates });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const { name, subject, htmlBody, textBody } = body;

    if (!name || !subject || !htmlBody) {
      return NextResponse.json({ success: false, error: "Name, subject, and htmlBody are required" }, { status: 400 });
    }

    const variables = Array.from(new Set([...extractVariables(subject), ...extractVariables(htmlBody)]));

    const template = await prisma.template.create({
      data: {
        organizationId: session.organizationId,
        name,
        subject,
        htmlBody,
        textBody: textBody || htmlBody.replace(/<[^>]*>/g, ""),
        variablesJson: JSON.stringify(variables)
      }
    });

    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
