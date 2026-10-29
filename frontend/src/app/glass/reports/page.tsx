"use client";

import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Truck,
  Layers,
  CheckCircle2,
  DollarSign,
  Fuel,
  Receipt,
  Sparkles
} from "lucide-react";
import { getGlassReport, GlassReportData } from "@/lib/api";
import toast from "react-hot-toast";

type DatePreset = "YEAR" | "Q1" | "Q2" | "Q3" | "Q4" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM";
type TabType = "pl" | "sales" | "purchases" | "expenses" | "stock";

export default function GlassCaReportsPage() {
  const currentYear = new Date().getFullYear();

  const [preset, setPreset] = useState<DatePreset>("YEAR");
  const [startDate, setStartDate] = useState<string>(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState<string>(`${currentYear}-12-31`);
  const [activeTab, setActiveTab] = useState<TabType>("pl");
  const [report, setReport] = useState<GlassReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Apply quick date preset
  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    const now = new Date();
    const yr = now.getFullYear();

    if (p === "YEAR") {
      setStartDate(`${yr}-01-01`);
      setEndDate(`${yr}-12-31`);
    } else if (p === "Q1") {
      setStartDate(`${yr}-01-01`);
      setEndDate(`${yr}-03-31`);
    } else if (p === "Q2") {
      setStartDate(`${yr}-04-01`);
      setEndDate(`${yr}-06-30`);
    } else if (p === "Q3") {
      setStartDate(`${yr}-07-01`);
      setEndDate(`${yr}-09-30`);
    } else if (p === "Q4") {
      setStartDate(`${yr}-10-01`);
      setEndDate(`${yr}-12-31`);
    } else if (p === "THIS_MONTH") {
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(yr, now.getMonth() + 1, 0).getDate();
      setStartDate(`${yr}-${m}-01`);
      setEndDate(`${yr}-${m}-${String(lastDay).padStart(2, "0")}`);
    } else if (p === "LAST_MONTH") {
      const prevMDate = new Date(yr, now.getMonth() - 1, 1);
      const prevYr = prevMDate.getFullYear();
      const prevM = String(prevMDate.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(prevYr, prevMDate.getMonth() + 1, 0).getDate();
      setStartDate(`${prevYr}-${prevM}-01`);
      setEndDate(`${prevYr}-${prevM}-${String(lastDay).padStart(2, "0")}`);
    }
  };

  const fetchReport = async (s = startDate, e = endDate) => {
    try {
      setIsRefreshing(true);
      const data = await getGlassReport(s, e);
      setReport(data);
    } catch (err: any) {
      console.error("Failed to load CA report:", err);
      toast.error("Failed to fetch CA Financial Report: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReport(startDate, endDate);
  }, [startDate, endDate]);

  // Handlers for Custom Date Apply
  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Please select valid start and end dates");
      return;
    }
    if (startDate > endDate) {
      toast.error("Start date cannot be after end date");
      return;
    }
    setPreset("CUSTOM");
    fetchReport(startDate, endDate);
  };

  // 1-Click Print / Download PDF
  const handlePrint = () => {
    window.print();
  };

  // 1-Click Export CSV Helper
  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Consolidated Audit Report to CSV
  const handleExportAllCsv = () => {
    if (!report) return;

    let csv = `FLYERA TRADERS - CA FINANCIAL AUDIT STATEMENT\n`;
    csv += `Division: Glass Logistics & Circular Cullet Recycling Division\n`;
    csv += `Audit Period: ${report.period.label}\n`;
    csv += `Fiscal Calendar: ${report.fiscal_calendar}\n`;
    csv += `Generated On: ${report.generated_at}\n\n`;

    // 1. P&L
    csv += `=== STATEMENT OF PROFIT & LOSS ===\n`;
    csv += `Particulars,Tonnage (Tons),Amount (INR)\n`;
    csv += `Gross Sales Revenue (Recycling Mills),${report.pl_statement.total_sales_tons},${report.pl_statement.gross_sales_revenue}\n`;
    csv += `  - Flint White Glass Sales,${report.pl_statement.white_sales_tons},${report.pl_statement.white_sales_revenue}\n`;
    csv += `  - Mixed Color Glass Sales,${report.pl_statement.mixed_sales_tons},${report.pl_statement.mixed_sales_revenue}\n`;
    csv += `Cost of Materials Purchased (Hotel Payouts),${report.pl_statement.total_purchased_tons},${report.pl_statement.cost_of_materials_purchased}\n`;
    csv += `GROSS OPERATING PROFIT,,${report.pl_statement.gross_profit}\n`;
    csv += `Gross Margin (%),,${report.pl_statement.gross_margin_percent}%\n`;
    csv += `Operating & Fleet Expenses,,${report.pl_statement.operating_expenses.total_operating_expenses}\n`;
    csv += `  - Fuel & Diesel,,${report.pl_statement.operating_expenses.fuel_and_diesel}\n`;
    csv += `  - Highway Tolls,,${report.pl_statement.operating_expenses.highway_tolls}\n`;
    csv += `  - Vehicle Maintenance & Repairs,,${report.pl_statement.operating_expenses.vehicle_maintenance}\n`;
    csv += `  - Other Fleet Expenses,,${report.pl_statement.operating_expenses.other_logistics}\n`;
    csv += `NET OPERATING PROFIT BEFORE TAX,,${report.pl_statement.net_operating_profit}\n`;
    csv += `Net Margin (%),,${report.pl_statement.net_margin_percent}%\n\n`;

    // 2. Closing Inventory
    csv += `=== CLOSING INVENTORY & STOCK VALUATION ===\n`;
    csv += `Category,Type,Stock Quantity (Tons),Benchmark Rate / Ton (INR),Stock Valuation (INR)\n`;
    report.closing_inventory.forEach((i) => {
      csv += `"${i.category}","${i.type}",${i.quantity_tons},${i.benchmark_rate_per_ton},${i.valuation_amount}\n`;
    });
    csv += `Total Closing Stock,,"${report.inventory_summary.total_stock_tons} Tons",,"${report.inventory_summary.total_stock_valuation}"\n\n`;

    // 3. Sales Register
    csv += `=== SALES REGISTER (RECYCLING MILL DISPATCHES) ===\n`;
    csv += `Invoice No,Date,Vendor / Mill Name,Glass Grade,Tonnage (Tons),Rate Per Ton (INR),Total Bill Amount (INR)\n`;
    report.sales_ledger.forEach((s) => {
      csv += `"${s.invoice_no}","${s.date}","${s.vendor_name}","${s.type}",${s.tons},${s.price_per_ton},${s.total_amount}\n`;
    });
    csv += `\n`;

    // 4. Purchases Register
    csv += `=== PURCHASES REGISTER (CULLET INTAKE FROM HOTELS & COMMERCIAL SOURCES) ===\n`;
    csv += `Voucher No,Date,Property Name,Category,Location,Tons Collected,Payment Amount (INR),Assigned Driver,Vehicle\n`;
    report.purchases_ledger.forEach((p) => {
      csv += `"${p.voucher_no}","${p.date}","${p.property_name}","${p.category}","${p.location}",${p.tons_collected},${p.payment_amount},"${p.driver_name}","${p.vehicle}"\n`;
    });
    csv += `\n`;

    // 5. Fleet Expenses
    csv += `=== FLEET & LOGISTICS EXPENSES REGISTER ===\n`;
    csv += `Voucher No,Date,Category,Amount (INR),Vehicle,Reported By,Description\n`;
    report.expenses_ledger.forEach((e) => {
      csv += `"${e.voucher_no}","${e.date}","${e.category}",${e.amount},"${e.vehicle}","${e.reported_by}","${e.description}"\n`;
    });

    const filename = `Flyera_Traders_CA_Audit_Report_${report.period.start_date}_to_${report.period.end_date}.csv`;
    downloadCsv(csv, filename);
    toast.success("Downloaded Complete CA Audit Spreadsheet!");
  };

  const pl = report?.pl_statement;

  return (
    <div className="flex min-h-screen bg-[#FDFBF7]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 lg:p-10 pt-20 md:pt-8 pb-24 md:pb-12 transition-all">
        {/* ================= PRINT-ONLY STYLES & FORMAL LETTERHEAD ================= */}
        <style jsx global>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            font-size: 11pt !important;
          }
          nav, aside, header, .no-print, button, .date-filter-bar, .tab-bar {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 24px !important;
            padding-bottom: 16px !important;
            border-bottom: 2px solid #0f172a !important;
          }
          table {
            page-break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          .print-section {
            page-break-inside: avoid !important;
            margin-bottom: 24px !important;
          }
        }
      `}</style>

        {/* Screen Title & Action Bar */}
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <FileText className="w-6 h-6 text-emerald-600" /> CA Accountant & Audit Reports
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                  Flyera Traders
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500">
                Official Statement of Profit & Loss, Itemized Purchase & Sales Registers, and Closing Inventory Valuation for Tax & Audit.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => fetchReport(startDate, endDate)}
                disabled={isRefreshing}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                title="Refresh Report Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={handleExportAllCsv}
                disabled={loading || !report}
                className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shadow-2xs"
                title="Export all ledgers to CSV / Excel spreadsheet"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handlePrint}
                disabled={loading || !report}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                title="Print formal report or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>

          {/* ================= DATE & CALENDAR YEAR SELECTOR ================= */}
          <div className="no-print bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Reporting Schedule: Calendar Year (Jan 1 – Dec 31)
                </span>
              </div>
              {report && (
                <span className="text-xs font-bold text-slate-500">
                  Current Audit Scope: <span className="text-emerald-700 font-black">{report.period.label}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 mr-1">Presets:</span>
              {[
                { id: "YEAR", label: `This Year (${currentYear})` },
                { id: "Q1", label: "Q1 (Jan - Mar)" },
                { id: "Q2", label: "Q2 (Apr - Jun)" },
                { id: "Q3", label: "Q3 (Jul - Sep)" },
                { id: "Q4", label: "Q4 (Oct - Dec)" },
                { id: "THIS_MONTH", label: "This Month" },
                { id: "LAST_MONTH", label: "Last Month" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id as DatePreset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${preset === p.id
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleApplyCustomDates} className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs font-bold text-slate-400 mr-1">Custom Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:bg-white focus:outline-emerald-500"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:bg-white focus:outline-emerald-500"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all"
              >
                Apply Filter
              </button>
            </form>
          </div>

          {/* ================= FORMAL PRINT-ONLY LETTERHEAD ================= */}
          <div className="hidden print-header">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">FLYERA TRADERS</h1>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Glass Logistics & Circular Cullet Recycling Division
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Godown Depot & Central Recycling Facility • Goa Operations
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block bg-slate-900 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
                  CA AUDIT STATEMENT
                </span>
                <p className="text-xs font-bold text-slate-800 mt-1">Audit Period: {report?.period.label}</p>
                <p className="text-[10px] text-slate-500">Generated: {report?.generated_at}</p>
                <p className="text-[10px] text-slate-500">{report?.fiscal_calendar}</p>
              </div>
            </div>
          </div>

          {/* ================= EXECUTIVE SUMMARY METRIC CARDS ================= */}
          {loading ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-black text-slate-700">Compiling financial ledgers & closing inventory...</p>
            </div>
          ) : report && pl ? (
            <>
              <div className="no-print grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                {/* Sales Revenue */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Gross Sales (Mills)
                  </span>
                  <p className="text-lg md:text-xl font-black text-slate-900">
                    ₹{pl.gross_sales_revenue.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] font-bold text-emerald-600 mt-0.5">
                    {pl.total_sales_tons.toFixed(1)} Tons Dispatched
                  </p>
                </div>

                {/* COGS (Cullet Purchases) */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Intake Purchases (COGS)
                  </span>
                  <p className="text-lg md:text-xl font-black text-slate-900">
                    ₹{pl.cost_of_materials_purchased.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    {pl.total_purchased_tons.toFixed(1)} Tons Sourced
                  </p>
                </div>

                {/* Gross Margin */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Gross Profit
                  </span>
                  <p className={`text-lg md:text-xl font-black ${pl.gross_profit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    ₹{pl.gross_profit.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    {pl.gross_margin_percent}% Gross Margin
                  </p>
                </div>

                {/* Fleet & Logistics Expenses */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Fleet & Logistics
                  </span>
                  <p className="text-lg md:text-xl font-black text-slate-900">
                    ₹{pl.operating_expenses.total_operating_expenses.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    Fuel, Tolls & Maintenance
                  </p>
                </div>

                {/* Net Profit */}
                <div className="p-4 rounded-2xl col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block mb-1">
                    Net Operating Profit
                  </span>
                  <p className={`text-xl md:text-2xl font-black ${pl.net_operating_profit >= 0 ? "text-emerald-800" : "text-rose-700"}`}>
                    ₹{pl.net_operating_profit.toLocaleString("en-IN")}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 mt-0.5">
                    {pl.net_operating_profit >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>{pl.net_margin_percent}% Net Margin</span>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs for Ledger Views */}
              <div className="no-print flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                {[
                  { id: "pl", label: "Statement of P&L", icon: DollarSign },
                  { id: "sales", label: `Sales Register (${report.sales_ledger.length})`, icon: Truck },
                  { id: "purchases", label: `Purchases Register (${report.purchases_ledger.length})`, icon: Receipt },
                  { id: "expenses", label: `Logistics Expenses (${report.expenses_ledger.length})`, icon: Fuel },
                  { id: "stock", label: "Closing Stock Valuation", icon: Layers },
                ].map((t) => {
                  const Icon = t.icon;
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id as TabType)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${active
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80"
                        }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* ================= TAB 1: STATEMENT OF PROFIT & LOSS ================= */}
              <div className={`print-section ${activeTab === "pl" ? "block" : "hidden md:hidden print:block"}`}>
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Statement of Profit and Loss (P&L)
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        For the period {report.period.label} • Currency in INR (₹)
                      </p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                      Schedule III Format
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-5">Particulars / Line Item</th>
                          <th className="py-3 px-4 text-center">Reference Note</th>
                          <th className="py-3 px-4 text-right">Quantity (Tons)</th>
                          <th className="py-3 px-5 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {/* Section I */}
                        <tr className="bg-slate-50/50 font-black text-slate-900">
                          <td colSpan={4} className="py-2.5 px-5 uppercase text-[11px] tracking-wide text-emerald-800">
                            I. REVENUE FROM RECYCLING OPERATIONS
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-5 pl-8 font-medium">
                            Sale of Flint White Glass Cullet (Direct to Glass Plants)
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[10px]">Note 1</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700">
                            {pl.white_sales_tons.toFixed(2)} T
                          </td>
                          <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-900">
                            ₹{pl.white_sales_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-5 pl-8 font-medium">
                            Sale of Mixed Color Glass Cullet (Commercial Container Recyclers)
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[10px]">Note 1</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700">
                            {pl.mixed_sales_tons.toFixed(2)} T
                          </td>
                          <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-900">
                            ₹{pl.mixed_sales_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr className="bg-emerald-50/40 font-black">
                          <td className="py-3 px-5 text-emerald-950 font-black">
                            TOTAL REVENUE FROM OPERATIONS (A)
                          </td>
                          <td className="py-3 px-4 text-center text-emerald-700"></td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-800">
                            {pl.total_sales_tons.toFixed(2)} T
                          </td>
                          <td className="py-3 px-5 text-right font-mono text-emerald-900 text-sm">
                            ₹{pl.gross_sales_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>

                        {/* Section II */}
                        <tr className="bg-slate-50/50 font-black text-slate-900">
                          <td colSpan={4} className="py-2.5 px-5 uppercase text-[11px] tracking-wide text-emerald-800">
                            II. COST OF RAW MATERIALS (DIRECT INTAKE EXPENSES)
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-5 pl-8 font-medium">
                            Cullet Purchases & Payouts (Hotels, Resorts, Bars & Commercial Centers)
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[10px]">Note 2</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700">
                            {pl.total_purchased_tons.toFixed(2)} T
                          </td>
                          <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-900">
                            ₹{pl.cost_of_materials_purchased.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr className="bg-amber-50/40 font-black">
                          <td className="py-3 px-5 text-amber-950">
                            TOTAL COST OF MATERIALS (COGS) (B)
                          </td>
                          <td className="py-3 px-4"></td>
                          <td className="py-3 px-4 text-right font-mono text-amber-800">
                            {pl.total_purchased_tons.toFixed(2)} T
                          </td>
                          <td className="py-3 px-5 text-right font-mono text-amber-900 text-sm">
                            ₹{pl.cost_of_materials_purchased.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>

                        {/* Section III: Gross Profit */}
                        <tr className="bg-slate-100/70 font-black text-slate-900 border-t-2 border-b-2 border-slate-300">
                          <td className="py-3.5 px-5 text-sm uppercase">
                            III. GROSS OPERATING PROFIT (A - B)
                          </td>
                          <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-500">
                            Margin: {pl.gross_margin_percent}%
                          </td>
                          <td className="py-3.5 px-4"></td>
                          <td className={`py-3.5 px-5 text-right font-mono text-sm ${pl.gross_profit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                            ₹{pl.gross_profit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>

                        {/* Section IV: Operating Expenses */}
                        <tr className="bg-slate-50/50 font-black text-slate-900">
                          <td colSpan={4} className="py-2.5 px-5 uppercase text-[11px] tracking-wide text-emerald-800">
                            IV. FLEET & LOGISTICS OPERATING EXPENSES (INDIRECT EXPENSES)
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-5 pl-8 font-medium">Vehicle Fuel & Diesel (Collection Fleet)</td>
                          <td className="py-2 px-4 text-center text-slate-400 font-mono text-[10px]">Note 3</td>
                          <td className="py-2 px-4 text-right text-slate-400">—</td>
                          <td className="py-2 px-5 text-right font-mono text-slate-800">
                            ₹{pl.operating_expenses.fuel_and_diesel.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-5 pl-8 font-medium">Highway Tolls & Fastag Charges</td>
                          <td className="py-2 px-4 text-center text-slate-400 font-mono text-[10px]">Note 3</td>
                          <td className="py-2 px-4 text-right text-slate-400">—</td>
                          <td className="py-2 px-5 text-right font-mono text-slate-800">
                            ₹{pl.operating_expenses.highway_tolls.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-5 pl-8 font-medium">Truck Servicing, Tyres & Scheduled Maintenance</td>
                          <td className="py-2 px-4 text-center text-slate-400 font-mono text-[10px]">Note 3</td>
                          <td className="py-2 px-4 text-right text-slate-400">—</td>
                          <td className="py-2 px-5 text-right font-mono text-slate-800">
                            ₹{pl.operating_expenses.vehicle_maintenance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        {pl.operating_expenses.other_logistics > 0 && (
                          <tr>
                            <td className="py-2 px-5 pl-8 font-medium">Other Loading & Logistics Sundries</td>
                            <td className="py-2 px-4 text-center text-slate-400 font-mono text-[10px]">Note 3</td>
                            <td className="py-2 px-4 text-right text-slate-400">—</td>
                            <td className="py-2 px-5 text-right font-mono text-slate-800">
                              ₹{pl.operating_expenses.other_logistics.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-slate-50 font-black">
                          <td className="py-2.5 px-5 text-slate-800">
                            TOTAL OPERATING & LOGISTICS EXPENSES (C)
                          </td>
                          <td className="py-2.5 px-4"></td>
                          <td className="py-2.5 px-4"></td>
                          <td className="py-2.5 px-5 text-right font-mono text-slate-900 font-bold">
                            ₹{pl.operating_expenses.total_operating_expenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>

                        {/* Section V: Net Operating Profit */}
                        <tr className="bg-emerald-100/70 font-black text-emerald-950 border-t-2 border-b-2 border-emerald-400">
                          <td className="py-4 px-5 text-sm uppercase font-black">
                            V. NET OPERATING PROFIT BEFORE TAX (III - C)
                          </td>
                          <td className="py-4 px-4 text-center text-xs font-black text-emerald-800">
                            Net Margin: {pl.net_margin_percent}%
                          </td>
                          <td className="py-4 px-4"></td>
                          <td className="py-4 px-5 text-right font-mono text-base font-black text-emerald-900">
                            ₹{pl.net_operating_profit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ================= TAB 2: SALES REGISTER (RECYCLING MILL DISPATCHES) ================= */}
              <div className={`print-section ${activeTab === "sales" ? "block" : "hidden md:hidden print:block"}`}>
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Truck className="w-5 h-5 text-emerald-600" /> Sales Register (Recycling Mills & Outward Dispatches)
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        Itemized list of bulk cullet outbound trucks and invoice receivables
                      </p>
                    </div>
                    <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                      {report.sales_ledger.length} Invoices
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-5">Invoice No</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Recycling Mill / Buyer</th>
                          <th className="py-3 px-4">Glass Grade</th>
                          <th className="py-3 px-4 text-right">Tonnage</th>
                          <th className="py-3 px-4 text-right">Rate / Ton (₹)</th>
                          <th className="py-3 px-5 text-right">Total Invoice (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.sales_ledger.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                              No outbound mill dispatches recorded in this date range.
                            </td>
                          </tr>
                        ) : (
                          report.sales_ledger.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-5 font-mono font-bold text-emerald-700">{s.invoice_no}</td>
                              <td className="py-3 px-4 text-slate-600 font-semibold">{s.date}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{s.vendor_name}</td>
                              <td className="py-3 px-4">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${s.type.includes("White") ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"
                                  }`}>
                                  {s.type}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                                {s.tons.toFixed(2)} T
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-600">
                                ₹{s.price_per_ton.toLocaleString("en-IN")}
                              </td>
                              <td className="py-3 px-5 text-right font-mono font-black text-slate-900">
                                ₹{s.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {report.sales_ledger.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 font-black text-slate-900 border-t border-slate-200">
                            <td colSpan={4} className="py-3 px-5 uppercase text-xs">Total Sales Value</td>
                            <td className="py-3 px-4 text-right font-mono">{pl.total_sales_tons.toFixed(2)} T</td>
                            <td className="py-3 px-4"></td>
                            <td className="py-3 px-5 text-right font-mono text-emerald-800 text-sm">
                              ₹{pl.gross_sales_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>

              {/* ================= TAB 3: PURCHASES REGISTER (CULLET INTAKE) ================= */}
              <div className={`print-section ${activeTab === "purchases" ? "block" : "hidden md:hidden print:block"}`}>
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-emerald-600" /> Purchases Register (Commercial Cullet Inward Intake)
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        Direct cullet acquisitions from hotels, resorts, bars, and commercial outlets
                      </p>
                    </div>
                    <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                      {report.purchases_ledger.length} Vouchers
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-5">Voucher No</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Property / Supplier</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Location</th>
                          <th className="py-3 px-4 text-right">Intake (Tons)</th>
                          <th className="py-3 px-4 text-right">Payout (₹)</th>
                          <th className="py-3 px-5">Driver & Truck</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.purchases_ledger.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-400 font-semibold">
                              No cullet purchases logged in this date range.
                            </td>
                          </tr>
                        ) : (
                          report.purchases_ledger.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-5 font-mono font-bold text-slate-600">{p.voucher_no}</td>
                              <td className="py-3 px-4 text-slate-600 font-semibold">{p.date}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{p.property_name}</td>
                              <td className="py-3 px-4">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                  {p.category}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-500 max-w-[150px] truncate">{p.location || "—"}</td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                                {p.tons_collected.toFixed(2)} T
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                                ₹{p.payment_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-5 text-slate-500 text-[11px]">
                                {p.driver_name} <span className="text-slate-400 font-mono">({p.vehicle})</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {report.purchases_ledger.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 font-black text-slate-900 border-t border-slate-200">
                            <td colSpan={5} className="py-3 px-5 uppercase text-xs">Total Cullet Intake</td>
                            <td className="py-3 px-4 text-right font-mono">{pl.total_purchased_tons.toFixed(2)} T</td>
                            <td className="py-3 px-4 text-right font-mono text-amber-800 text-sm">
                              ₹{pl.cost_of_materials_purchased.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-5"></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>

              {/* ================= TAB 4: FLEET & LOGISTICS EXPENSES ================= */}
              <div className={`print-section ${activeTab === "expenses" ? "block" : "hidden md:hidden print:block"}`}>
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Fuel className="w-5 h-5 text-emerald-600" /> Fleet & Logistics Operating Expenses
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        Trip expenses, fuel, tolls, and maintenance billed to glass collection vehicles
                      </p>
                    </div>
                    <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                      {report.expenses_ledger.length} Records
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-5">Voucher No</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Expense Category</th>
                          <th className="py-3 px-4">Vehicle</th>
                          <th className="py-3 px-4">Reported By</th>
                          <th className="py-3 px-4">Description / Bill Notes</th>
                          <th className="py-3 px-5 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.expenses_ledger.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                              No fleet expenses logged in this date range.
                            </td>
                          </tr>
                        ) : (
                          report.expenses_ledger.map((e) => (
                            <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-5 font-mono font-bold text-slate-600">{e.voucher_no}</td>
                              <td className="py-3 px-4 text-slate-600 font-semibold">{e.date}</td>
                              <td className="py-3 px-4">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${e.category === "FUEL"
                                    ? "bg-amber-100 text-amber-800"
                                    : e.category === "TOLL"
                                      ? "bg-sky-100 text-sky-800"
                                      : "bg-slate-100 text-slate-700"
                                  }`}>
                                  {e.category}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-slate-700">{e.vehicle}</td>
                              <td className="py-3 px-4 text-slate-600">{e.reported_by}</td>
                              <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate">{e.description || "—"}</td>
                              <td className="py-3 px-5 text-right font-mono font-black text-slate-900">
                                ₹{e.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {report.expenses_ledger.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 font-black text-slate-900 border-t border-slate-200">
                            <td colSpan={6} className="py-3 px-5 uppercase text-xs">Total Operating Expenses</td>
                            <td className="py-3 px-5 text-right font-mono text-slate-900 text-sm">
                              ₹{pl.operating_expenses.total_operating_expenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>

              {/* ================= TAB 5: CLOSING STOCK INVENTORY VALUATION ================= */}
              <div className={`print-section ${activeTab === "stock" ? "block" : "hidden md:hidden print:block"}`}>
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-emerald-600" /> Closing Inventory & Stock Asset Valuation
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        Current unsegregated and segregated cullet tonnage in godown valued at benchmark realizable market prices
                      </p>
                    </div>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                      Total Valuation: ₹{report.inventory_summary.total_stock_valuation.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-5">Inventory Classification</th>
                          <th className="py-3 px-4">Stock Type</th>
                          <th className="py-3 px-4 text-right">Physical Quantity (Tons)</th>
                          <th className="py-3 px-4 text-right">Benchmark Rate / Ton (₹)</th>
                          <th className="py-3 px-5 text-right">Asset Valuation (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.closing_inventory.map((item) => (
                          <tr key={item.type} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-5 font-bold text-slate-800 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>{item.category}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                {item.type}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700 text-sm">
                              {item.quantity_tons.toFixed(2)} T
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                              ₹{item.benchmark_rate_per_ton.toLocaleString("en-IN")}
                            </td>
                            <td className="py-3.5 px-5 text-right font-mono font-black text-slate-900 text-sm">
                              ₹{item.valuation_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-50/70 font-black text-emerald-950 border-t border-emerald-300">
                          <td colSpan={2} className="py-3.5 px-5 uppercase text-xs">
                            Total Godown Cullet Stock
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-900">
                            {report.inventory_summary.total_stock_tons.toFixed(2)} T
                          </td>
                          <td className="py-3.5 px-4"></td>
                          <td className="py-3.5 px-5 text-right font-mono text-emerald-900 text-base">
                            ₹{report.inventory_summary.total_stock_valuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

