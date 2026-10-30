"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import {
  FileText,
  Printer,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Truck,
  Layers,
  DollarSign,
  Fuel,
  Receipt,
  Users
} from "lucide-react";
import { getWaterCaReport, WaterCaReportData } from "@/lib/api";
import toast from "react-hot-toast";

type DatePreset = "YEAR" | "Q1" | "Q2" | "Q3" | "Q4" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM";
type TabType = "pl" | "sales" | "expenses" | "debtors" | "stock";

export default function WaterCaReportsPage() {
  const currentYear = new Date().getFullYear();

  const [preset, setPreset] = useState<DatePreset>("YEAR");
  const [startDate, setStartDate] = useState<string>(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState<string>(`${currentYear}-12-31`);
  const [activeTab, setActiveTab] = useState<TabType>("pl");
  const [report, setReport] = useState<WaterCaReportData | null>(null);
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
      const data = await getWaterCaReport(s, e);
      setReport(data);
    } catch (err: any) {
      console.error("Failed to load CA reports:", err);
      toast.error(err.message || "Failed to load CA financial report");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReport(startDate, endDate);
  }, [preset]);

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Start date cannot be after end date");
      return;
    }
    setPreset("CUSTOM");
    fetchReport(startDate, endDate);
  };

  const handlePrint = () => {
    window.print();
  };

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

  const handleExportAllCsv = () => {
    if (!report) return;

    let csv = `FLYERA TRADERS - CA FINANCIAL AUDIT STATEMENT\n`;
    csv += `Division: Water Logistics & Bottled Water Distribution Division\n`;
    csv += `Audit Period: ${report.period.label}\n`;
    csv += `Fiscal Calendar: ${report.fiscal_calendar}\n`;
    csv += `Generated On: ${report.generated_at}\n\n`;

    // 1. P&L
    csv += `=== STATEMENT OF PROFIT & LOSS ===\n`;
    csv += `Particulars,Quantity (Jars/Units),Amount (INR)\n`;
    csv += `Gross Sales Revenue (Water Deliveries),${report.summary.total_jars_delivered},${report.pl_statement.gross_sales_revenue}\n`;
    csv += `  - 20L Water Jars Sales,,${report.pl_statement.water_jars_revenue}\n`;
    csv += `  - Dispensaries & Accessories Sales,,${report.pl_statement.accessories_revenue}\n`;
    csv += `  - Other Operating Income,,${report.pl_statement.other_operating_revenue}\n`;
    csv += `Cost of Materials & Production (COGS),,${report.pl_statement.cost_of_materials}\n`;
    csv += `GROSS OPERATING PROFIT,,${report.pl_statement.gross_profit}\n`;
    csv += `Gross Margin (%),,${report.pl_statement.gross_margin_percent}%\n`;
    csv += `Fleet & Logistics Expenses,,${report.pl_statement.operating_expenses.total_operating_expenses}\n`;
    csv += `  - Vehicle Fuel & Diesel,,${report.pl_statement.operating_expenses.fuel_and_diesel}\n`;
    csv += `  - Highway Tolls & FASTag,,${report.pl_statement.operating_expenses.highway_tolls}\n`;
    csv += `  - Vehicle Maintenance & Repairs,,${report.pl_statement.operating_expenses.vehicle_maintenance}\n`;
    csv += `  - Daily Parking & Crew Allowances,,${report.pl_statement.operating_expenses.parking_and_allowances}\n`;
    csv += `  - Other Route Logistics,,${report.pl_statement.operating_expenses.other_logistics}\n`;
    csv += `NET OPERATING PROFIT BEFORE TAX,,${report.pl_statement.net_operating_profit}\n`;
    csv += `Net Margin (%),,${report.pl_statement.net_margin_percent}%\n\n`;

    // 2. Closing Inventory
    csv += `=== CLOSING INVENTORY & STOCK VALUATION ===\n`;
    csv += `Category,Item Name,Full Stock,Empty Stock,Damaged Stock,Benchmark Unit Rate (INR),Stock Valuation (INR)\n`;
    report.closing_inventory.forEach((i) => {
      csv += `"${i.category}","${i.name}",${i.full_stock},${i.empty_stock},${i.damaged_stock},${i.benchmark_rate},${i.valuation_amount}\n`;
    });
    csv += `Total Closing Stock Valuation,,,,,,"${report.inventory_summary.total_stock_valuation}"\n\n`;

    // 3. Sales Register
    csv += `=== SALES REGISTER (WATER DELIVERIES) ===\n`;
    csv += `Invoice No,Date,Customer Name,Phone,Route,Jars Delivered,Payment Method,Cash (INR),Direct UPI (INR),Credit Due (INR),Total Bill (INR),Driver,Vehicle,Status\n`;
    report.sales_ledger.forEach((s) => {
      csv += `"${s.invoice_no}","${s.date}","${s.client_name}","${s.phone}","${s.route}",${s.jars_delivered},"${s.payment_method}",${s.cash_amount},${s.upi_amount},${s.credit_amount},${s.total_amount},"${s.driver_name}","${s.vehicle}","${s.status}"\n`;
    });
    csv += `\n`;

    // 4. Logistics Expenses
    csv += `=== FLEET & LOGISTICS EXPENSES REGISTER ===\n`;
    csv += `Voucher No,Date,Category,Amount (INR),Vehicle,Reported By,Payment Source,Description\n`;
    report.expenses_ledger.forEach((e) => {
      csv += `"${e.voucher_no}","${e.date}","${e.category}",${e.amount},"${e.vehicle}","${e.reported_by}","${e.payment_source}","${e.description}"\n`;
    });
    csv += `\n`;

    // 5. Debtors Ledger
    csv += `=== SUNDRY DEBTORS (CUSTOMER RECEIVABLES) ===\n`;
    csv += `Customer Name,Phone,Address,Route,Outstanding Credit (INR),Empty Bottles Balance\n`;
    report.debtors_ledger.forEach((d) => {
      csv += `"${d.client_name}","${d.phone}","${d.address}","${d.route}",${d.outstanding_credit},${d.bottle_balance}\n`;
    });

    const filename = `Flyera_Water_CA_Audit_Report_${report.period.start_date}_to_${report.period.end_date}.csv`;
    downloadCsv(csv, filename);
    toast.success("Downloaded Complete CA Audit Spreadsheet!");
  };

  const pl = report?.pl_statement;
  const sm = report?.summary;

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
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <FileText className="w-6 h-6 text-sky-600" /> CA Accountant &amp; Audit Reports
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md">
                  Flyera Water Logistics
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500">
                Official Statement of Profit &amp; Loss, Itemized Sales Register, Fleet Expense Ledger, and Closing Stock Valuation for Tax &amp; Audit.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => fetchReport(startDate, endDate)}
                disabled={isRefreshing}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                title="Refresh Report Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-sky-600" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={handleExportAllCsv}
                disabled={loading || !report}
                className="px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shadow-2xs"
                title="Export all ledgers to CSV / Excel spreadsheet"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handlePrint}
                disabled={loading || !report}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
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
                <Calendar className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Reporting Schedule: Calendar Year (Jan 1 – Dec 31)
                </span>
              </div>
              {report && (
                <span className="text-xs font-bold text-slate-500">
                  Current Audit Scope: <span className="text-sky-700 font-black">{report.period.label}</span>
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
                      ? "bg-sky-600 text-white shadow-2xs font-black"
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
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:bg-white focus:outline-sky-500"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:bg-white focus:outline-sky-500"
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
                  Water Logistics &amp; Bottled Drinking Water Distribution
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Central Bottling Depot &amp; Fleet Operations
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
              <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-black text-slate-700">Compiling financial ledgers &amp; closing inventory...</p>
            </div>
          ) : report && pl && sm ? (
            <>
              <div className="no-print grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                {/* Gross Sales */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Gross Sales (Deliveries)
                  </span>
                  <p className="text-lg md:text-xl font-black text-slate-900">
                    ₹{sm.gross_sales_revenue.toLocaleString("en-IN")}
                  </p>
                  <span className="text-[11px] font-bold text-slate-500 mt-1 block">
                    {sm.total_jars_delivered} Jars Dispatched
                  </span>
                </div>

                {/* Fleet Logistics Expenses */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Fleet &amp; Logistics
                  </span>
                  <p className="text-lg md:text-xl font-black text-slate-900">
                    ₹{sm.fleet_expenses.toLocaleString("en-IN")}
                  </p>
                  <span className="text-[11px] font-bold text-slate-500 mt-1 block">
                    Fuel, Tolls &amp; Maintenance
                  </span>
                </div>

                {/* Gross Operating Profit */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Gross Profit
                  </span>
                  <p className={`text-lg md:text-xl font-black ${sm.gross_profit >= 0 ? "text-slate-900" : "text-rose-600"}`}>
                    ₹{sm.gross_profit.toLocaleString("en-IN")}
                  </p>
                  <span className="text-[11px] font-bold text-slate-500 mt-1 block">
                    {sm.gross_margin_percent}% Gross Margin
                  </span>
                </div>

                {/* Sundry Debtors (Receivables) */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Customer Credit Due
                  </span>
                  <p className="text-lg md:text-xl font-black text-amber-700">
                    ₹{sm.total_credit_outstanding.toLocaleString("en-IN")}
                  </p>
                  <span className="text-[11px] font-bold text-amber-600 mt-1 block">
                    {report.debtors_summary.total_debtors_count} Accounts Receivable
                  </span>
                </div>

                {/* Net Operating Profit */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs col-span-2 lg:col-span-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Net Operating Profit
                  </span>
                  <p className={`text-lg md:text-xl font-black ${sm.net_operating_profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    ₹{sm.net_operating_profit.toLocaleString("en-IN")}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mt-1">
                    {sm.net_operating_profit >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>{sm.net_margin_percent}% Net Margin</span>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs for Ledger Views */}
              <div className="no-print flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                {[
                  { id: "pl", label: "Statement of P&L", icon: DollarSign },
                  { id: "sales", label: `Sales Register (${report.sales_ledger.length})`, icon: Truck },
                  { id: "expenses", label: `Logistics Expenses (${report.expenses_ledger.length})`, icon: Fuel },
                  { id: "debtors", label: `Customer Receivables (${report.debtors_ledger.length})`, icon: Users },
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
                        Statement of Profit and Loss (P&amp;L)
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        For the period {report.period.label} &bull; Currency in INR (₹)
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
                          <th className="py-3 px-4 text-right">Quantity (Jars)</th>
                          <th className="py-3 px-5 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {/* Section I */}
                        <tr className="bg-slate-50/50 font-black text-slate-900">
                          <td colSpan={4} className="py-2.5 px-5 uppercase text-[11px] tracking-wide text-sky-800">
                            I. REVENUE FROM WATER LOGISTICS OPERATIONS
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-5 pl-8 font-medium">
                            Sale of 20L Packaged Drinking Water Jars
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[10px]">Note 1</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700">
                            {sm.total_jars_delivered} Jars
                          </td>
                          <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-900">
                            ₹{pl.water_jars_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-5 pl-8 font-medium">
                            Sale of Dispensary Units &amp; Accessories
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[10px]">Note 1</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700">
                            Units
                          </td>
                          <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-900">
                            ₹{pl.accessories_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        {pl.other_operating_revenue > 0 && (
                          <tr>
                            <td className="py-2.5 px-5 pl-8 font-medium">
                              Other Operating Income &amp; Delivery Surcharges
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[10px]">Note 1</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700">-</td>
                            <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-900">
                              ₹{pl.other_operating_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-sky-50/40 font-black text-slate-900 border-t-2 border-slate-200">
                          <td className="py-3 px-5">TOTAL REVENUE FROM OPERATIONS (A)</td>
                          <td className="py-3 px-4 text-center"></td>
                          <td className="py-3 px-4 text-right font-mono">{sm.total_jars_delivered} Jars</td>
                          <td className="py-3 px-5 text-right font-mono text-sm text-sky-900">
                            ₹{pl.gross_sales_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>

                        {/* Section II */}
                        <tr className="bg-slate-50/50 font-black text-slate-900">
                          <td colSpan={4} className="py-2.5 px-5 uppercase text-[11px] tracking-wide text-amber-800">
                            II. COST OF MATERIALS &amp; PRODUCTION (COGS)
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-5 pl-8 font-medium">
                            Water Sourcing, Purification &amp; Packaging Raw Materials
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[10px]">Note 2</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700">-</td>
                          <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-900">
                            ₹{pl.cost_of_materials.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr className="bg-amber-50/40 font-black text-slate-900 border-t border-slate-200">
                          <td className="py-2.5 px-5">GROSS OPERATING PROFIT (I &minus; II)</td>
                          <td className="py-2.5 px-4 text-center"></td>
                          <td className="py-2.5 px-4 text-right font-mono text-emerald-700">
                            {pl.gross_margin_percent}% Margin
                          </td>
                          <td className="py-2.5 px-5 text-right font-mono text-sm text-amber-900">
                            ₹{pl.gross_profit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>

                        {/* Section III */}
                        <tr className="bg-slate-50/50 font-black text-slate-900">
                          <td colSpan={4} className="py-2.5 px-5 uppercase text-[11px] tracking-wide text-slate-700">
                            III. FLEET, LOGISTICS &amp; ON-ROAD TRIP EXPENSES
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-5 pl-8 text-slate-700">Fleet Fuel &amp; Diesel</td>
                          <td className="py-2 px-4 text-center text-slate-400 font-mono text-[10px]">Note 3</td>
                          <td className="py-2 px-4 text-right font-mono text-slate-500">-</td>
                          <td className="py-2 px-5 text-right font-mono font-medium text-slate-800">
                            ₹{pl.operating_expenses.fuel_and_diesel.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-5 pl-8 text-slate-700">Highway Tolls &amp; FASTag</td>
                          <td className="py-2 px-4 text-center text-slate-400 font-mono text-[10px]">Note 3</td>
                          <td className="py-2 px-4 text-right font-mono text-slate-500">-</td>
                          <td className="py-2 px-5 text-right font-mono font-medium text-slate-800">
                            ₹{pl.operating_expenses.highway_tolls.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-5 pl-8 text-slate-700">Vehicle Maintenance &amp; Servicing</td>
                          <td className="py-2 px-4 text-center text-slate-400 font-mono text-[10px]">Note 3</td>
                          <td className="py-2 px-4 text-right font-mono text-slate-500">-</td>
                          <td className="py-2 px-5 text-right font-mono font-medium text-slate-800">
                            ₹{pl.operating_expenses.vehicle_maintenance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-5 pl-8 text-slate-700">Daily Parking &amp; Crew On-Road Allowances</td>
                          <td className="py-2 px-4 text-center text-slate-400 font-mono text-[10px]">Note 3</td>
                          <td className="py-2 px-4 text-right font-mono text-slate-500">-</td>
                          <td className="py-2 px-5 text-right font-mono font-medium text-slate-800">
                            ₹{pl.operating_expenses.parking_and_allowances.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        {pl.operating_expenses.other_logistics > 0 && (
                          <tr>
                            <td className="py-2 px-5 pl-8 text-slate-700">Other General Logistics &amp; Travel Expenses</td>
                            <td className="py-2 px-4 text-center text-slate-400 font-mono text-[10px]">Note 3</td>
                            <td className="py-2 px-4 text-right font-mono text-slate-500">-</td>
                            <td className="py-2 px-5 text-right font-mono font-medium text-slate-800">
                              ₹{pl.operating_expenses.other_logistics.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-slate-100/60 font-black text-slate-900 border-t border-slate-200">
                          <td className="py-2.5 px-5">TOTAL OPERATING &amp; FLEET EXPENSES (B)</td>
                          <td className="py-2.5 px-4 text-center"></td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-500">-</td>
                          <td className="py-2.5 px-5 text-right font-mono text-slate-900">
                            ₹{pl.operating_expenses.total_operating_expenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>

                        {/* Net Operating Profit */}
                        <tr className="bg-slate-900 text-white font-black text-sm border-t-2 border-slate-900">
                          <td className="py-3.5 px-5">
                            IV. NET OPERATING PROFIT BEFORE TAX (PBT)
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-400 text-xs">A &minus; B</td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-400 text-xs">
                            {pl.net_margin_percent}% Net Margin
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono text-base text-emerald-400">
                            ₹{pl.net_operating_profit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ================= TAB 2: SALES REGISTER ================= */}
              <div className={`print-section ${activeTab === "sales" ? "block" : "hidden md:hidden print:block"}`}>
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Sales Register (Itemized Water Deliveries)
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        Complete sales ledger of delivered customer orders, billing amount, and payment mode breakdown.
                      </p>
                    </div>
                    <span className="text-xs font-black text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                      Total Sales: ₹{pl.gross_sales_revenue.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-4">Invoice / Date</th>
                          <th className="py-3 px-4">Customer &amp; Phone</th>
                          <th className="py-3 px-4">Route</th>
                          <th className="py-3 px-3 text-right">Jars</th>
                          <th className="py-3 px-3 text-right">Cash (₹)</th>
                          <th className="py-3 px-3 text-right">Direct UPI (₹)</th>
                          <th className="py-3 px-3 text-right">Credit Due (₹)</th>
                          <th className="py-3 px-4 text-right">Total Bill (₹)</th>
                          <th className="py-3 px-4">Driver &amp; Van</th>
                          <th className="py-3 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.sales_ledger.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-slate-400 font-bold">
                              No delivery sales recorded for this period.
                            </td>
                          </tr>
                        ) : (
                          report.sales_ledger.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-4">
                                <span className="font-mono font-bold text-slate-900 block">{s.invoice_no}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">{s.date}</span>
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="font-bold text-slate-900 block">{s.client_name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{s.phone}</span>
                              </td>
                              <td className="py-2.5 px-4 font-semibold text-slate-600">{s.route}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                                {s.jars_delivered}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                                {s.cash_amount > 0 ? `₹${s.cash_amount.toLocaleString()}` : "-"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-sky-700 font-semibold">
                                {s.upi_amount > 0 ? `₹${s.upi_amount.toLocaleString()}` : "-"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-amber-700 font-semibold">
                                {s.credit_amount > 0 ? `₹${s.credit_amount.toLocaleString()}` : "-"}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900">
                                ₹{s.total_amount.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="font-bold text-slate-800 block">{s.driver_name}</span>
                                <span className="text-[10px] text-slate-400">{s.vehicle}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${s.status === "COMPLETED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                  }`}>
                                  {s.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ================= TAB 3: LOGISTICS EXPENSES ================= */}
              <div className={`print-section ${activeTab === "expenses" ? "block" : "hidden md:hidden print:block"}`}>
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Fleet &amp; Logistics Expenses Register
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        Audited on-road vouchers for fuel, highway tolls, vehicle repairs and crew allowances.
                      </p>
                    </div>
                    <span className="text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      Total Expenses: ₹{pl.operating_expenses.total_operating_expenses.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-4">Voucher No</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Vehicle</th>
                          <th className="py-3 px-4">Reported By</th>
                          <th className="py-3 px-4">Payment Source</th>
                          <th className="py-3 px-4">Description</th>
                          <th className="py-3 px-5 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.expenses_ledger.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">
                              No logistics expenses logged for this period.
                            </td>
                          </tr>
                        ) : (
                          report.expenses_ledger.map((e) => (
                            <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{e.voucher_no}</td>
                              <td className="py-2.5 px-4 text-slate-600 font-medium">{e.date}</td>
                              <td className="py-2.5 px-4">
                                <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                                  {e.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-bold text-slate-700">{e.vehicle}</td>
                              <td className="py-2.5 px-4 text-slate-600 font-medium">{e.reported_by}</td>
                              <td className="py-2.5 px-4">
                                <span className={`text-[10px] font-bold ${e.payment_source.includes("In-Hand") ? "text-emerald-700" : "text-amber-700"}`}>
                                  {e.payment_source}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-500 max-w-xs truncate">{e.description || "—"}</td>
                              <td className="py-2.5 px-5 text-right font-mono font-black text-slate-900">
                                ₹{e.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ================= TAB 4: SUNDRY DEBTORS (RECEIVABLES) ================= */}
              <div className={`print-section ${activeTab === "debtors" ? "block" : "hidden md:hidden print:block"}`}>
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Sundry Debtors Register (Accounts Receivable)
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        Customer doorstep credit balances and unreturned empty bottle deposits for Balance Sheet audit.
                      </p>
                    </div>
                    <span className="text-xs font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      Total Receivables: ₹{report.debtors_summary.total_credit_receivables.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-5">Customer Name</th>
                          <th className="py-3 px-4">Phone</th>
                          <th className="py-3 px-4">Delivery Route</th>
                          <th className="py-3 px-5">Address</th>
                          <th className="py-3 px-4 text-center">Bottle Balance</th>
                          <th className="py-3 px-5 text-right">Outstanding Dues (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.debtors_ledger.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                              No outstanding customer credit balances! All accounts settled.
                            </td>
                          </tr>
                        ) : (
                          report.debtors_ledger.map((d) => (
                            <tr key={d.client_id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-5 font-bold text-slate-900">{d.client_name}</td>
                              <td className="py-3 px-4 font-mono text-slate-600">{d.phone || "—"}</td>
                              <td className="py-3 px-4 text-slate-700 font-medium">{d.route}</td>
                              <td className="py-3 px-5 text-slate-500 max-w-xs truncate">{d.address || "—"}</td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-blue-700">
                                {d.bottle_balance > 0 ? `${d.bottle_balance} Cans` : "0"}
                              </td>
                              <td className="py-3 px-5 text-right font-mono font-black text-rose-700 text-sm">
                                ₹{d.outstanding_credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ================= TAB 5: CLOSING STOCK VALUATION ================= */}
              <div className={`print-section ${activeTab === "stock" ? "block" : "hidden md:hidden print:block"}`}>
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Closing Inventory &amp; Stock Valuation
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        Warehouse physical count and balance sheet asset valuation for packaged water and dispensing units.
                      </p>
                    </div>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      Total Valuation: ₹{report.inventory_summary.total_stock_valuation.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-5">Category</th>
                          <th className="py-3 px-5">Item Name</th>
                          <th className="py-3 px-4 text-right">Full Stock (Units)</th>
                          <th className="py-3 px-4 text-right">Empty Cullet</th>
                          <th className="py-3 px-4 text-right">Damaged Stock</th>
                          <th className="py-3 px-4 text-right">Benchmark Unit Rate (₹)</th>
                          <th className="py-3 px-5 text-right">Stock Valuation (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.closing_inventory.map((i) => (
                          <tr key={i.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-5 font-semibold text-slate-500">{i.category}</td>
                            <td className="py-3 px-5 font-bold text-slate-900">{i.name}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                              {i.full_stock}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                              {i.empty_stock}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                              {i.damaged_stock}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              ₹{i.benchmark_rate}
                            </td>
                            <td className="py-3 px-5 text-right font-mono font-black text-slate-900 text-sm">
                              ₹{i.valuation_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
                          <td colSpan={2} className="py-3 px-5">TOTAL CLOSING STOCK VALUATION</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-800">
                            {report.inventory_summary.total_full_jars} Full Jars
                          </td>
                          <td colSpan={3}></td>
                          <td className="py-3 px-5 text-right font-mono text-base text-emerald-900">
                            ₹{report.inventory_summary.total_stock_valuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
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
