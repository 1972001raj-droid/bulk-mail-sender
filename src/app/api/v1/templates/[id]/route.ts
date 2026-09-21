import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { extractVariables } from "@/lib/email/personalization";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const template = await prisma.template.findFirst({
      where: { id: params.id, organizationId: session.organizationId }
    });

    if (!template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const body = await req.json();
    const { name, subject, htmlBody, textBody } = body;

    const existing = await prisma.template.findFirst({
      where: { id: params.id, organizationId: session.organizationId }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    const updatedSubject = subject !== undefined ? subject : existing.subject;
    const updatedHtml = htmlBody !== undefined ? htmlBody : existing.htmlBody;
    const variables = Array.from(new Set([...extractVariables(updatedSubject), ...extractVariables(updatedHtml)]));

    const updated = await prisma.template.update({
      where: { id: params.id },
      data: {
        name: name !== undefined ? name : existing.name,
        subject: updatedSubject,
        htmlBody: updatedHtml,
        textBody: textBody !== undefined ? textBody : existing.textBody,
        variablesJson: JSON.stringify(variables)
      }
    });

    return NextResponse.json({ success: true, template: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const existing = await prisma.template.findFirst({
      where: { id: params.id, organizationId: session.organizationId }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    await prisma.template.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
