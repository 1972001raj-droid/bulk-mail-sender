"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  FileText,
  GitMerge,
  Send,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  ArrowRight,
  Upload,
  Globe,
  Loader2,
  Tag
} from "lucide-react";
import { AIAssistantModal } from "@/components/campaigns/AIAssistantModal";
import { PreflightModal } from "@/components/campaigns/PreflightModal";
import { RecipientPreview } from "@/components/campaigns/RecipientPreview";
import { CSVImportModal } from "@/components/contacts/CSVImportModal";
import { PreflightCheckItem } from "@/lib/email/preflight";

function NewCampaignWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get("templateId");

  // Wizard Step: 1 = Audience, 2 = Content, 3 = Sequences, 4 = Review & Send
  const [currentStep, setCurrentStep] = useState(1);

  // Campaign State
  const [campaignName, setCampaignName] = useState("Q4 Founder Outreach");
  const [selectedSenderId, setSelectedSenderId] = useState("");
  const [selectedListId, setSelectedListId] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("Quick question regarding {{company}}'s outreach strategy");
  const [htmlBody, setHtmlBody] = useState(
    `<p>Hi {{firstName | "there"}},</p>\n<p>I noticed {{company}} has been expanding fast and wanted to share a quick idea regarding your outbound engine.</p>\n<p>We've helped teams scale personalized email outreach directly through your existing Google/Microsoft inbox, achieving 3x higher open rates than standard automation platforms.</p>\n<p>Would you be open to a 10-minute coffee chat next Tuesday?</p>\n<p>Best regards,<br/><strong>Alex Vance</strong><br/>Acme Growth Labs</p>`
  );
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  // Sequence Configuration
  const [enableSequence, setEnableSequence] = useState(false);
  const [sequenceSteps, setSequenceSteps] = useState([
    {
      stepNo: 1,
      delayDays: 2,
      subject: "Re: Quick question regarding {{company}}",
      htmlBody: "<p>Hi {{firstName}}, following up to see if you had 5 minutes this week?</p>"
    }
  ]);

  // Data Sources
  const [senders, setSenders] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [isPreflightModalOpen, setIsPreflightModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preflightChecks, setPreflightChecks] = useState<PreflightCheckItem[]>([]);
  const [canSend, setCanSend] = useState(false);

  // Preview Carousel State
  const [previewIndex, setPreviewIndex] = useState(0);

  // Fetch Senders and Lists
  useEffect(() => {
    async function loadData() {
      try {
        const [sendersRes, listsRes, contactsRes, templatesRes] = await Promise.all([
          fetch("/api/v1/senders"),
          fetch("/api/v1/lists"),
          fetch("/api/v1/contacts"),
          fetch("/api/v1/templates")
        ]);

        const sendersData = await sendersRes.json();
        const listsData = await listsRes.json();
        const contactsData = await contactsRes.json();
        const templatesData = await templatesRes.json();

        if (sendersData.success && sendersData.senders.length > 0) {
          setSenders(sendersData.senders);
          setSelectedSenderId(sendersData.senders[0].id);
        }

        if (listsData.success && listsData.lists.length > 0) {
          setLists(listsData.lists);
          setSelectedListId(listsData.lists[0].id);
        }

        if (contactsData.success) {
          setContacts(contactsData.contacts);
        }

        if (templatesData.success && templatesData.templates) {
          setTemplates(templatesData.templates);
          if (templateIdParam) {
            const matched = templatesData.templates.find((t: any) => t.id === templateIdParam);
            if (matched) {
              setSelectedTemplateId(matched.id);
              setSubject(matched.subject);
              setHtmlBody(matched.htmlBody);
              setCampaignName(`${matched.name} Outreach`);
              setCurrentStep(2);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [templateIdParam]);

  // Filter contacts by selected list
  const selectedListObj = lists.find((l) => l.id === selectedListId);
  const activeRecipients = selectedListId
    ? contacts.filter((c) => c.listMemberships?.some((m: any) => m.listId === selectedListId))
    : contacts;

  // Insert variable tag at cursor or append
  const insertVariable = (varName: string) => {
    setHtmlBody((prev) => `${prev} {{${varName}}}`);
  };

  // Run Preflight Check
  const runChecks = async () => {
    const selectedSender = senders.find((s) => s.id === selectedSenderId);

    // Call validation API or local validator
    const recipientsPayload = activeRecipients.map((c) => ({
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company,
      title: c.title,
      customFields: c.customFieldsJson ? JSON.parse(c.customFieldsJson) : {}
    }));

    // Local validation logic
    const { runPreflightValidation } = await import("@/lib/email/preflight");
    const result = runPreflightValidation({
      sender: selectedSender,
      subject,
      htmlBody,
      recipients: recipientsPayload
    });

    setPreflightChecks(result.checks);
    setCanSend(result.canSend);
    setIsPreflightModalOpen(true);
  };

  // Submit and Launch Campaign
  const handleConfirmLaunch = async () => {
    setIsSubmitting(true);
    try {
      // 1. Create sequence if enabled
      let createdSeqId = undefined;
      if (enableSequence && sequenceSteps.length > 0) {
        const seqRes = await fetch("/api/v1/sequences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${campaignName} Follow-up Drip`,
            steps: sequenceSteps.map((s, idx) => ({
              stepNo: idx + 1,
              delaySeconds: s.delayDays * 86400,
              subject: s.subject,
              htmlBody: s.htmlBody,
              conditions: { stopOnReply: true, stopOnBounce: true }
            }))
          })
        });
        const seqData = await seqRes.json();
        if (seqData.success) {
          createdSeqId = seqData.sequence.id;
        }
      }

      // 2. Create Campaign
      const campRes = await fetch("/api/v1/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          senderId: selectedSenderId,
          contactListId: selectedListId || undefined,
          contactIds: activeRecipients.map((c) => c.id),
          sequenceId: createdSeqId,
          subject,
          htmlBody,
          timezone,
          scheduledAt: sendMode === "schedule" ? scheduledAt : undefined
        })
      });

      const campData = await campRes.json();
      if (!campRes.ok || !campData.success) {
        throw new Error(campData.error || "Failed to create campaign");
      }

      const newCampId = campData.campaign.id;

      // 3. If Send Now, trigger queue delivery batch
      if (sendMode === "now") {
        await fetch(`/api/v1/campaigns/${newCampId}/send`, { method: "POST" });
      }

      // Redirect to campaign detail / live analytics
      router.push(`/dashboard/campaigns/${newCampId}`);
    } catch (err: any) {
      alert(`Error launching campaign: ${err.message}`);
    } finally {
      setIsSubmitting(false);
      setIsPreflightModalOpen(false);
    }
  };

  const stepsList = [
    { num: 1, label: "Audience & Sender", icon: Users },
    { num: 2, label: "Email Content", icon: FileText },
    { num: 3, label: "Follow-up Sequences", icon: GitMerge },
    { num: 4, label: "Review & Send", icon: Send }
  ];

  const currentRecipient = activeRecipients[previewIndex] || {
    email: "sarah.connor@techflow.io",
    firstName: "Sarah",
    lastName: "Connor",
    company: "TechFlow",
    title: "CEO",
    customFields: { city: "San Francisco" }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Top Studio Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none transition-colors px-1"
          />
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            DRAFT
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAIModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 hover:border-indigo-400 text-indigo-300 text-xs font-semibold shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Assistant</span>
          </button>

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep((prev) => Math.min(4, prev + 1))}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all"
            >
              <span>Next Step</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={runChecks}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all hover:scale-105"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Review & Launch</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Step Stepper Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stepsList.map((st) => {
          const Icon = st.icon;
          const isDone = currentStep > st.num;
          const isCurrent = currentStep === st.num;

          return (
            <button
              key={st.num}
              onClick={() => setCurrentStep(st.num)}
              className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                isCurrent
                  ? "bg-indigo-600/15 border-indigo-500 text-white shadow-sm"
                  : isDone
                  ? "bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700"
                  : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-300"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                  isCurrent
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : isDone
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : st.num}
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Step {st.num}
                </div>
                <div className="text-xs font-semibold text-slate-200">{st.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* STEP 1: AUDIENCE & SENDER */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sender Selection */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Select Sender Mailbox</h3>
              <p className="text-xs text-slate-400">Choose the connected mailbox to send through</p>
            </div>

            <div className="space-y-2.5">
              {senders.map((s) => (
                <label
                  key={s.id}
                  onClick={() => setSelectedSenderId(s.id)}
                  className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    selectedSenderId === s.id
                      ? "bg-indigo-600/15 border-indigo-500 shadow-sm"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="sender"
                      checked={selectedSenderId === s.id}
                      onChange={() => setSelectedSenderId(s.id)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-white">{s.displayName}</div>
                      <div className="text-[11px] text-slate-400">{s.email}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {s.providerAccounts[0]?.provider || "sandbox"}
                    </span>
                    <span className="text-[10px] block text-emerald-400 mt-1">
                      Ready to send
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Audience Selection & CSV Import */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Recipient Audience</h3>
                <p className="text-xs text-slate-400">Select target contact list or import CSV</p>
              </div>

              <button
                onClick={() => setIsCSVModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-medium transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Choose Contact List</label>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Active Contacts ({contacts.length})</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Audience Summary */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Recipients Selected:</span>
                <span className="font-bold text-white">{activeRecipients.length} contacts</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Available Variables:</span>
                <span className="text-indigo-400 font-mono text-[11px]">
                  &#123;&#123;firstName&#125;&#125;, &#123;&#123;company&#125;&#125;, &#123;&#123;title&#125;&#125;
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: EMAIL CONTENT & AI ASSISTANT */}
      {currentStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Editor (2 Cols) */}
          <div className="lg:col-span-2 space-y-4 p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Compose Personalized Template</h3>
                <p className="text-xs text-slate-400">
                  Use variables like <code className="text-indigo-300 font-mono">&#123;&#123;firstName&#125;&#125;</code> and fallbacks like <code className="text-indigo-300 font-mono">&#123;&#123;firstName | "there"&#125;&#125;</code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {templates.length > 0 && (
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedTemplateId(id);
                      const tmpl = templates.find((t: any) => t.id === id);
                      if (tmpl) {
                        setSubject(tmpl.subject);
                        setHtmlBody(tmpl.htmlBody);
                      }
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Load from Template Library...</option>
                    {templates.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => setIsAIModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Draft / Rewrite</span>
                </button>
              </div>
            </div>

            {/* Variable Tag Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Insert Tag:
              </span>
              {["firstName", "lastName", "company", "title", "city"].map((v) => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600/30 hover:border-indigo-500 border border-slate-700 text-[11px] font-mono text-indigo-300 transition-all"
                >
                  &#123;&#123;{v}&#125;&#125;
                </button>
              ))}
            </div>

            {/* Subject Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Quick question regarding {{company}}"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Body Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Email HTML Body</label>
              <textarea
                rows={12}
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                placeholder="Write your email content in HTML or plain text..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white font-mono leading-relaxed placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Real-time Preview Pane (1 Col) */}
          <div className="space-y-4">
            <RecipientPreview
              currentIndex={previewIndex}
              totalRecipients={activeRecipients.length}
              onIndexChange={setPreviewIndex}
              renderedSubject={subject.replace(/{{\s*company\s*}}/gi, currentRecipient.company || "TechFlow").replace(/{{\s*firstName.*?\s*}}/gi, currentRecipient.firstName || "Sarah")}
              renderedHtml={htmlBody.replace(/{{\s*company\s*}}/gi, currentRecipient.company || "TechFlow").replace(/{{\s*firstName.*?\s*}}/gi, currentRecipient.firstName || "Sarah")}
              recipientData={currentRecipient}
            />
          </div>
        </div>
      )}

      {/* STEP 3: AUTOMATED FOLLOW-UP SEQUENCES */}
      {currentStep === 3 && (
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-6 max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Automated Drip Follow-ups</h3>
              <p className="text-xs text-slate-400">
                Send automatic sequential follow-ups if the prospect does not reply.
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={enableSequence}
                onChange={(e) => setEnableSequence(e.target.checked)}
                className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-200">Enable Follow-ups</span>
            </label>
          </div>

          {enableSequence ? (
            <div className="space-y-4">
              {/* Stop Condition Notice */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  <strong>Smart Reply Stop Guard Active:</strong> The sequence will automatically halt for any recipient who sends a reply or unsubscribes.
                </span>
              </div>

              {/* Sequence Steps */}
              {sequenceSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 relative"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-400">
                      Step {idx + 1}: Wait {step.delayDays} day(s) after initial send
                    </span>
                    {sequenceSteps.length > 1 && (
                      <button
                        onClick={() => setSequenceSteps(sequenceSteps.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="text-[11px] text-slate-400 block mb-1">Delay (Days)</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={step.delayDays}
                        onChange={(e) => {
                          const updated = [...sequenceSteps];
                          updated[idx].delayDays = parseInt(e.target.value) || 1;
                          setSequenceSteps(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[11px] text-slate-400 block mb-1">Subject</label>
                      <input
                        type="text"
                        value={step.subject}
                        onChange={(e) => {
                          const updated = [...sequenceSteps];
                          updated[idx].subject = e.target.value;
                          setSequenceSteps(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Step HTML Content</label>
                    <textarea
                      rows={3}
                      value={step.htmlBody}
                      onChange={(e) => {
                        const updated = [...sequenceSteps];
                        updated[idx].htmlBody = e.target.value;
                        setSequenceSteps(updated);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={() =>
                  setSequenceSteps([
                    ...sequenceSteps,
                    {
                      stepNo: sequenceSteps.length + 1,
                      delayDays: 3,
                      subject: "Quick follow-up on {{company}}",
                      htmlBody: "<p>Hi {{firstName}}, checking back in on this!</p>"
                    }
                  ])
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Another Follow-up Step
              </button>
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800/80">
              <p className="text-xs text-slate-400">
                Follow-ups are currently disabled. This campaign will send a single one-off email to each recipient.
              </p>
              <button
                onClick={() => setEnableSequence(true)}
                className="mt-3 px-3.5 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold"
              >
                Enable Automated Drip
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: REVIEW, SCHEDULE & SEND */}
      {currentStep === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings & Timezone Schedule */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-white">Sending Schedule & Delivery Window</h3>
              <p className="text-xs text-slate-400">Choose immediate execution or future timezone delivery</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label
                onClick={() => setSendMode("now")}
                className={`p-4 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                  sendMode === "now"
                    ? "bg-indigo-600/15 border-indigo-500 shadow-sm"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-white">Send Now</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Queue all {activeRecipients.length} messages immediately through background workers.
                </p>
              </label>

              <label
                onClick={() => setSendMode("schedule")}
                className={`p-4 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                  sendMode === "schedule"
                    ? "bg-indigo-600/15 border-indigo-500 shadow-sm"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-white">Schedule Future</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Target prospect working hours in your selected timezone.
                </p>
              </label>
            </div>

            {sendMode === "schedule" && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Launch CTA */}
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={runChecks}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white text-xs font-bold shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.02]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Run Preflight Check & Confirm</span>
              </button>
            </div>
          </div>

          {/* Recipient Preview Snapshot */}
          <div>
            <RecipientPreview
              currentIndex={previewIndex}
              totalRecipients={activeRecipients.length}
              onIndexChange={setPreviewIndex}
              renderedSubject={subject.replace(/{{\s*company\s*}}/gi, currentRecipient.company || "TechFlow").replace(/{{\s*firstName.*?\s*}}/gi, currentRecipient.firstName || "Sarah")}
              renderedHtml={htmlBody.replace(/{{\s*company\s*}}/gi, currentRecipient.company || "TechFlow").replace(/{{\s*firstName.*?\s*}}/gi, currentRecipient.firstName || "Sarah")}
              recipientData={currentRecipient}
            />
          </div>
        </div>
      )}

      {/* MODALS */}
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        currentSubject={subject}
        currentBody={htmlBody}
        onApply={(c) => {
          if (c.subject) setSubject(c.subject);
          if (c.body) setHtmlBody(c.body);
        }}
      />

      <CSVImportModal
        isOpen={isCSVModalOpen}
        onClose={() => setIsCSVModalOpen(false)}
        onImportComplete={async () => {
          const res = await fetch("/api/v1/contacts");
          const data = await res.json();
          if (data.success) setContacts(data.contacts);
        }}
        existingLists={lists}
      />

      <PreflightModal
        isOpen={isPreflightModalOpen}
        onClose={() => setIsPreflightModalOpen(false)}
        onConfirmSend={handleConfirmLaunch}
        checks={preflightChecks}
        canSend={canSend}
        isSending={isSubmitting}
        totalRecipients={activeRecipients.length}
        mode={sendMode}
        scheduledDate={scheduledAt}
        senderEmail={senders.find((s) => s.id === selectedSenderId)?.email}
      />
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span>Loading Campaign Wizard...</span>
        </div>
      }
    >
      <NewCampaignWizard />
    </Suspense>
  );
}
