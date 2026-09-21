import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AeroSend — Personalized Email Outreach SaaS",
  description:
    "Production-grade personalized email outreach platform inspired by Mailmeteor. Connect your Gmail, Outlook, or Zoho mailboxes, compose with dynamic variables, track engagement, and automate follow-ups.",
  keywords: "email outreach, mail merge, mailmeteor alternative, cold outreach, gmail outreach, outlook outreach, bulk mail sender"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080c14] text-slate-100 selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
