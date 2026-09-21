"use client";

import React, { useState } from "react";
import { Sparkles, X, Wand2, Check, ArrowRight, Loader2, Lightbulb } from "lucide-react";

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (content: { subject?: string; body?: string }) => void;
  currentSubject?: string;
  currentBody?: string;
}

export function AIAssistantModal({
  isOpen,
  onClose,
  onApply,
  currentSubject = "",
  currentBody = ""
}: AIAssistantModalProps) {
  const [action, setAction] = useState<"draft" | "shorten" | "formal" | "friendly" | "subjects">("draft");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    subject?: string;
    body?: string;
    subjectSuggestions?: string[];
    explanation?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          prompt,
          currentSubject,
          currentBody
        })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">AeroSend AI Outreach Assistant</h3>
              <p className="text-xs text-slate-400">Generate high-converting personalized email copy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Action Tabs */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Goal / Action</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { id: "draft", label: "Draft New" },
                { id: "shorten", label: "Make Short" },
                { id: "formal", label: "Professional" },
                { id: "friendly", label: "Friendly" },
                { id: "subjects", label: "Subject Lines" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setAction(t.id as any);
                    setResult(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center ${
                    action === t.id
                      ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {action === "draft"
                ? "What are you reaching out about? (Topic, offer, audience)"
                : "Additional instructions (optional)"}
            </label>
            <textarea
              rows={3}
              placeholder={
                action === "draft"
                  ? "e.g. Introduce our B2B sales automation platform to SaaS founders, offering a free 14-day trial..."
                  : "e.g. Keep it under 60 words and emphasize our zero-setup guarantee..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Generate Button */}
          <button
            disabled={loading}
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating copy with AI...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Generate Output</span>
              </>
            )}
          </button>

          {/* Generated Result Preview */}
          {result && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-indigo-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" /> AI Recommendation
                </span>
                <span className="text-[11px] text-slate-400">{result.explanation}</span>
              </div>

              {result.subject && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                    Subject Line
                  </span>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-white">
                    {result.subject}
                  </div>
                </div>
              )}

              {result.subjectSuggestions && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                    High-Converting Subject Options
                  </span>
                  <div className="space-y-1">
                    {result.subjectSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => onApply({ subject: s })}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 cursor-pointer text-xs text-slate-200 flex items-center justify-between group transition-colors"
                      >
                        <span>{s}</span>
                        <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 flex items-center gap-1">
                          Use <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.body && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                    Body Content
                  </span>
                  <div
                    className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 prose prose-invert max-w-none line-clamp-6 overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: result.body }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          {result && (result.body || result.subject) && (
            <button
              onClick={() => {
                onApply({
                  subject: result.subject,
                  body: result.body
                });
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply to Campaign Editor</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
