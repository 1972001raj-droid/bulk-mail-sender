import { NextRequest, NextResponse } from "next/server";
import { AIEmailAssistant } from "@/lib/ai/generator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await AIEmailAssistant.generate({
      action: body.action || "draft",
      prompt: body.prompt,
      currentSubject: body.currentSubject,
      currentBody: body.currentBody,
      recipientContext: body.recipientContext
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
