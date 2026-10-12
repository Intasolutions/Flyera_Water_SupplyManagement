"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { 
  TrendingUp, 
  Package, 
  Truck, 
  IndianRupee,
  Calendar,
  RefreshCw,
  ArrowRight,
  Sparkles,
  MapPin,
  Clock,
  CheckCircle2,
  QrCode,
  ShieldCheck,
  Check,
  Edit2
} from "lucide-react";
import { getDashboardStats } from "@/lib/actions";
import { getSettings, updateSettings } from "@/lib/api";
import { useStore } from "@/lib/StoreContext";
import QRCode from "qrcode";
import { toast } from "react-hot-toast";

export default function DashboardPage() {
  const { currentUserRole } = useStore();
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>({
    totalClients: 0,
    totalVehicles: 0,
    activeAssignments: 0,
    todayRevenue: 0,
    activeRoutes: [],
    recentActivity: []
  });

  // Admin Merchant UPI Setup State
  const [upiId, setUpiId] = useState("flyera@okhdfcbank");
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [tempUpi, setTempUpi] = useState("flyera@okhdfcbank");
  const [savingUpi, setSavingUpi] = useState(false);
  const [adminQrUrl, setAdminQrUrl] = useState("");

  useEffect(() => {
    // 1. Try local storage cache
    try {
      const cached = localStorage.getItem("flyera_system_settings");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.upi_id) {
          setUpiId(parsed.upi_id);
          setTempUpi(parsed.upi_id);
        }
      }
    } catch (e) {}

    // 2. Fetch from backend settings API
    getSettings()
      .then(s => {
        if (s && s.upi_id) {
          setUpiId(s.upi_id);
          setTempUpi(s.upi_id);
          try {
            const existing = JSON.parse(localStorage.getItem("flyera_system_settings") || "{}");
            localStorage.setItem("flyera_system_settings", JSON.stringify({ ...existing, ...s }));
          } catch (e) {}
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Generate live sample QR code for Admin
    const sampleUri = `upi://pay?pa=${upiId}&pn=Flyera%20Logistics&am=100.00&tn=Test%20Payment&cu=INR`;
    QRCode.toDataURL(sampleUri, { width: 140, margin: 1 })
      .then(url => setAdminQrUrl(url))
      .catch(() => {});
  }, [upiId]);

  const handleSaveUpi = async () => {
    if (!tempUpi.trim()) {
      toast.error("Please enter a valid UPI ID (e.g. name@bank)");
      return;
    }
    const cleanUpi = tempUpi.trim();
    setSavingUpi(true);
    try {
      try {
        const existing = JSON.parse(localStorage.getItem("flyera_system_settings") || "{}");
        localStorage.setItem("flyera_system_settings", JSON.stringify({ ...existing, upi_id: cleanUpi }));
      } catch (e) {}

      await updateSettings({ upi_id: cleanUpi });
      setUpiId(cleanUpi);
      setIsEditingUpi(false);
      toast.success("Merchant UPI ID updated! All drivers will now collect to this VPA.");
    } catch (err) {
      console.error("Failed to update UPI ID", err);
      toast.error("Failed to save UPI ID to server. Please try again.");
    } finally {
      setSavingUpi(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getDashboardStats(startDate, endDate);
      if (data) setStats(data);
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FDFBF7]">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-72 p-4 sm:p-6 md:p-10 lg:p-12 pt-20 md:pt-10 pb-24 md:pb-12 transition-all relative">
        {/* Standardized Frosted Page Header */}
        <PageHeader
          title="Water Supply Operations"
          subtitle="Real-time bottling logistics, active route tracking & daily revenue overview"
          badgeText="Operations Hub Live"
          actionSlot={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStats}
                disabled={loading}
                icon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : "text-slate-500"}`} />}
              >
                Refresh
              </Button>
              <Link href="/deliveries">
                <Button icon={<Truck className="w-4 h-4" />}>
                  Dispatch Center
                </Button>
              </Link>
            </div>
          }
        />

        {/* Top KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <StatCard
            label="Period Revenue"
            value={`₹${(stats.todayRevenue || 0).toLocaleString()}`}
            subtext="Total collected drops"
            icon={<IndianRupee className="w-6 h-6" />}
            color="emerald"
            category="Cash & QR"
          />
          <StatCard
            label="Active Fleet On-Road"
            value={`${stats.activeAssignments || 0} / ${stats.totalVehicles || 0}`}
            subtext="Dispatched delivery vans"
            icon={<Truck className="w-6 h-6" />}
            color="blue"
            category="Fleet Telemetry"
          />
          <StatCard
            label="Routed Customers"
            value={(stats.totalClients || 0).toString()}
            subtext="Registered supply locations"
            icon={<Package className="w-6 h-6" />}
            color="purple"
            category="Customer Base"
          />
          <StatCard
            label="System Health"
            value="Optimal"
            subtext="All microservices synced"
            icon={<TrendingUp className="w-6 h-6" />}
            color="amber"
            category="Infrastructure"
          />
        </div>        {/* Admin Merchant UPI & Driver QR Payment Setup Card (Admin Only) */}
        {currentUserRole === "Owner" && (
          <div className="glass-panel p-5 md:p-6 mb-8 shadow-xs border-emerald-100 bg-gradient-to-r from-emerald-50/60 via-white to-sky-50/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-slate-900">
                      Admin Merchant UPI Configuration
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Driver Locked (Admin Only)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Controls the receiving bank account for all drivers&apos; dynamic QR codes and thermal printed receipts across the fleet.
                  </p>
                  
                  {/* Active UPI ID Display / Edit Input */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-600">Active Merchant VPA:</span>
                    {isEditingUpi ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tempUpi}
                          onChange={e => setTempUpi(e.target.value)}
                          placeholder="e.g. yourname@okhdfcbank"
                          className="bg-white border-2 border-emerald-500 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={handleSaveUpi}
                          disabled={savingUpi}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{savingUpi ? "Saving..." : "Save UPI"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingUpi(false)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs text-sm">
                          {upiId || "flyera@okhdfcbank"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTempUpi(upiId);
                            setIsEditingUpi(true);
                          }}
                          className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl shadow-2xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Change UPI ID</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Scan Preview for Admin */}
              <div className="flex items-center gap-3.5 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs shrink-0 self-start md:self-auto">
                {adminQrUrl ? (
                  <img
                    src={adminQrUrl}
                    alt="Test UPI QR"
                    className="w-16 h-16 rounded-lg border border-slate-100"
                  />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-400">
                    Loading...
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-slate-800">Live Test QR</p>
                  <p className="text-[11px] text-slate-500 font-medium">Scan to verify bank VPA</p>
                  <Link
                    href="/settings"
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 mt-1"
                  >
                    <span>More Settings</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Date Filter Toolbar */}
        <div className="glass-panel p-4 md:p-5 mb-8 shadow-xs">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Reporting Range:
              </span>
              <div className="flex items-center gap-2 bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 shadow-2xs">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="outline-none text-xs font-semibold text-slate-700 bg-transparent cursor-pointer"
                />
                <span className="text-slate-300 font-medium text-xs">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="outline-none text-xs font-semibold text-slate-700 bg-transparent cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setStartDate(today);
                  setEndDate(today);
                }}
                className="px-3.5 py-1.5 bg-white/90 hover:bg-white text-slate-700 text-xs font-semibold rounded-xl border border-slate-200/80 shadow-2xs transition-all active:scale-95"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
                  const today = now.toISOString().split("T")[0];
                  setStartDate(firstDay);
                  setEndDate(today);
                }}
                className="px-3.5 py-1.5 bg-white/90 hover:bg-white text-slate-700 text-xs font-semibold rounded-xl border border-slate-200/80 shadow-2xs transition-all active:scale-95"
              >
                This Month
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Active Routes (8 cols) */}
          <div className="lg:col-span-8 glass-panel p-6 shadow-xs space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Fleet In Transit
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">Active Delivery Corridors</h2>
              </div>
              <Link
                href="/deliveries"
                className="text-xs font-bold text-primary hover:text-sky-700 flex items-center gap-1 transition-colors"
              >
                <span>View Full Dispatch</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3.5">
              {stats.activeRoutes && stats.activeRoutes.length > 0 ? (
                stats.activeRoutes.map((route: any, i: number) => (
                  <div
                    key={i}
                    className="p-4 sm:p-5 bg-white/90 rounded-2xl border border-slate-100 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-200"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-primary shrink-0">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{route.vehicle}</p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Driver: <span className="text-slate-700 font-semibold">{route.driver}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 max-w-xs mx-0 sm:mx-4">
                      <div className="flex justify-between text-xs mb-1 font-semibold">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Route Progress</span>
                        <span className="text-primary font-bold">{route.progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-primary rounded-full transition-all duration-500"
                          style={{ width: `${route.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-slate-900 block">{route.deliveries}</span>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Drops Completed
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center">
                  <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-600 font-semibold text-sm">No vehicles currently on the road.</p>
                  <p className="text-slate-400 text-xs mt-1">Assign and dispatch routes in Deliveries &amp; Assignments.</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Operations Activity (4 cols) */}
          <div className="lg:col-span-4 glass-panel p-6 shadow-xs space-y-5">
            <div className="pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Audit Trail
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Recent Activity</h2>
            </div>

            <div className="space-y-4">
              {stats.recentActivity && stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((act: any, i: number) => {
                  const date = new Date(act.time);
                  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-2.5 h-2.5 mt-1.5 rounded-full bg-primary shadow-xs ring-4 ring-primary/10 shrink-0" />
                      <div>
                        <p className="text-xs sm:text-sm text-slate-800 font-bold leading-relaxed">{act.text}</p>
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {timeStr}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-500 text-xs sm:text-sm font-semibold py-8 text-center">No recent telemetry activity recorded.</p>
              )}
            </div>
          </div>
        </div>

        {/* Brand Signature Footer */}
        <footer className="w-full mt-12 py-6 text-center border-t border-slate-200/60 flex items-center justify-center">
          <p className="text-xs font-semibold text-slate-400">
            Powered by{" "}
            <a
              href="https://in-tasolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-black bg-gradient-to-r from-slate-950 via-slate-900 to-blue-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity underline decoration-blue-500/30 underline-offset-2"
              title="Visit IN-TA Solutions"
            >
              IN-TA Solution PVT LTD
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
