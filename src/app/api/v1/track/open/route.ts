import { NextResponse } from "next/server";

// Legacy message-ID tracking URLs are deliberately inert. New mail uses opaque,
// single-purpose tokens under /api/v1/t/o/:token.
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export function GET() {
  return new NextResponse(TRANSPARENT_GIF, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
  });
}
