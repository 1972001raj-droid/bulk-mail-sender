"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, X, Rocket, Calendar, ShieldCheck, Loader2 } from "lucide-react";
import { PreflightCheckItem } from "@/lib/email/preflight";

interface PreflightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSend: () => void;
  checks: PreflightCheckItem[];
  canSend: boolean;
  isSending: boolean;
  totalRecipients: number;
  mode: "now" | "schedule";
  scheduledDate?: string;
  senderEmail?: string;
}

export function PreflightModal({
  isOpen,
  onClose,
  onConfirmSend,
  checks,
  canSend,
  isSending,
  totalRecipients,
  mode,
  scheduledDate,
  senderEmail
}: PreflightModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Pre-flight Launch Checklist</h3>
              <p className="text-xs text-slate-400">Verifying outreach readiness & provider compliance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Summary Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block">Sending From:</span>
              <span className="font-medium text-white">{senderEmail || "Primary Mailbox"}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block">Total Audience:</span>
              <span className="font-bold text-indigo-400 text-sm">{totalRecipients} recipients</span>
            </div>
          </div>

          {/* Checklist Items */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300">System Verification Checks</span>
            <div className="space-y-2">
              {checks.map((c) => {
                const isPass = c.status === "PASS";
                const isWarn = c.status === "WARN";
                const isFail = c.status === "FAIL";

                return (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-3 transition-colors ${
                      isPass
                        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-300"
                        : isWarn
                        ? "bg-amber-500/5 border-amber-500/20 text-amber-300"
                        : "bg-rose-500/5 border-rose-500/20 text-rose-300"
                    }`}
                  >
                    {isPass && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
                    {isWarn && <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />}
                    {isFail && <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />}

                    <div className="flex-1">
                      <div className="font-semibold text-slate-200">{c.label}</div>
                      <div className="text-slate-400 mt-0.5">{c.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {canSend ? "All required checks passed." : "Fix critical failures before sending."}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Back to Editor
            </button>
            <button
              disabled={!canSend || isSending}
              onClick={onConfirmSend}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === "now"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-600/30"
                  : "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-600/30"
              }`}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Queueing campaign...</span>
                </>
              ) : mode === "now" ? (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>Confirm & Send Now</span>
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  <span>Confirm & Schedule</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
