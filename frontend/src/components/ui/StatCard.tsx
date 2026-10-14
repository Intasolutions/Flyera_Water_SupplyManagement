import React from "react";

export type StatBadgeColor = "emerald" | "blue" | "amber" | "cyan" | "purple" | "rose" | "slate";

export interface StatCardProps {
  title?: string;
  label?: string;
  value: string | number;
  trend?: string;
  subtext?: string;
  icon: React.ReactNode;
  badge?: string;
  category?: string;
  color?: StatBadgeColor;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  title,
  label,
  value,
  trend,
  subtext,
  icon,
  badge,
  category,
  color = "blue",
  onClick,
  className = ""
}: StatCardProps) {
  const displayTitle = title || label || "";
  const displayTrend = trend || subtext;
  const displayBadge = badge || category;

  const colorMap: Record<StatBadgeColor, string> = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
    rose: "bg-rose-50 border-rose-200 text-rose-800",
    slate: "bg-slate-100 border-slate-200 text-slate-800"
  };

  return (
    <div
      onClick={onClick}
      className={`glass-panel p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl hover:shadow-md transition-all border border-black/5 group relative overflow-hidden flex flex-col justify-between ${onClick ? "cursor-pointer active:scale-[0.98]" : ""
        } ${className}`}
    >
      <div>
        <div className="flex justify-between items-start gap-1.5 mb-2 sm:mb-3">
          <div className="p-2 sm:p-2.5 md:p-3 bg-surface rounded-xl sm:rounded-2xl border border-black/5 shadow-xs group-hover:scale-105 transition-transform shrink-0 [&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-5 sm:[&>svg]:h-5 md:[&>svg]:w-6 md:[&>svg]:h-6">
            {icon}
          </div>
          {displayBadge && (
            <span className={`text-[9px] sm:text-[11px] font-bold uppercase tracking-wider px-1.5 sm:px-2.5 py-0.5 rounded-md border truncate max-w-[95px] sm:max-w-none ${colorMap[color]}`}>
              {displayBadge}
            </span>
          )}
        </div>
        <h3 className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-0.5 sm:mb-1 truncate" title={displayTitle}>
          {displayTitle}
        </h3>
        <p className="text-lg sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
          {value}
        </p>
      </div>
      {displayTrend && (
        <p className="text-[10px] sm:text-xs text-slate-500 mt-1 sm:mt-1.5 font-medium truncate sm:line-clamp-none">
          {displayTrend}
        </p>
      )}
    </div>
  );
}
