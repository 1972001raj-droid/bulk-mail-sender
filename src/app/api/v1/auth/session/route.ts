import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionContext();
    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
