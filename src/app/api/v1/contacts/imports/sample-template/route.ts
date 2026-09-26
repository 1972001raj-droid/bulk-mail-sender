import { NextResponse } from "next/server";

export async function GET() {
  // UTF-8 BOM (\uFEFF) ensures Microsoft Excel on Windows parses commas and characters correctly
  const bom = "\uFEFF";
  const csvContent =
    bom +
    [
      "Email,First Name,Last Name,Company,Title,Phone,City",
      "alex.vance@aerosend.dev,Alex,Vance,AeroSend,Chief Architect,+1-555-0199,San Francisco",
      "sarah.connor@cyberdyne.io,Sarah,Connor,Cyberdyne Systems,Head of Security,+1-555-0142,Los Angeles",
      "michael.scott@dundermifflin.com,Michael,Scott,Dunder Mifflin,Regional Manager,+1-555-0177,Scranton",
      "elena.rostova@innovate.tech,Elena,Rostova,InnovateTech,VP of Product,+1-555-0123,New York",
      "david.kim@nexusgrowth.co,David,Kim,Nexus Growth,Director of Outreach,+1-555-0188,Austin"
    ].join("\r\n");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sample_contacts_model.csv"',
      "Cache-Control": "public, max-age=86400"
    }
  });
}
