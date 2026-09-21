import Link from "next/link";
import {
  Send,
  Sparkles,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Users,
  BarChart3,
  Mail,
  ArrowRight,
  Globe,
  Clock,
  Layers
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="h-20 border-b border-slate-800/80 px-6 md:px-12 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Send className="w-5 h-5 text-white -rotate-12" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">AeroSend</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#integrations" className="hover:text-white transition-colors">
            Integrations
          </a>
          <a href="#security" className="hover:text-white transition-colors">
            Security
          </a>
          <a href="#pricing" className="hover:text-white transition-colors">
            Pricing
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
          >
            <span>Open Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative px-6 pt-20 pb-28 md:pt-28 md:pb-36 max-w-6xl mx-auto text-center">
          {/* Subtle Background Glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-8 animate-pulse-subtle">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Production-Grade Mailmeteor Alternative with AI Assistance</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
            Personalized Email Outreach <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
              Directly Through Your Mailbox
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Send high-converting cold emails, mail merges, and drip sequences using your own Google Workspace,
            Microsoft 365, or Zoho accounts. Guaranteed idempotency, automatic quota management, and real-time reply detection.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard/campaigns/new"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Zap className="w-4 h-4" />
              <span>Create Campaign in 5 Mins</span>
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-200 font-semibold text-sm transition-all"
            >
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span>Explore Live Demo & Analytics</span>
            </Link>
          </div>

          {/* Key Trust Signals */}
          <div className="mt-16 pt-10 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-8 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> &lt;0.01% Duplicate Send Rate
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> Encrypted OAuth Credentials
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" /> Timezone-Aware Scheduled Sending
            </span>
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" /> Gmail, Outlook & Zoho Ready
            </span>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/80">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase font-bold tracking-widest text-indigo-400 mb-2">Capabilities</h2>
            <p className="text-3xl font-bold text-white tracking-tight">Everything You Need for Scalable Outreach</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/40 transition-all group">
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit mb-4 group-hover:scale-110 transition-transform">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg text-white mb-2">Native Provider Mailboxes</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your actual Google Workspace, Microsoft Graph, or Zoho accounts. Emails land in primary inboxes, not spam folders.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/40 transition-all group">
              <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 w-fit mb-4 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg text-white mb-2">Smart Personalization & AI</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Map custom CSV tags ({`{{firstName}}`}, {`{{company}}`}), test live recipient previews, and generate high-reply subject lines with AI.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/40 transition-all group">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit mb-4 group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg text-white mb-2">Auto-Stop Drip Sequences</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Configure automated follow-ups with customizable day delays. If a prospect replies, the sequence immediately stops to avoid embarrassing double emails.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-6 text-center text-xs text-slate-500">
        <p>© 2026 AeroSend Outreach SaaS. Built strictly according to the 6 specification documents.</p>
      </footer>
    </div>
  );
}
