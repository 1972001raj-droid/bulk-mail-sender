import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { StatCard } from "@/components/ui/StatCard";
import {
  Send,
  MailCheck,
  MousePointerClick,
  MessageSquare,
  Users,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSessionContext();
  const orgId = session.organizationId;

  // Aggregate stats
  const [
    campaignCount,
    contactCount,
    senders,
    recentCampaigns,
    recipientStats
  ] = await Promise.all([
    prisma.campaign.count({ where: { organizationId: orgId } }),
    prisma.contact.count({ where: { organizationId: orgId } }),
    prisma.sender.findMany({
      where: { organizationId: orgId },
      include: { providerAccounts: true }
    }),
    prisma.campaign.findMany({
      where: { organizationId: orgId },
      include: {
        sender: true,
        _count: { select: { recipients: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.campaignRecipient.groupBy({
      by: ["status"],
      where: { campaign: { organizationId: orgId } },
      _count: { status: true }
    })
  ]);

  const statusCounts: Record<string, number> = {};
  recipientStats.forEach((s) => {
    statusCounts[s.status] = s._count.status;
  });

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const sent = (statusCounts["SENT"] || 0) + (statusCounts["OPENED"] || 0) + (statusCounts["CLICKED"] || 0) + (statusCounts["REPLIED"] || 0);
  const opened = (statusCounts["OPENED"] || 0) + (statusCounts["CLICKED"] || 0) + (statusCounts["REPLIED"] || 0);
  const clicked = (statusCounts["CLICKED"] || 0) + (statusCounts["REPLIED"] || 0);
  const replied = statusCounts["REPLIED"] || 0;
  const bounced = statusCounts["BOUNCED"] || 0;

  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0";
  const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0";
  const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/30 border border-indigo-500/20 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Campaign Intelligence Overview</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              HEALTHY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time aggregate engagement and mailbox status across all connected providers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/contacts"
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-2"
          >
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Manage Contacts</span>
          </Link>
          <Link
            href="/dashboard/campaigns/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all hover:scale-105"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Sent Emails"
          value={sent.toLocaleString()}
          subtitle="Provider-accepted outreach"
          icon={Send}
          color="indigo"
          trend="+14% this week"
        />
        <StatCard
          title="Average Open Rate"
          value={`${openRate}%`}
          subtitle={`${opened} opened of ${sent} sent`}
          icon={MailCheck}
          color="emerald"
          trend="Top tier"
        />
        <StatCard
          title="Click-Through Rate"
          value={`${clickRate}%`}
          subtitle={`${clicked} tracked link clicks`}
          icon={MousePointerClick}
          color="cyan"
          trend="High intent"
        />
        <StatCard
          title="Reply Rate"
          value={`${replyRate}%`}
          subtitle={`${replied} matched prospect replies`}
          icon={MessageSquare}
          color="amber"
          trend="Auto-stopped sequences"
        />
      </div>

      {/* Two Column Layout: Connected Senders & Active Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Campaigns */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/50 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-white">Recent Outreach Campaigns</h3>
                <p className="text-xs text-slate-400">Track delivery state, audience size, and performance</p>
              </div>
              <Link
                href="/dashboard/campaigns"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentCampaigns.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-slate-800">
                <p className="text-xs text-slate-400">No campaigns created yet.</p>
                <Link
                  href="/dashboard/campaigns/new"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white"
                >
                  <Plus className="w-3 h-3" /> Create First Campaign
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/campaigns/${c.id}`}
                    className="block p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-950 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform">
                          <Send className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                            {c.name}
                          </h4>
                          <span className="text-[11px] text-slate-400">
                            From {c.sender?.email || "No sender"} · {c._count.recipients} recipients
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            c.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : c.status === "RUNNING"
                              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse"
                              : c.status === "SCHEDULED"
                              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {c.status}
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Connected Senders & Health */}
        <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-white">Connected Senders</h3>
                <p className="text-xs text-slate-400">Mailbox health & outreach status</p>
              </div>
              <Link
                href="/dashboard/senders"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Manage
              </Link>
            </div>

            <div className="space-y-3.5">
              {senders.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
                  <p className="text-xs text-slate-400">No mailboxes connected.</p>
                  <Link
                    href="/dashboard/senders"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline"
                  >
                    Connect Mailbox
                  </Link>
                </div>
              ) : (
                senders.map((s) => {
                  const provider = s.providerAccounts[0]?.provider || "smtp";
                  const isConnected = s.status === "CONNECTED";

                  return (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                          <span className="text-xs font-semibold text-white">{s.email}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {provider}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/50">
                        <span className={isConnected ? "text-emerald-400" : "text-amber-400"}>
                          {isConnected ? "Ready to send" : "Reauth required"}
                        </span>
                        <span className="font-semibold text-slate-200">
                          {s.sentToday} sent
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <Link
              href="/dashboard/senders"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Connect Another Mailbox
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
