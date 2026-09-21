"use client";

import React from "react";
import { ChevronLeft, ChevronRight, User, Mail, Building, Eye, Tag } from "lucide-react";

interface RecipientPreviewProps {
  currentIndex: number;
  totalRecipients: number;
  onIndexChange: (newIndex: number) => void;
  renderedSubject: string;
  renderedHtml: string;
  recipientData: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
    title?: string | null;
    customFields?: Record<string, any>;
  };
  senderEmail?: string;
  senderName?: string;
}

export function RecipientPreview({
  currentIndex,
  totalRecipients,
  onIndexChange,
  renderedSubject,
  renderedHtml,
  recipientData,
  senderEmail = "alex@acmegrowth.com",
  senderName = "Alex Vance"
}: RecipientPreviewProps) {
  const hasMultiple = totalRecipients > 1;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col shadow-xl backdrop-blur-sm">
      {/* Top Preview Controls Bar */}
      <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Eye className="w-4 h-4 text-indigo-400" />
          <span>Live Recipient Preview</span>
        </div>

        {/* Carousel Stepper */}
        {hasMultiple && (
          <div className="flex items-center gap-2 text-xs">
            <button
              disabled={currentIndex <= 0}
              onClick={() => onIndexChange(currentIndex - 1)}
              className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-400 font-medium">
              Recipient <strong className="text-white">{currentIndex + 1}</strong> of{" "}
              <strong className="text-white">{totalRecipients}</strong>
            </span>
            <button
              disabled={currentIndex >= totalRecipients - 1}
              onClick={() => onIndexChange(currentIndex + 1)}
              className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Recipient Snapshot Card */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/30 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
          <Mail className="w-3.5 h-3.5 text-indigo-400" />
          <span>{recipientData.email}</span>
        </div>

        {(recipientData.firstName || recipientData.lastName) && (
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span>{[recipientData.firstName, recipientData.lastName].filter(Boolean).join(" ")}</span>
          </div>
        )}

        {recipientData.company && (
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
            <Building className="w-3.5 h-3.5 text-emerald-400" />
            <span>{recipientData.company}</span>
          </div>
        )}

        {recipientData.customFields && Object.keys(recipientData.customFields).length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Tag className="w-3 h-3 text-amber-400" />
            <span>
              {Object.entries(recipientData.customFields)
                .slice(0, 2)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </span>
          </div>
        )}
      </div>

      {/* Email Client Simulated Window */}
      <div className="p-5 space-y-4">
        {/* Email Header Simulation */}
        <div className="space-y-2 pb-4 border-b border-slate-800/80 text-xs">
          <div className="flex items-baseline gap-2">
            <span className="text-slate-500 font-semibold w-16">From:</span>
            <span className="text-slate-200">
              {senderName} &lt;{senderEmail}&gt;
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-slate-500 font-semibold w-16">To:</span>
            <span className="text-slate-200 font-medium">
              {[recipientData.firstName, recipientData.lastName].filter(Boolean).join(" ") || recipientData.email} &lt;
              {recipientData.email}&gt;
            </span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-slate-500 font-semibold w-16">Subject:</span>
            <span className="text-slate-100 font-semibold text-sm">
              {renderedSubject || "(No subject provided)"}
            </span>
          </div>
        </div>

        {/* Rendered Email Body */}
        <div className="rounded-xl p-5 bg-white text-slate-900 text-sm shadow-inner min-h-[220px]">
          {renderedHtml ? (
            <div
              className="prose prose-sm max-w-none text-slate-800 font-normal leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <p className="text-slate-400 italic">No body content defined yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
