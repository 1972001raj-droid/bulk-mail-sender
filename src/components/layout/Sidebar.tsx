"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Send,
  Users,
  FileText,
  GitMerge,
  MailCheck,
  Building2,
  CheckCircle2,
  Radio
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Campaigns", href: "/dashboard/campaigns", icon: Send },
    { label: "Contacts & Lists", href: "/dashboard/contacts", icon: Users },
    { label: "Templates", href: "/dashboard/templates", icon: FileText },
    { label: "Sequences", href: "/dashboard/sequences", icon: GitMerge },
    { label: "Sender Accounts", href: "/dashboard/senders", icon: MailCheck },
    { label: "Team & Audit", href: "/dashboard/team", icon: Building2 },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-[#0b1120]/90 flex flex-col h-screen sticky top-0 backdrop-blur-md select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Send className="w-5 h-5 text-white -rotate-12" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                AeroSend
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Outreach Platform</p>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Workspace
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mailbox Status Widget */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/90 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Direct Outreach Engine
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> Real SMTP Delivery
            </span>
            <span className="text-slate-300 font-medium">Zero Quota Limits</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
