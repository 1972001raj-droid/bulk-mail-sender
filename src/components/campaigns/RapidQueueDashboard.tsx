"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  Activity,
  Cpu,
  Layers,
  Settings2,
  RefreshCw,
  Play,
  Pause,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Sliders,
  Shield,
  HelpCircle,
} from "lucide-react";
import { QueueConfig, QueueStatusMetrics, DEFAULT_QUEUE_CONFIG } from "@/lib/queue/types";

interface RapidQueueDashboardProps {
  campaignId: string;
  campaignStatus: string;
  onRefreshParent?: () => void;
}

export function RapidQueueDashboard({
  campaignId,
  campaignStatus,
  onRefreshParent,
}: RapidQueueDashboardProps) {
  const [metrics, setMetrics] = useState<QueueStatusMetrics | null>(null);
  const [config, setConfig] = useState<QueueConfig>(DEFAULT_QUEUE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state for config editor
  const [formConfig, setFormConfig] = useState<QueueConfig>(DEFAULT_QUEUE_CONFIG);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/queue/status`);
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
        if (data.metrics.config) {
          setConfig(data.metrics.config);
        }
      }
    } catch (e: any) {
      console.error("Failed to fetch queue status:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 3 seconds if campaign is RUNNING or has remaining queue
    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [campaignId]);

  const handleStartQueue = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSuccessMsg("Rapid Queue started!");
      await fetchStatus();
      if (onRefreshParent) onRefreshParent();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to start queue");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseQueue = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/queue/pause`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSuccessMsg("Queue paused");
      await fetchStatus();
      if (onRefreshParent) onRefreshParent();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to pause queue");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeQueue = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/queue/resume`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSuccessMsg("Queue resumed");
      await fetchStatus();
      if (onRefreshParent) onRefreshParent();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to resume queue");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelQueue = async () => {
    if (!confirm("Are you sure you want to cancel the queue? Pending jobs will be cancelled.")) {
      return;
    }
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/queue/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSuccessMsg("Queue cancelled");
      await fetchStatus();
      if (onRefreshParent) onRefreshParent();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to cancel queue");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingConfig(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/queue/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formConfig),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setConfig(data.config);
      setSuccessMsg("Queue configuration updated dynamically!");
      setShowConfigModal(false);
      await fetchStatus();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to update configuration");
    } finally {
      setUpdatingConfig(false);
    }
  };

  const openConfigModal = () => {
    setFormConfig({ ...config });
    setShowConfigModal(true);
  };

  // Calculations for rate comparison
  const workerCapacity = config.workerCount * config.emailsPerWorkerPerSecond;
  const effectiveRate = Math.min(workerCapacity, config.globalRateLimit);
  const isGlobalThrottling = config.globalRateLimit < workerCapacity;

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Queue Dashboard Container */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Rapid Email Queue & High-Throughput Engine
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {metrics?.status || campaignStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Central rate controlled, multi-worker asynchronous dispatch with exponential retry.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh queue status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={openConfigModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
            >
              <Settings2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Configure Queue</span>
            </button>

            {metrics?.status === "RUNNING" ? (
              <>
                <button
                  disabled={actionLoading}
                  onClick={handlePauseQueue}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
                <button
                  disabled={actionLoading}
                  onClick={handleCancelQueue}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </>
            ) : metrics?.status === "PAUSED" ? (
              <>
                <button
                  disabled={actionLoading}
                  onClick={handleResumeQueue}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </button>
                <button
                  disabled={actionLoading}
                  onClick={handleCancelQueue}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </>
            ) : (
              <button
                disabled={actionLoading}
                onClick={handleStartQueue}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Launch Rapid Queue</span>
              </button>
            )}
          </div>
        </div>

        {/* Rate Controller Insights Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Worker Capacity
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-white tracking-tight">
                {workerCapacity}/sec
              </span>
              <span className="text-xs text-slate-500">
                ({config.workerCount} workers × {config.emailsPerWorkerPerSecond}/s)
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Global Rate Limit
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-indigo-400 tracking-tight">
                {config.globalRateLimit}/sec
              </span>
              <span className="text-xs text-slate-500">
                {isGlobalThrottling ? "(Active ceiling)" : "(Capacity within ceiling)"}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              Effective Throughput Target
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-400 tracking-tight">
                {effectiveRate}/sec
              </span>
              <span className="text-xs text-slate-400">
                Current: {metrics?.currentRate ?? 0}/sec
              </span>
            </div>
          </div>
        </div>

        {/* Live Queue Progress Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-medium">Total</span>
            <p className="text-lg font-bold text-white mt-0.5">
              {(metrics?.total ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
            <span className="text-[11px] text-indigo-300 font-medium">Queued</span>
            <p className="text-lg font-bold text-indigo-400 mt-0.5">
              {(metrics?.queued ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <span className="text-[11px] text-amber-300 font-medium">Processing</span>
            <p className="text-lg font-bold text-amber-400 mt-0.5">
              {(metrics?.processing ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <span className="text-[11px] text-emerald-300 font-medium">Sent</span>
            <p className="text-lg font-bold text-emerald-400 mt-0.5">
              {(metrics?.sent ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <span className="text-[11px] text-orange-300 font-medium">Retrying</span>
            <p className="text-lg font-bold text-orange-400 mt-0.5">
              {(metrics?.retrying ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
            <span className="text-[11px] text-rose-300 font-medium">Failed</span>
            <p className="text-lg font-bold text-rose-400 mt-0.5">
              {(metrics?.failed ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-medium">Cancelled</span>
            <p className="text-lg font-bold text-slate-300 mt-0.5">
              {(metrics?.cancelled ?? 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Estimated Completion and Queue Depth Bar */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>
              Queue Remaining:{" "}
              <strong className="text-white">
                {(metrics?.queueRemaining ?? 0).toLocaleString()}
              </strong>{" "}
              recipients
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Estimated Completion:</span>
            {metrics?.estimatedCompletionSeconds ? (
              <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-semibold">
                ~{Math.ceil(metrics.estimatedCompletionSeconds / 60)} min (
                {new Date(metrics.estimatedCompletionTime!).toLocaleTimeString()})
              </span>
            ) : (
              <span className="text-slate-500 italic">Calculating based on throughput...</span>
            )}
          </div>
        </div>

        {/* Worker Fleet Monitoring */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              Active Worker Fleet ({metrics?.activeWorkers || 0} / {metrics?.totalWorkers || config.workerCount})
            </h4>
            <span className="text-[11px] text-slate-500">Autonomous token bucket consumers</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(metrics?.workers && metrics.workers.length > 0
              ? metrics.workers
              : Array.from({ length: config.workerCount }).map((_, idx) => ({
                  id: `worker-${idx + 1}`,
                  name: `Worker ${idx + 1}`,
                  status: "IDLE" as const,
                  currentRate: 0,
                  jobsProcessed: 0,
                  jobsSucceeded: 0,
                  jobsFailed: 0,
                  lastActiveAt: new Date().toISOString(),
                }))
            ).map((worker) => (
              <div
                key={worker.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-white">{worker.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      worker.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : worker.status === "PAUSED"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : worker.status === "ERROR"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {worker.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Throughput:</span>
                  <span className="font-semibold text-slate-200">
                    {worker.currentRate}/sec
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                  <span>Processed:</span>
                  <span>{worker.jobsProcessed}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  Queue & High-Throughput Configuration
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Worker Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formConfig.workerCount}
                    onChange={(e) =>
                      setFormConfig({ ...formConfig, workerCount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Concurrent consumer processes</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Emails / Worker / Sec
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    max="100"
                    value={formConfig.emailsPerWorkerPerSecond}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        emailsPerWorkerPerSecond: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Speed per worker</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Global Rate Limit (/sec)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={formConfig.globalRateLimit}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        globalRateLimit: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Absolute ceiling across all workers</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Batch Size
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="2000"
                    value={formConfig.batchSize}
                    onChange={(e) =>
                      setFormConfig({ ...formConfig, batchSize: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Streaming chunk size</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Max Retries
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={formConfig.maxRetries}
                    onChange={(e) =>
                      setFormConfig({ ...formConfig, maxRetries: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">For transient SMTP errors</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Initial Retry Delay (seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={formConfig.initialRetryDelaySeconds}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        initialRetryDelaySeconds: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Base backoff duration</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Queue Priority
                  </label>
                  <select
                    value={formConfig.queuePriority}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        queuePriority: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="HIGH">HIGH (Prioritized first)</option>
                    <option value="NORMAL">NORMAL (Default priority)</option>
                    <option value="LOW">LOW (Background / non-urgent)</option>
                  </select>
                  <p className="text-[11px] text-slate-500">Dispatch priority tier</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Per-Account Rate Limit (/sec)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    max="500"
                    placeholder="Unlimited"
                    value={formConfig.perAccountRateLimit ?? ""}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        perAccountRateLimit: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Rate limit per SMTP sender account</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Daily Sending Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={formConfig.dailySendingLimit ?? ""}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        dailySendingLimit: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Max emails per 24 hours</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Hourly Sending Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={formConfig.hourlySendingLimit ?? ""}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        hourlySendingLimit: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Max emails per 1 hour</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Schedule Start Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={
                      formConfig.campaignStartTime
                        ? new Date(formConfig.campaignStartTime).toISOString().slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        campaignStartTime: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Dispatch will hold until this time</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Schedule End Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={
                      formConfig.campaignEndTime
                        ? new Date(formConfig.campaignEndTime).toISOString().slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        campaignEndTime: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">Dispatch stops after this time</p>
                </div>
              </div>

              {/* Per-Domain Throttling Toggle */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Per-Domain Throttling
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Prevents mailbox provider throttling (Gmail, Yahoo, Outlook)
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formConfig.perDomainThrottlingEnabled}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        perDomainThrottlingEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
                  />
                </div>

                {formConfig.perDomainThrottlingEnabled && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
                    {Object.entries(formConfig.domainRateLimits || {}).map(([domain, rate]) => (
                      <div key={domain} className="space-y-0.5">
                        <label className="text-[11px] text-slate-400">{domain}</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={rate}
                            onChange={(e) => {
                              const newLimits = { ...formConfig.domainRateLimits };
                              newLimits[domain] = Number(e.target.value);
                              setFormConfig({ ...formConfig, domainRateLimits: newLimits });
                            }}
                            className="w-full px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                          />
                          <span className="text-[10px] text-slate-500">/s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rate preview calculation */}
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                Target send rate:{" "}
                <strong>
                  {formConfig.workerCount * formConfig.emailsPerWorkerPerSecond} emails/sec
                </strong>
                . Effective rate capped at:{" "}
                <strong>
                  {Math.min(
                    formConfig.workerCount * formConfig.emailsPerWorkerPerSecond,
                    formConfig.globalRateLimit
                  )}{" "}
                  emails/sec
                </strong>
                .
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingConfig}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30"
                >
                  {updatingConfig ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
