import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { Building2, ShieldCheck, UserCheck, Clock, Plus, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getSessionContext();
  const orgId = session.organizationId;

  const [org, members, auditLogs] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: { actorUser: true },
      orderBy: { createdAt: "desc" },
      take: 25
    })
  ]);

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Team & Governance</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage organization members, RBAC permissions (Owner, Admin, Member, Viewer), and inspect security audit trails.
          </p>
        </div>
      </div>

      {/* Organization Members Card */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Active Members ({members.length})</h3>
            <p className="text-xs text-slate-400">Organization: {org?.name}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-5 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/30">
                  <td className="py-3.5 px-5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white text-xs">
                      {m.user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{m.user.name}</div>
                      <div className="text-[11px] text-slate-400">{m.user.email}</div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold">
                      {m.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" /> Active
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Audit Trail */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Security & Operation Audit Logs</h3>
            <p className="text-xs text-slate-400">Immutable trace of campaign launches, mailbox connections, and state changes</p>
          </div>
        </div>

        <div className="divide-y divide-slate-800/60 text-xs">
          {auditLogs.length === 0 ? (
            <p className="text-slate-400 py-6 text-center">No audit logs recorded yet.</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  <div>
                    <span className="font-semibold text-white">{log.action}</span>
                    <span className="text-slate-400 ml-2">
                      by {log.actorUser?.name || "System Worker"}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
