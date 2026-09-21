import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { Send, Plus, Search, Calendar, Users, Eye, ArrowUpRight, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams?: { status?: string; search?: string };
}) {
  const session = await getSessionContext();
  const selectedStatus = searchParams?.status;
  const searchQuery = searchParams?.search;

  const where: any = { organizationId: session.organizationId };
  if (selectedStatus && selectedStatus !== "ALL") {
    where.status = selectedStatus;
  }
  if (searchQuery) {
    where.name = { contains: searchQuery };
  }

  const campaigns = await prisma.campaign.findMany({
    where,
    include: {
      sender: true,
      contactList: true,
      _count: { select: { recipients: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const statuses = ["ALL", "DRAFT", "READY", "SCHEDULED", "RUNNING", "COMPLETED", "PAUSED"];

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Outreach Campaigns</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your mail merges, scheduled broadcasts, and follow-up drip sequences.
          </p>
        </div>

        <Link
          href="/dashboard/campaigns/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs border-b border-slate-800/80">
        {statuses.map((st) => {
          const isActive = (!selectedStatus && st === "ALL") || selectedStatus === st;
          return (
            <Link
              key={st}
              href={`/dashboard/campaigns${st === "ALL" ? "" : `?status=${st}`}`}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-all ${
                isActive
                  ? "bg-indigo-600/20 border border-indigo-500/40 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              {st}
            </Link>
          );
        })}
      </div>

      {/* Campaigns Table / Cards */}
      {campaigns.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-slate-900/30 border border-dashed border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <Send className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">No campaigns found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {selectedStatus ? `There are no campaigns with status ${selectedStatus}.` : "Get started by building your first personalized outreach campaign."}
          </p>
          <Link
            href="/dashboard/campaigns/new"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Campaign
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-5 font-semibold">Campaign Name</th>
                <th className="py-3.5 px-4 font-semibold">Sender Mailbox</th>
                <th className="py-3.5 px-4 font-semibold">Audience</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Created</th>
                <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-5 font-medium text-white">
                    <Link
                      href={`/dashboard/campaigns/${c.id}`}
                      className="hover:text-indigo-400 transition-colors flex items-center gap-2 group"
                    >
                      <span>{c.name}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    {c.subject && (
                      <div className="text-[11px] text-slate-500 font-normal truncate max-w-xs mt-0.5">
                        {c.subject}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-300">
                    {c.sender ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{c.sender.email}</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">No sender attached</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c._count.recipients} recipients</span>
                    </span>
                  </td>
                  <td className="py-4 px-4">
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
                  </td>
                  <td className="py-4 px-4 text-slate-400 text-[11px]">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <Link
                      href={`/dashboard/campaigns/${c.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-medium transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Manage</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
