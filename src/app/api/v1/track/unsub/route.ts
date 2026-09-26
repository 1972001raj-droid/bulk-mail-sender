import { NextResponse } from "next/server";

// Legacy GET unsubscribe links no longer change subscription state. New mail uses
// a signed token under /api/v1/u/:token and a POST for the actual opt-out.
export function GET() {
  return new NextResponse("This unsubscribe link has expired.", { status: 410 });
}
