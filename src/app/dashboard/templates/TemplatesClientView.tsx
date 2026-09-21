"use client";

import React, { useState } from "react";
import {
  FileText,
  Plus,
  Tag,
  ArrowRight,
  Edit2,
  Trash2,
  Copy,
  Sparkles,
  Search,
  CheckCircle2,
  Layers,
  Wand2,
  Calendar
} from "lucide-react";
import Link from "next/link";
import { EmailBuilder, EmailBlock } from "@/components/templates/EmailBuilder";

interface TemplateRecord {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  variablesJson: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface TemplatesClientViewProps {
  initialTemplates: TemplateRecord[];
}

export function TemplatesClientView({ initialTemplates }: TemplatesClientViewProps) {
  const [templates, setTemplates] = useState<TemplateRecord[]>(initialTemplates);
  const [search, setSearch] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const reloadTemplates = async () => {
    try {
      const res = await fetch("/api/v1/templates");
      const data = await res.json();
      if (data.success) setTemplates(data.templates);
    } catch (e) {
      console.error(e);
    }
  };

  // Open builder to create new
  const handleOpenNew = () => {
    setEditingTemplate(null);
    setBuilderOpen(true);
  };

  // Open builder to edit
  const handleOpenEdit = (tmpl: TemplateRecord) => {
    setEditingTemplate(tmpl);
    setBuilderOpen(true);
  };

  // Delete template
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;

    try {
      const res = await fetch(`/api/v1/templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        showToast(`Template "${name}" deleted`);
      } else {
        alert(data.error || "Failed to delete");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    }
  };

  // Duplicate template
  const handleDuplicate = async (tmpl: TemplateRecord) => {
    try {
      const res = await fetch("/api/v1/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${tmpl.name} (Copy)`,
          subject: tmpl.subject,
          htmlBody: tmpl.htmlBody,
          textBody: tmpl.textBody
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Duplicated "${tmpl.name}"`);
        await reloadTemplates();
      }
    } catch (err: any) {
      alert(err.message || "Failed to duplicate");
    }
  };

  // Save handler from builder
  const handleSaveFromBuilder = async (data: {
    name: string;
    subject: string;
    htmlBody: string;
    textBody: string;
  }) => {
    if (editingTemplate) {
      // Update existing
      const res = await fetch(`/api/v1/templates/${editingTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const resData = await res.json();
      if (resData.success) {
        showToast(`Template "${data.name}" updated!`);
        await reloadTemplates();
      } else {
        throw new Error(resData.error);
      }
    } else {
      // Create new
      const res = await fetch("/api/v1/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const resData = await res.json();
      if (resData.success) {
        showToast(`New template "${data.name}" created!`);
        await reloadTemplates();
      } else {
        throw new Error(resData.error);
      }
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase())
  );

  // Parse blocks if stored in textBody
  const parseBlocks = (textBody: string | null): EmailBlock[] | undefined => {
    if (!textBody) return undefined;
    try {
      const parsed = JSON.parse(textBody);
      if (parsed && Array.isArray(parsed.blocks)) {
        return parsed.blocks;
      }
    } catch {
      // not json
    }
    return undefined;
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-16 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl bg-emerald-600 text-white shadow-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Email Templates Library</h1>
          <p className="text-xs text-slate-400 mt-1">
            Design beautiful, personalized email templates with our drag-and-drop block builder.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
        >
          <Sparkles className="w-4 h-4" />
          <span>Drag & Drop Builder</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search templates by name or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <span className="text-xs text-slate-400">
          {filteredTemplates.length} {filteredTemplates.length === 1 ? "template" : "templates"}
        </span>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-slate-900/30 border border-dashed border-slate-800 space-y-3">
          <FileText className="w-10 h-10 text-indigo-400/50 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No templates found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create your first outreach template using the drag-and-drop builder with starter designs.
          </p>
          <button
            onClick={handleOpenNew}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Create First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredTemplates.map((tmpl) => {
            const variables: string[] = tmpl.variablesJson ? JSON.parse(tmpl.variablesJson) : [];

            return (
              <div
                key={tmpl.id}
                className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-indigo-500/40 transition-all shadow-sm group"
              >
                <div>
                  {/* Card Top Title & Quick Actions */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {tmpl.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          Subject: {tmpl.subject}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(tmpl)}
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white transition-all"
                        title="Edit in Drag & Drop Builder"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(tmpl)}
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                        title="Duplicate Template"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(tmpl.id, tmpl.name)}
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-600 text-slate-400 hover:text-white transition-all"
                        title="Delete Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Body Preview */}
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 line-clamp-3 leading-relaxed">
                    {tmpl.htmlBody.replace(/<[^>]*>/g, " ")}
                  </div>

                  {/* Variables */}
                  {variables.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-indigo-400" /> Tags:
                      </span>
                      {variables.map((v) => (
                        <span
                          key={v}
                          className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-[10px] text-indigo-300 font-mono"
                        >
                          &#123;&#123;{v}&#125;&#125;
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(tmpl.updatedAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleOpenEdit(tmpl)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Builder</span>
                    </button>
                    <Link
                      href="/dashboard/campaigns/new"
                      className="inline-flex items-center gap-1 text-slate-300 hover:text-white font-medium"
                    >
                      <span>Use in Campaign</span> <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL-SCREEN DRAG & DROP BUILDER MODAL */}
      {builderOpen && (
        <EmailBuilder
          initialName={editingTemplate ? editingTemplate.name : "New Outreach Pitch"}
          initialSubject={editingTemplate ? editingTemplate.subject : "Quick question regarding {{company}}"}
          initialBlocks={editingTemplate ? parseBlocks(editingTemplate.textBody) : undefined}
          onSave={handleSaveFromBuilder}
          onClose={() => setBuilderOpen(false)}
        />
      )}
    </div>
  );
}
