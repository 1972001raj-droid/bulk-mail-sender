import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { GitMerge, Clock, CheckCircle2, Plus, ArrowRight, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  const session = await getSessionContext();
  const sequences = await prisma.sequence.findMany({
    where: { organizationId: session.organizationId },
    include: {
      steps: { orderBy: { stepNo: "asc" } },
      _count: { select: { enrollments: true, campaigns: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Follow-up Sequences</h1>
          <p className="text-xs text-slate-400 mt-1">
            Automate multi-step drip emails with intelligent reply-detection that automatically cancels follow-ups.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {sequences.map((seq) => (
          <div
            key={seq.id}
            className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4 hover:border-indigo-500/40 transition-all shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{seq.name}</h3>
                  <div className="text-xs text-slate-400">
                    {seq.steps.length} sequential steps · {seq._count.campaigns} campaigns using this sequence
                  </div>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Auto-Stop on Reply Active
              </span>
            </div>

            {/* Sequence Timeline Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {seq.steps.map((st) => (
                <div
                  key={st.id}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-400">Step {st.stepNo}</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      +{Math.round(st.delaySeconds / 86400)} days delay
                    </span>
                  </div>
                  <div className="font-medium text-white truncate">{st.subject || "Follow-up note"}</div>
                  <div className="text-slate-400 text-[11px] truncate">
                    {st.htmlBody?.replace(/<[^>]*>/g, "") || "Content preview"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
