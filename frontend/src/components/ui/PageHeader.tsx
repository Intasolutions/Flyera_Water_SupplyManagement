import React from "react";

export type PageHeaderBadgeColor = "emerald" | "blue" | "amber" | "purple" | "cyan" | "rose" | "slate";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeText?: string;
  badgeColor?: PageHeaderBadgeColor;
  actions?: React.ReactNode;
  actionSlot?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  badgeText,
  badgeColor = "emerald",
  actions,
  actionSlot
}: PageHeaderProps) {
  const displayBadge = badge || badgeText;
  const displayActions = actions || actionSlot;

  const badgeClasses: Record<PageHeaderBadgeColor, string> = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-800",
    rose: "bg-rose-50 border-rose-200 text-rose-800",
    slate: "bg-slate-100 border-slate-200 text-slate-800"
  };

  const dotClasses: Record<PageHeaderBadgeColor, string> = {
    emerald: "bg-emerald-600",
    blue: "bg-blue-600",
    amber: "bg-amber-600",
    purple: "bg-purple-600",
    cyan: "bg-cyan-600",
    rose: "bg-rose-600",
    slate: "bg-slate-600"
  };

  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">{title}</h1>
          {displayBadge && (
            <span className={`flex items-center gap-1.5 px-3 py-1 border text-xs sm:text-sm font-bold rounded-full shadow-2xs ${badgeClasses[badgeColor]}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${dotClasses[badgeColor]}`} />
              {displayBadge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-slate-600 mt-2 text-sm sm:text-base font-semibold leading-relaxed max-w-2xl">{subtitle}</p>
        )}
      </div>

      {displayActions && (
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {displayActions}
        </div>
      )}
    </header>
  );
}
