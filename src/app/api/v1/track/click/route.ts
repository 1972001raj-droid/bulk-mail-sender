import { NextResponse } from "next/server";

// Do not redirect from attacker-controlled legacy query parameters.
export function GET() {
  return NextResponse.json({ error: "This tracking link has expired." }, { status: 410 });
}
