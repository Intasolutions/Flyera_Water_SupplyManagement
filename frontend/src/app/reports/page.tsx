"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  PageHeader 
} from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { 
  getFinancialSummaryReport, 
  FinancialSummaryReport, 
  getVehicles, 
  Vehicle 
} from "@/lib/api";
import { 
  IndianRupee, 
  Fuel, 
  TrendingUp, 
  TrendingDown, 
  Truck, 
  Calendar, 
  Search, 
  Printer, 
  RefreshCw, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Package, 
  CheckCircle2, 
  AlertTriangle,
  Coins,
  Receipt,
  FileSpreadsheet,
  Wallet
} from "lucide-react";
import toast from "react-hot-toast";

type DateRangePreset = "today" | "yesterday" | "week" | "month" | "all" | "custom";

export default function ReportsPage() {
  const [reportData, setReportData] = useState<FinancialSummaryReport | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [datePreset, setDatePreset] = useState<DateRangePreset>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"profit" | "revenue" | "expenses" | "margin" | "trips">("profit");

  // Format dates for presets
  const getDateRange = (preset: DateRangePreset): { start?: string; end?: string } => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "today") {
      const s = formatDate(today);
      return { start: s, end: s };
    }
    if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const s = formatDate(y);
      return { start: s, end: s };
    }
    if (preset === "week") {
      const w = new Date(today);
      w.setDate(w.getDate() - 7);
      return { start: formatDate(w), end: formatDate(today) };
    }
    if (preset === "month") {
      const m = new Date(today);
      m.setDate(m.getDate() - 30);
      return { start: formatDate(m), end: formatDate(today) };
    }
    if (preset === "custom") {
      return {
        start: customStartDate || undefined,
        end: customEndDate || undefined,
      };
    }
    return {}; // "all"
  };

  const fetchReport = async () => {
    try {
      setIsRefreshing(true);
      const { start, end } = getDateRange(datePreset);
      const vId = selectedVehicleId !== "ALL" ? selectedVehicleId : undefined;

      const data = await getFinancialSummaryReport({
        start_date: start,
        end_date: end,
        vehicle_id: vId,
      });
      setReportData(data);
    } catch (err: any) {
      console.error("Failed to load report data:", err);
      toast.error(err.message || "Failed to load financial report data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial fetch of vehicles catalog
    getVehicles()
      .then(setVehicles)
      .catch(e => console.warn("Failed to load vehicles catalog:", e));
  }, []);

  useEffect(() => {
    fetchReport();
  }, [datePreset, selectedVehicleId]);

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    setDatePreset("custom");
    fetchReport();
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtered and sorted vehicle reports
  const filteredVehicles = useMemo(() => {
    if (!reportData?.vehicle_reports) return [];
    let list = [...reportData.vehicle_reports];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(v => 
        v.plate_number.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.assigned_driver.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === "profit") return b.net_profit - a.net_profit;
      if (sortBy === "revenue") return b.gross_revenue - a.gross_revenue;
      if (sortBy === "expenses") return b.total_expenses - a.total_expenses;
      if (sortBy === "margin") return b.profit_margin_pct - a.profit_margin_pct;
      if (sortBy === "trips") return b.trips_count - a.trips_count;
      return 0;
    });

    return list;
  }, [reportData, searchQuery, sortBy]);

  const summary = reportData?.summary || {
    total_revenue: 0,
    total_expenses: 0,
    net_profit: 0,
    profit_margin_pct: 0,
    total_cash_collected: 0,
    total_upi_collected: 0,
    total_credit_sales: 0,
    total_deliveries_count: 0,
    total_bottles_delivered: 0,
    total_trips: 0,
    inhand_cash_spent: 0,
    personal_expenses: 0,
    morning_petty_cash_total: 0,
    petty_cash_to_return: 0
  };

  const categories = reportData?.expense_categories || [];

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* Header with Print and Refresh */}
      <PageHeader
        title="Financial Reports & Fleet Profitability"
        subtitle="Audited delivery revenues, on-road trip expenses, operating profit, and vehicle-by-vehicle ledger."
        badge="Live Analytics"
        badgeColor="emerald"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={fetchReport}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all"
              title="Refresh financial data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-600" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-black text-xs flex items-center gap-2 shadow-xs transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
          </div>
        }
      />

      {/* Date Range & Fleet Filters Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Period:
            </span>
            {[
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "week", label: "Last 7 Days" },
              { id: "month", label: "Last 30 Days" },
              { id: "custom", label: "Custom" }
            ].map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDatePreset(preset.id as DateRangePreset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                  datePreset === preset.id
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Vehicle Filter Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-slate-500" />
              Vehicle:
            </span>
            <select
              value={selectedVehicleId}
              onChange={e => setSelectedVehicleId(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-emerald-500 shadow-2xs"
            >
              <option value="ALL">All Fleet Vehicles ({vehicles.length})</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} {v.model ? `(${v.model})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Form (visible only when custom is chosen) */}
        {datePreset === "custom" && (
          <form onSubmit={handleApplyCustomDates} className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">From:</span>
              <input
                type="date"
                required
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">To:</span>
              <input
                type="date"
                required
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>
            <Button type="submit" variant="primary" className="py-1.5 px-3 text-xs bg-emerald-600 hover:bg-emerald-700">
              Apply Dates
            </Button>
          </form>
        )}
      </div>

      {/* Printable Statement Header (only visible on print) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
        <h1 className="text-2xl font-black text-slate-950 uppercase tracking-wide">
          Flyera Water Logistics — Financial Statement
        </h1>
        <p className="text-xs text-slate-600">
          Generated: {new Date().toLocaleString("en-IN")} &bull; Period: {datePreset.toUpperCase()}
        </p>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Deliveries Revenue */}
        <div className="glass-panel p-5 rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/60 to-white shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-emerald-600" />
              Deliveries Revenue
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Gross Inflow
            </span>
          </div>

          <div>
            <div className="text-3xl font-black text-emerald-950 tracking-tight">
              ₹{summary.total_revenue.toLocaleString()}
            </div>
            <span className="text-xs font-semibold text-emerald-700 block mt-0.5">
              {summary.total_deliveries_count} delivered stops &bull; {summary.total_bottles_delivered} jars/bottles
            </span>
          </div>

          <div className="pt-2 border-t border-emerald-200/60 grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-white/80 p-1.5 rounded-lg border border-emerald-200/60">
              <span className="text-slate-500 text-[10px] block font-bold">Physical Cash:</span>
              <strong className="text-emerald-900 font-black">₹{summary.total_cash_collected.toLocaleString()}</strong>
            </div>
            <div className="bg-white/80 p-1.5 rounded-lg border border-emerald-200/60">
              <span className="text-slate-500 text-[10px] block font-bold">Direct UPI QR:</span>
              <strong className="text-sky-900 font-black">₹{summary.total_upi_collected.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Total Trip Expenses */}
        <div className="glass-panel p-5 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/60 to-white shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Fuel className="w-4 h-4 text-amber-600" />
              Total Trip Expenses
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
              On-Road Cost
            </span>
          </div>

          <div>
            <div className="text-3xl font-black text-amber-950 tracking-tight">
              ₹{summary.total_expenses.toLocaleString()}
            </div>
            <span className="text-xs font-semibold text-amber-700 block mt-0.5">
              Fuel, Tolls, Repairs, Parking &amp; Crew
            </span>
          </div>

          <div className="pt-2 border-t border-amber-200/60 grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-white/80 p-1.5 rounded-lg border border-amber-200/60">
              <span className="text-slate-500 text-[10px] block font-bold">From In-Hand Cash:</span>
              <strong className="text-amber-900 font-black">₹{summary.inhand_cash_spent.toLocaleString()}</strong>
            </div>
            <div className="bg-white/80 p-1.5 rounded-lg border border-amber-200/60">
              <span className="text-slate-500 text-[10px] block font-bold">Driver Reimbursable:</span>
              <strong className="text-rose-900 font-black">₹{summary.personal_expenses.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Card 3: Net Operating Profit */}
        <div className="glass-panel p-5 rounded-2xl border border-teal-200/90 bg-gradient-to-br from-teal-50/60 to-white shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-black uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-teal-600" />
              Net Operating Profit
            </span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
              summary.net_profit >= 0
                ? "bg-teal-100 text-teal-800 border-teal-300"
                : "bg-rose-100 text-rose-800 border-rose-300"
            }`}>
              {summary.profit_margin_pct}% Margin
            </span>
          </div>

          <div>
            <div className={`text-3xl font-black tracking-tight ${
              summary.net_profit >= 0 ? "text-teal-950" : "text-rose-700"
            }`}>
              ₹{summary.net_profit.toLocaleString()}
            </div>
            <span className="text-xs font-semibold text-teal-700 block mt-0.5">
              {summary.net_profit >= 0 ? "Positive Net Yield" : "Operating Loss Detected"}
            </span>
          </div>

          <div className="pt-2 border-t border-teal-200/60 flex justify-between items-center text-[11px] text-slate-700">
            <span>Operating Formula:</span>
            <span className="font-bold text-teal-900">Revenue − Total Expenses</span>
          </div>
        </div>

        {/* Card 4: Petty Cash Audit */}
        <div className="glass-panel p-5 rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/60 to-white shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-indigo-600" />
              In-Hand Cash Audit
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
              Shift Petty Cash
            </span>
          </div>

          <div>
            <div className="text-3xl font-black text-indigo-950 tracking-tight">
              ₹{summary.petty_cash_to_return.toLocaleString()}
            </div>
            <span className="text-xs font-semibold text-indigo-700 block mt-0.5">
              Unspent In-Hand Cash to be returned
            </span>
          </div>

          <div className="pt-2 border-t border-indigo-200/60 grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-white/80 p-1.5 rounded-lg border border-indigo-200/60">
              <span className="text-slate-500 text-[10px] block font-bold">Given in Morning:</span>
              <strong className="text-indigo-900 font-black">₹{summary.morning_petty_cash_total.toLocaleString()}</strong>
            </div>
            <div className="bg-white/80 p-1.5 rounded-lg border border-indigo-200/60">
              <span className="text-slate-500 text-[10px] block font-bold">Spent on Road:</span>
              <strong className="text-amber-900 font-black">₹{summary.inhand_cash_spent.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Category Breakdown Bars */}
      {categories.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-600" />
              Expense Distribution By Category
            </span>
            <span className="text-xs font-bold text-slate-500">
              Total Logged: ₹{summary.total_expenses.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {categories.map(cat => {
              const icons: Record<string, string> = {
                FUEL: "⛽",
                TOLL: "🛣️",
                PARKING: "🅿️",
                MAINTENANCE: "🔧",
                OTHER: "🍱"
              };
              return (
                <div key={cat.category} className="bg-slate-50/90 border border-slate-200/80 p-3 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-black text-slate-800 flex items-center gap-1.5">
                      <span>{icons[cat.category] || "📦"}</span>
                      {cat.category}
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                      {cat.count} logs
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline">
                    <span className="text-base font-black text-slate-900">
                      ₹{cat.amount.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-amber-700">
                      {cat.percentage}%
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CORE FEATURE: VEHICLE BY VEHICLE EXPENSE & PROFIT REPORT */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-600" />
              Vehicle-By-Vehicle Report: Delivery Revenue, Expenses &amp; Profit
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Audit individual fleet vehicle unit deliveries, fuel &amp; maintenance costs, and net margin return.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search vehicle or driver..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 shadow-2xs"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-emerald-500 shadow-2xs"
            >
              <option value="profit">Sort: Highest Profit</option>
              <option value="revenue">Sort: Highest Revenue</option>
              <option value="expenses">Sort: Highest Expenses</option>
              <option value="margin">Sort: Profit Margin %</option>
              <option value="trips">Sort: Most Trips</option>
            </select>
          </div>
        </div>

        {/* Vehicle Performance Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                <th className="py-3 px-3.5">Vehicle &amp; Crew</th>
                <th className="py-3 px-3.5 text-center">Trips / Units</th>
                <th className="py-3 px-3.5 text-right">Delivery Revenue</th>
                <th className="py-3 px-3.5 text-right">Trip Expenses</th>
                <th className="py-3 px-3.5 text-right">Net Profit</th>
                <th className="py-3 px-3.5 text-center">Margin %</th>
                <th className="py-3 px-3.5 text-right">In-Hand Cash Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    No vehicles found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map(veh => {
                  const isProfitable = veh.net_profit >= 0;
                  return (
                    <tr key={veh.vehicle_id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Vehicle & Crew */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100/70 border border-emerald-300 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0">
                            🚚
                          </div>
                          <div>
                            <span className="font-black text-slate-900 text-sm block">
                              {veh.plate_number}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium block">
                              {veh.model} &bull; Driver: <strong className="text-slate-700">{veh.assigned_driver}</strong>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Trips / Units Dropped */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <span className="font-black text-slate-900 block text-xs">
                          {veh.trips_count} Routes
                        </span>
                        <span className="text-[11px] text-emerald-700 font-bold block">
                          {veh.bottles_delivered} jars dropped
                        </span>
                      </td>

                      {/* Gross Delivery Revenue */}
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <span className="font-black text-emerald-700 text-sm block">
                          ₹{veh.gross_revenue.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          Cash ₹{veh.cash_collected} &bull; UPI ₹{veh.upi_collected}
                        </span>
                      </td>

                      {/* Trip Expenses */}
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <span className="font-black text-amber-700 text-sm block">
                          − ₹{veh.total_expenses.toLocaleString()}
                        </span>
                        <div className="text-[10px] text-slate-500 space-x-1">
                          {veh.expenses_breakdown.FUEL > 0 && (
                            <span>⛽₹{veh.expenses_breakdown.FUEL}</span>
                          )}
                          {veh.expenses_breakdown.TOLL > 0 && (
                            <span>🛣️₹{veh.expenses_breakdown.TOLL}</span>
                          )}
                          {veh.expenses_breakdown.MAINTENANCE > 0 && (
                            <span>🔧₹{veh.expenses_breakdown.MAINTENANCE}</span>
                          )}
                        </div>
                      </td>

                      {/* Net Vehicle Profit */}
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <span className={`font-black text-base block ${
                          isProfitable ? "text-teal-700" : "text-rose-600"
                        }`}>
                          {isProfitable ? "+" : ""}₹{veh.net_profit.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          {isProfitable ? "Operating Yield" : "Operating Deficit"}
                        </span>
                      </td>

                      {/* Margin % */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full border ${
                          veh.profit_margin_pct >= 50
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : veh.profit_margin_pct >= 20
                            ? "bg-teal-100 text-teal-800 border-teal-300"
                            : veh.profit_margin_pct >= 0
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}>
                          {isProfitable ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {veh.profit_margin_pct}%
                        </span>
                      </td>

                      {/* In-Hand Petty Cash Audit */}
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap text-[11px]">
                        <div>
                          <span className="text-slate-500">Allocated: </span>
                          <strong className="text-slate-800">₹{veh.petty_cash_allocated}</strong>
                        </div>
                        <div>
                          <span className="text-amber-700">Spent: </span>
                          <strong className="text-amber-900">₹{veh.inhand_cash_spent}</strong>
                        </div>
                        <div className="text-[10px] text-teal-700 font-black">
                          Return: ₹{veh.petty_cash_returned}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Total Summary Footer Row */}
        <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-black uppercase tracking-wider text-[11px]">
              Fleet Totals:
            </span>
            <span>{filteredVehicles.length} Vehicles Audited</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Total Revenue:</span>
              <span className="text-emerald-400 font-black text-sm">
                ₹{summary.total_revenue.toLocaleString()}
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Total Expenses:</span>
              <span className="text-amber-400 font-black text-sm">
                − ₹{summary.total_expenses.toLocaleString()}
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Net Profit:</span>
              <span className="text-teal-300 font-black text-base">
                ₹{summary.net_profit.toLocaleString()}
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Average Margin:</span>
              <span className="text-white font-black text-sm">
                {summary.profit_margin_pct}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

