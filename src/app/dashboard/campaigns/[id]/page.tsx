"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Send,
  MailCheck,
  MousePointerClick,
  MessageSquare,
  AlertTriangle,
  Play,
  Pause,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Zap,
  Tag
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { RapidQueueDashboard } from "@/components/campaigns/RapidQueueDashboard";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"recipients" | "events">("recipients");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/v1/campaigns/${id}/analytics`);
      const result = await res.json();
      if (result.success) {
        setData(result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchCampaign();
    const interval = setInterval(fetchCampaign, 10000); // 10s live polling
    return () => clearInterval(interval);
  }, [id]);

  const handlePauseResume = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/v1/campaigns/${id}/pause`, { method: "POST" });
      await fetchCampaign();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriggerSendBatch = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/v1/campaigns/${id}/send`, { method: "POST" });
      await fetchCampaign();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  // Live simulation triggers to test features interactively
  const handleSimulateOpen = async (recipientId: string) => {
    await fetch(`/api/v1/track/open?msgId=${recipientId}`);
    // Also directly update state in db if msgId was recipient
    await fetchCampaign();
  };

  const handleSimulateReply = async (email: string) => {
    await fetch("/api/v1/webhooks/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        replySnippet: "Hey Alex! Thanks for reaching out. Let's do a demo next Tuesday."
      })
    });
    await fetchCampaign();
  };

  if (loading || !data) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-400">Loading campaign analytics & outbox events...</p>
      </div>
    );
  }

  const { metrics, campaign, recipients, recentEvents } = data;
  const filteredRecipients =
    statusFilter === "ALL" ? recipients : recipients.filter((r: any) => r.status === statusFilter);

  const sentPercent = metrics.total > 0 ? Math.round((metrics.sent / metrics.total) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/campaigns"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">{campaign.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  campaign.status === "COMPLETED"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : campaign.status === "RUNNING"
                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {campaign.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sender: {campaign.senderEmail || "Primary Mailbox"} · Launched on{" "}
              {new Date(campaign.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCampaign}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh analytics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {campaign.status === "RUNNING" && (
            <button
              disabled={actionLoading}
              onClick={handlePauseResume}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Campaign</span>
            </button>
          )}

          {campaign.status === "PAUSED" && (
            <button
              disabled={actionLoading}
              onClick={handlePauseResume}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume Campaign</span>
            </button>
          )}

          {["DRAFT", "READY", "PAUSED"].includes(campaign.status) && (
            <button
              disabled={actionLoading}
              onClick={handleTriggerSendBatch}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Dispatch Next Batch</span>
            </button>
          )}
        </div>
      </div>

      {/* Delivery Progress Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            Outbox Delivery Progress
          </span>
          <span className="font-semibold text-white">
            {metrics.sent} of {metrics.total} Sent ({sentPercent}%)
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${sentPercent}%` }}
          />
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Sent / Delivered"
          value={`${metrics.sent} / ${metrics.delivered}`}
          subtitle={`${metrics.total - metrics.sent} pending in queue`}
          icon={Send}
          color="indigo"
        />
        <StatCard
          title="Open Rate"
          value={`${metrics.openRate}%`}
          subtitle={`${metrics.opened} opened emails`}
          icon={MailCheck}
          color="emerald"
        />
        <StatCard
          title="Click-Through"
          value={`${metrics.clickRate}%`}
          subtitle={`${metrics.clicked} link clicks`}
          icon={MousePointerClick}
          color="cyan"
        />
        <StatCard
          title="Reply Rate"
          value={`${metrics.replyRate}%`}
          subtitle={`${metrics.replied} matched prospect replies`}
          icon={MessageSquare}
          color="amber"
        />
      </div>

      {/* Rapid Email Queue & High-Throughput Engine Section */}
      <RapidQueueDashboard
        campaignId={id}
        campaignStatus={campaign.status}
        onRefreshParent={fetchCampaign}
      />

      {/* Tabs & Table */}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
        {/* Tab Controls */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("recipients")}
              className={`pb-1 border-b-2 transition-all ${
                activeTab === "recipients"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Audience Activity ({recipients.length})
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={`pb-1 border-b-2 transition-all ${
                activeTab === "events"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Live Event Stream ({recentEvents.length})
            </button>
          </div>

          {/* Status Filter for Recipients */}
          {activeTab === "recipients" && (
            <div className="flex items-center gap-1 text-xs">
              {["ALL", "SENT", "OPENED", "CLICKED", "REPLIED", "BOUNCED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    statusFilter === st
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recipients Tab Table */}
        {activeTab === "recipients" && (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-5 font-semibold">Recipient</th>
                <th className="py-3 px-4 font-semibold">Company</th>
                <th className="py-3 px-4 font-semibold">Delivery State</th>
                <th className="py-3 px-4 font-semibold">Provider ID</th>
                <th className="py-3 px-5 font-semibold text-right">Simulation Test Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredRecipients.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="font-medium text-white">{r.name}</div>
                    <div className="text-[11px] text-slate-400">{r.email}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">{r.company}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        r.status === "REPLIED"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : r.status === "CLICKED"
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                          : r.status === "OPENED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : r.status === "SENT"
                          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          : r.status === "BOUNCED"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : r.status === "FAILED"
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.lastError && (
                      <p
                        className="text-[10px] text-rose-400/90 mt-1 max-w-[220px] truncate cursor-help"
                        title={r.lastError}
                      >
                        ⚠️ {r.lastError}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 truncate max-w-[140px]">
                    {r.status === "FAILED" ? (
                      <span className="text-rose-400/70 italic">Rejected by provider</span>
                    ) : (
                      r.providerMessageId || "Queued"
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => handleSimulateOpen(r.id)}
                        title="Simulate recipient opening email"
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-[11px] font-medium transition-colors"
                      >
                        Simulate Open
                      </button>
                      <button
                        onClick={() => handleSimulateReply(r.email)}
                        title="Simulate recipient sending a reply"
                        className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-medium transition-colors"
                      >
                        Simulate Reply
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Live Event Stream Tab */}
        {activeTab === "events" && (
          <div className="p-6 divide-y divide-slate-800/60">
            {recentEvents.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No events logged yet.</p>
            ) : (
              recentEvents.map((ev: any) => (
                <div key={ev.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                    <div>
                      <span className="font-semibold text-white">{ev.type}</span>
                      <span className="text-slate-400 ml-2">to {ev.recipientEmail}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(ev.occurredAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
