import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "indigo" | "emerald" | "cyan" | "amber" | "rose";
  trend?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, color = "indigo", trend }: StatCardProps) {
  const colorMap = {
    indigo: {
      border: "border-indigo-500/20",
      bgIcon: "bg-indigo-500/10 text-indigo-400",
      glow: "hover:border-indigo-500/40"
    },
    emerald: {
      border: "border-emerald-500/20",
      bgIcon: "bg-emerald-500/10 text-emerald-400",
      glow: "hover:border-emerald-500/40"
    },
    cyan: {
      border: "border-cyan-500/20",
      bgIcon: "bg-cyan-500/10 text-cyan-400",
      glow: "hover:border-cyan-500/40"
    },
    amber: {
      border: "border-amber-500/20",
      bgIcon: "bg-amber-500/10 text-amber-400",
      glow: "hover:border-amber-500/40"
    },
    rose: {
      border: "border-rose-500/20",
      bgIcon: "bg-rose-500/10 text-rose-400",
      glow: "hover:border-rose-500/40"
    }
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <div className={`p-5 rounded-2xl bg-slate-900/60 border ${scheme.border} ${scheme.glow} backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2.5 rounded-xl ${scheme.bgIcon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
        {trend && (
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {trend}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}
