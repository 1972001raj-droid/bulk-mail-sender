"use client";

import React, { useState } from "react";
import {
  MailCheck,
  Plus,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  X,
  Loader2,
  Trash2,
  Server,
  Key,
  Mail,
  User,
  Info,
  Lock,
  Zap,
  Sparkles
} from "lucide-react";

interface SendersClientViewProps {
  initialSenders: any[];
}

export function SendersClientView({ initialSenders }: SendersClientViewProps) {
  const [senders, setSenders] = useState(initialSenders);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { status: "success" | "error"; message: string }>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New sender form state
  const [selectedProvider, setSelectedProvider] = useState<"resend" | "gmail" | "microsoft" | "smtp" | "sandbox">("resend");
  const [email, setEmail] = useState("onboarding@resend.dev");
  const [displayName, setDisplayName] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleProviderSelect = (provider: "resend" | "gmail" | "microsoft" | "smtp" | "sandbox") => {
    setSelectedProvider(provider);
    setConnectError(null);
    if (provider === "resend") {
      if (!email || email.includes("gmail") || email.includes("office365")) {
        setEmail("onboarding@resend.dev");
      }
    } else if (provider === "gmail") {
      setSmtpHost("smtp.gmail.com");
      setSmtpPort("587");
      setSmtpSecure(false);
      if (email === "onboarding@resend.dev") setEmail("");
    } else if (provider === "microsoft") {
      setSmtpHost("smtp.office365.com");
      setSmtpPort("587");
      setSmtpSecure(false);
      if (email === "onboarding@resend.dev") setEmail("");
    } else if (provider === "smtp") {
      setSmtpHost("");
      setSmtpPort("587");
      setSmtpSecure(false);
      if (email === "onboarding@resend.dev") setEmail("");
    }
  };

  const reloadSenders = async () => {
    try {
      const res = await fetch("/api/v1/senders");
      const data = await res.json();
      if (data.success) setSenders(data.senders);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestConnection = async (senderId: string) => {
    setTestingId(senderId);
    try {
      const res = await fetch(`/api/v1/senders/${senderId}/connect`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setTestResult((prev) => ({
          ...prev,
          [senderId]: { status: "success", message: "Connected & Verified with Provider" }
        }));
      } else {
        setTestResult((prev) => ({
          ...prev,
          [senderId]: { status: "error", message: data.error || "Connection failed" }
        }));
      }
      await reloadSenders();
    } catch (e: any) {
      setTestResult((prev) => ({
        ...prev,
        [senderId]: { status: "error", message: e.message || "Network error" }
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteSender = async (senderId: string, senderEmail: string) => {
    if (!confirm(`Are you sure you want to disconnect and delete ${senderEmail}?`)) return;

    setDeletingId(senderId);
    try {
      const res = await fetch(`/api/v1/senders/${senderId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setSenders((prev) => prev.filter((s) => s.id !== senderId));
      } else {
        alert(data.error || "Failed to delete sender");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleConnectNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    if (!email) {
      setConnectError("Email address is required");
      return;
    }

    setConnecting(true);
    try {
      let payload: any = {
        email,
        displayName: displayName || email.split("@")[0],
        provider: selectedProvider
      };

      if (selectedProvider === "resend") {
        payload.apiKey = resendApiKey;
      } else if (selectedProvider !== "sandbox") {
        payload.host = smtpHost;
        payload.port = Number(smtpPort) || 587;
        payload.secure = smtpSecure;
        payload.user = smtpUser || email;
        payload.pass = smtpPass;
      }

      const res = await fetch("/api/v1/senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setIsConnectModalOpen(false);
        setEmail("onboarding@resend.dev");
        setDisplayName("");
        setResendApiKey("");
        setSmtpUser("");
        setSmtpPass("");
        setConnectError(null);
        await reloadSenders();
      } else {
        setConnectError(data.error || "Failed to connect sender");
      }
    } catch (err: any) {
      setConnectError(err.message || "An unexpected error occurred");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Connected Senders & Mailboxes</h1>
          <p className="text-xs text-slate-400 mt-1">
            Send authentic bulk emails using <strong className="text-indigo-300">Resend (easiest)</strong>, Gmail (App Password), Outlook, or Custom SMTP.
          </p>
        </div>

        <button
          onClick={() => {
            setConnectError(null);
            setIsConnectModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>Connect New Sender</span>
        </button>
      </div>

      {/* Senders Cards */}
      {senders.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <MailCheck className="w-7 h-7" />
          </div>
          <div className="max-w-md">
            <h3 className="text-base font-semibold text-white">No sender mailboxes connected yet</h3>
            <p className="text-xs text-slate-400 mt-1">
              Connect in seconds with your <span className="text-indigo-300 font-semibold">Resend API key</span>, or use your Gmail App Password or Outlook account.
            </p>
          </div>
          <button
            onClick={() => {
              setConnectError(null);
              setIsConnectModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
          >
            <Zap className="w-4 h-4" />
            <span>Connect with Resend</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {senders.map((s) => {
            const providerAcc = s.providerAccounts?.[0] || {};
            const provider = providerAcc.provider || "resend";
            const host = providerAcc.host;
            const isTesting = testingId === s.id;
            const isDeleting = deletingId === s.id;
            const result = testResult[s.id];
            const isConnected = s.status === "CONNECTED";

            return (
              <div
                key={s.id}
                className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-indigo-500/40 transition-all shadow-sm group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
                        <MailCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{s.displayName}</h4>
                        <p className="text-xs text-slate-400">{s.email}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                        provider === "resend"
                          ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {provider === "resend" ? "Resend API" : provider}
                    </span>
                  </div>

                  {/* Mailbox Details */}
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-indigo-400" />
                        Relay
                      </span>
                      <span className="text-slate-200 font-mono text-[11px]">
                        {provider === "resend"
                          ? "api.resend.com (HTTPS)"
                          : host
                          ? `${host}:${providerAcc.port || 587}`
                          : provider === "sandbox"
                          ? "Demo Sandbox"
                          : "Standard SMTP"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800/50">
                      <span>Total Sent Emails</span>
                      <span className="text-emerald-400 font-semibold">{s.sentToday || 0} sent</span>
                    </div>
                  </div>

                  {/* Test Result Message */}
                  {result && (
                    <div
                      className={`mt-3 p-2.5 rounded-xl text-[11px] flex items-start gap-2 ${
                        result.status === "success"
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                          : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                      }`}
                    >
                      {result.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span className="leading-tight">{result.message}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div
                      className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`}
                    />
                    <span className={isConnected ? "text-emerald-400" : "text-rose-400"}>
                      {isConnected ? "Connected & Ready" : "Needs Reauth"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={isTesting}
                      onClick={() => handleTestConnection(s.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5"
                      title="Verify connection"
                    >
                      <RefreshCw className={`w-3 h-3 ${isTesting ? "animate-spin text-indigo-400" : ""}`} />
                      <span>{isTesting ? "Testing..." : "Test"}</span>
                    </button>

                    <button
                      disabled={isDeleting}
                      onClick={() => handleDeleteSender(s.id, s.email)}
                      className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Delete sender"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONNECT SENDER MODAL */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                  <span>Connect Sender Mailbox</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select your email provider to start sending campaigns
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Provider Selection Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: "resend", name: "Resend", badge: "Easiest", desc: "API key (10s setup)" },
                { id: "gmail", name: "Gmail", desc: "App Password" },
                { id: "microsoft", name: "Outlook / 365", desc: "Office 365 SMTP" },
                { id: "smtp", name: "Custom SMTP", desc: "Any mail server" },
                { id: "sandbox", name: "Sandbox Demo", desc: "Simulated sending" }
              ].map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleProviderSelect(p.id as any)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all relative ${
                    selectedProvider === p.id
                      ? "bg-indigo-600/20 border-indigo-500 text-white shadow-sm"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {p.badge && (
                    <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-cyan-400 text-white">
                      {p.badge}
                    </span>
                  )}
                  <div className="font-semibold text-xs text-white">{p.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
                </div>
              ))}
            </div>

            {/* Provider Instructions Alert */}
            {selectedProvider === "resend" && (
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-300 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Why Resend is the Easiest Option:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  No SMTP ports, hostnames, or app password hurdles. Just grab an API key from{" "}
                  <a
                    href="https://resend.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-white underline hover:text-indigo-200 inline-flex items-center gap-0.5 font-medium"
                  >
                    resend.com/api-keys <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  .
                </p>
                <p className="text-[10px] text-slate-400">
                  Tip: For testing before verifying your domain on Resend, you can use <code className="text-indigo-200 bg-slate-900 px-1 py-0.5 rounded">onboarding@resend.dev</code> as the sender email!
                </p>
              </div>
            )}

            {selectedProvider === "gmail" && (
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-white">Gmail App Password Required:</span>
                  <span>
                    Enable 2-Step Verification on your Google Account, then generate a 16-character password at{" "}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 underline hover:text-indigo-300 inline-flex items-center gap-0.5"
                    >
                      myaccount.google.com/apppasswords <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </span>
                </div>
              </div>
            )}

            {/* Connection Error Notification */}
            {connectError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="leading-tight">{connectError}</span>
              </div>
            )}

            <form onSubmit={handleConnectNew} className="space-y-4 text-xs">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Sender Email Address <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder={selectedProvider === "resend" ? "onboarding@resend.dev or your domain" : "outreach@company.com"}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (!smtpUser) setSmtpUser(e.target.value);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Sender Display Name</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Alex Vance"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* RESEND FIELDS */}
              {selectedProvider === "resend" && (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-300 font-medium">
                      Resend API Key <span className="text-rose-400">*</span>
                    </label>
                    <a
                      href="https://resend.com/api-keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      Get API key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <div className="relative">
                    <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="re_123456789abcdef..."
                      value={resendApiKey}
                      onChange={(e) => setResendApiKey(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* SMTP Fields for Real Providers */}
              {selectedProvider !== "sandbox" && selectedProvider !== "resend" && (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Server className="w-3.5 h-3.5 text-indigo-400" />
                    SMTP Configuration
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-400 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        required
                        placeholder="smtp.gmail.com"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Port</label>
                      <input
                        type="text"
                        required
                        placeholder="587"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">SMTP Username</label>
                      <input
                        type="text"
                        placeholder="outreach@company.com"
                        value={smtpUser || email}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">
                        {selectedProvider === "gmail" ? "16-char App Password *" : "Mailbox Password *"}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder={selectedProvider === "gmail" ? "xxxx xxxx xxxx xxxx" : "••••••••••••"}
                          value={smtpPass}
                          onChange={(e) => setSmtpPass(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          <Lock className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying with {selectedProvider === "resend" ? "Resend" : "Mail Server"}...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Connect {selectedProvider === "resend" ? "Resend" : "Mailbox"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
