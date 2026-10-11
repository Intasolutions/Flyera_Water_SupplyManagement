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
  CheckCircle2
} from "lucide-react";
import { getDashboardStats } from "@/lib/actions";

export default function DashboardPage() {
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
        </div>

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
      </main>
    </div>
  );
}
