"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/ui/Sidebar";
import { useStore } from "@/lib/StoreContext";
import { 
  getGlassStats, 
  GlassStats, 
  GlassCollection, 
  GlassVendorPickup 
} from "@/lib/api";
import { 
  Recycle, 
  Factory, 
  IndianRupee, 
  Truck, 
  Calendar, 
  RefreshCw, 
  TrendingUp, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  Layers, 
  PlusCircle, 
  Warehouse,
  ChevronRight
} from "lucide-react";

export default function GlassDashboardPage() {
  const store = useStore();
  
  // Date filter state - default to past 30 days up to today
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activePreset, setActivePreset] = useState<"today" | "week" | "month" | "all">("month");

  // Dynamic state from backend
  const [stats, setStats] = useState<GlassStats | null>(null);

  // Fallback calculation from StoreContext if backend is unreachable
  const computeFallbackStats = useCallback((): GlassStats => {
    const collections = store.glassCollections || [];
    const pickups = store.glassVendorPickups || [];
    const inventory = store.glassInventory || [];

    const totalCollectedTons = collections.reduce((acc, c: any) => acc + (c.tonsCollected || c.tons_collected || 0), 0);
    const totalPaid = collections.reduce((acc, c: any) => acc + (c.paymentAmount || c.payment_amount || 0), 0);
    
    const unseparatedTons = collections
      .filter((c: any) => c.status === "dropped_at_godown")
      .reduce((acc, c: any) => acc + (c.tonsCollected || c.tons_collected || 0), 0);

    const inTransit = collections.filter((c: any) => c.status === "collected");
    const inTransitTons = inTransit.reduce((acc, c: any) => acc + (c.tonsCollected || c.tons_collected || 0), 0);

    const whiteTons = inventory.find(i => i.type === "white")?.tons || 0;
    const mixedTons = inventory.find(i => i.type === "mixed")?.tons || 0;

    const totalPickupTons = pickups.reduce((acc, p: any) => acc + (p.tons || 0), 0);
    const totalPickupRevenue = pickups.reduce((acc, p: any) => acc + ((p.tons || 0) * (p.price_per_ton || p.pricePerTon || 0)), 0);

    return {
      totalCollectedTons,
      totalPaid,
      unseparatedTons,
      whiteTons,
      mixedTons,
      totalPickupTons,
      totalPickupRevenue,
      inTransitTons,
      inTransitCount: inTransit.length,
      recentPickups: pickups.slice(0, 6) as any,
      recentCollections: collections.slice(0, 8) as any
    };
  }, [store.glassCollections, store.glassVendorPickups, store.glassInventory]);

  // Fetch dynamic stats from backend
  const fetchStats = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const data = await getGlassStats(startDate, endDate);
      if (data) {
        setStats(data);
      } else {
        setStats(computeFallbackStats());
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn("Backend glass stats fetch failed, using local store data:", err);
      setStats(computeFallbackStats());
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate, computeFallbackStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Preset quick handlers
  const handlePreset = (preset: "today" | "week" | "month" | "all") => {
    setActivePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    setEndDate(todayStr);

    if (preset === "today") {
      setStartDate(todayStr);
    } else if (preset === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split("T")[0]);
    } else if (preset === "month") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split("T")[0]);
    } else if (preset === "all") {
      setStartDate("2020-01-01");
    }
  };

  const currentStats = stats || computeFallbackStats();

  // Inventory distribution calculation
  const totalGodownStock = (currentStats.whiteTons || 0) + (currentStats.mixedTons || 0) + (currentStats.unseparatedTons || 0);
  const whitePercent = totalGodownStock > 0 ? Math.round(((currentStats.whiteTons || 0) / totalGodownStock) * 100) : 0;
  const mixedPercent = totalGodownStock > 0 ? Math.round(((currentStats.mixedTons || 0) / totalGodownStock) * 100) : 0;
  const unseparatedPercent = totalGodownStock > 0 ? Math.max(0, 100 - whitePercent - mixedPercent) : 0;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-72 p-4 sm:p-6 md:p-10 lg:p-12 pt-20 md:pt-10 pb-24 md:pb-12 transition-all max-w-7xl">
        {/* Header with Title and Dynamic Date Controls */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-text tracking-tight">Glass Business Dashboard</h1>
              <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-full shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Connected
              </span>
            </div>
            <p className="text-text-muted mt-1 text-sm">
              Real-time glass collection, godown segregation, and vendor dispatches.
            </p>
          </div>

          {/* Date Picker & Presets Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Presets */}
            <div className="flex bg-surface border border-black/5 rounded-xl p-1 shadow-sm text-xs font-bold">
              <button
                onClick={() => handlePreset("today")}
                className={`px-3 py-1.5 rounded-lg transition-all ${activePreset === "today" ? "bg-white shadow text-primary font-black" : "text-text-muted hover:text-text"}`}
              >
                Today
              </button>
              <button
                onClick={() => handlePreset("week")}
                className={`px-3 py-1.5 rounded-lg transition-all ${activePreset === "week" ? "bg-white shadow text-primary font-black" : "text-text-muted hover:text-text"}`}
              >
                7 Days
              </button>
              <button
                onClick={() => handlePreset("month")}
                className={`px-3 py-1.5 rounded-lg transition-all ${activePreset === "month" ? "bg-white shadow text-primary font-black" : "text-text-muted hover:text-text"}`}
              >
                30 Days
              </button>
              <button
                onClick={() => handlePreset("all")}
                className={`px-3 py-1.5 rounded-lg transition-all ${activePreset === "all" ? "bg-white shadow text-primary font-black" : "text-text-muted hover:text-text"}`}
              >
                All
              </button>
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm text-xs">
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset("month");
                }}
                className="outline-none text-slate-700 bg-transparent font-medium cursor-pointer"
              />
              <span className="text-slate-400 font-bold">to</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset("month");
                }}
                className="outline-none text-slate-700 bg-transparent font-medium cursor-pointer"
              />
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchStats(true)}
              title="Refresh live data"
              className="p-2.5 bg-white border border-gray-200 hover:border-emerald-500 rounded-xl shadow-sm text-text-muted hover:text-emerald-600 transition-all active:scale-95 flex items-center justify-center"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
            </button>
          </div>
        </header>

        {/* Quick Action Navigation Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Link
            href="/glass/driver"
            className="group flex items-center justify-between p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-sm group-hover:scale-105 transition-transform">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-text text-sm">Driver Collection Portal</p>
                <p className="text-xs text-text-muted">Log hotel & property drops</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>

          <Link
            href="/glass/godown"
            className="group flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 rounded-2xl transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm group-hover:scale-105 transition-transform">
                <Factory className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-text text-sm">Godown Separation</p>
                <p className="text-xs text-text-muted">Process white & mixed cullet</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>

          <Link
            href="/glass/vendor"
            className="group flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 hover:border-purple-500/40 rounded-2xl transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500 text-white rounded-xl shadow-sm group-hover:scale-105 transition-transform">
                <Warehouse className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-text text-sm">Vendor Dispatch</p>
                <p className="text-xs text-text-muted">Sell & dispatch sorted glass</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-purple-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>

        {/* Dynamic Metric Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <StatCard 
            title="Total Collected" 
            value={`${(currentStats.totalCollectedTons || 0).toFixed(1)} T`} 
            trend="In selected period" 
            icon={<Recycle className="w-5 h-5 text-emerald-600" />}
            badge="Intake"
            color="emerald"
          />
          <StatCard 
            title="Total Paid" 
            value={`₹${(currentStats.totalPaid || 0).toLocaleString()}`} 
            trend="To properties" 
            icon={<IndianRupee className="w-5 h-5 text-blue-600" />}
            badge="Expenses"
            color="blue"
          />
          <StatCard 
            title="Ready to Separate" 
            value={`${(currentStats.unseparatedTons || 0).toFixed(1)} T`} 
            trend="Dropped in Godown" 
            icon={<Factory className="w-5 h-5 text-amber-600" />}
            badge="Pending"
            color="amber"
          />
          <StatCard 
            title="White Glass Stock" 
            value={`${(currentStats.whiteTons || 0).toFixed(1)} T`} 
            trend="Segregated cullet" 
            icon={<Layers className="w-5 h-5 text-cyan-600" />}
            badge="High Value"
            color="cyan"
          />
          <StatCard 
            title="Mixed Glass Stock" 
            value={`${(currentStats.mixedTons || 0).toFixed(1)} T`} 
            trend="Standard cullet" 
            icon={<Layers className="w-5 h-5 text-purple-600" />}
            badge="Available"
            color="purple"
          />
          <StatCard 
            title="Vendor Dispatched" 
            value={`${(currentStats.totalPickupTons || 0).toFixed(1)} T`} 
            trend={`₹${((currentStats.totalPickupRevenue || 0)).toLocaleString()} rev`} 
            icon={<TrendingUp className="w-5 h-5 text-rose-600" />}
            badge="Sales"
            color="rose"
          />
        </div>

        {/* Visual Godown Stock Breakdown Banner */}
        <div className="glass-panel p-6 rounded-3xl mb-8 border border-black/5 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <div>
              <h2 className="text-base font-bold text-text flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-primary" />
                Godown Inventory Balance
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Current total on-site stock: <span className="font-bold text-text">{totalGodownStock.toFixed(1)} Tons</span>
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-cyan-700">
                <span className="w-3 h-3 rounded-md bg-cyan-500"></span> White Glass ({whitePercent}%)
              </span>
              <span className="flex items-center gap-1.5 text-purple-700">
                <span className="w-3 h-3 rounded-md bg-purple-500"></span> Mixed Glass ({mixedPercent}%)
              </span>
              <span className="flex items-center gap-1.5 text-amber-700">
                <span className="w-3 h-3 rounded-md bg-amber-500"></span> Unseparated ({unseparatedPercent}%)
              </span>
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
            <div 
              style={{ width: `${whitePercent}%` }} 
              className="h-full bg-cyan-500 transition-all duration-500" 
              title={`White Glass: ${currentStats.whiteTons} T`}
            />
            <div 
              style={{ width: `${mixedPercent}%` }} 
              className="h-full bg-purple-500 transition-all duration-500" 
              title={`Mixed Glass: ${currentStats.mixedTons} T`}
            />
            <div 
              style={{ width: `${unseparatedPercent}%` }} 
              className="h-full bg-amber-500 transition-all duration-500" 
              title={`Unseparated: ${currentStats.unseparatedTons} T`}
            />
          </div>
        </div>

        {/* Main Content Area: Recent Pickups & Recent Collections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Vendor Pickups Card */}
          <div className="glass-panel rounded-3xl p-6 border border-black/5 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-black text-text flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-purple-600" />
                  Recent Vendor Pickups
                </h2>
                <p className="text-xs text-text-muted mt-0.5">Dispatches to glass scrap buyers</p>
              </div>
              <Link 
                href="/glass/vendor"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                Record Pickup <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3 flex-1">
              {(!currentStats.recentPickups || currentStats.recentPickups.length === 0) ? (
                <div className="p-8 text-center bg-surface/50 rounded-2xl border border-dashed border-gray-200">
                  <Warehouse className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-text-muted text-sm font-medium">No vendor dispatches in this period.</p>
                  <Link 
                    href="/glass/vendor" 
                    className="inline-block mt-3 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    Log First Pickup
                  </Link>
                </div>
              ) : (
                currentStats.recentPickups.map((pickup: GlassVendorPickup) => {
                  const pickupName = pickup.vendorName || pickup.vendor_name || "Vendor";
                  const pickupType = pickup.type || "glass";
                  const pickupTons = pickup.tons || 0;
                  const price = pickup.pricePerTon || pickup.price_per_ton || 0;
                  const pickupDate = pickup.date ? new Date(pickup.date) : new Date();

                  return (
                    <div 
                      key={pickup.id} 
                      className="p-4 bg-surface hover:bg-surface-hover rounded-2xl border border-black/5 shadow-sm flex justify-between items-center transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl font-bold text-xs ${
                          pickupType === "white" 
                            ? "bg-cyan-50 text-cyan-700 border border-cyan-200" 
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}>
                          {pickupType === "white" ? "WHITE" : "MIXED"}
                        </div>
                        <div>
                          <p className="font-bold text-text text-sm">{pickupName}</p>
                          <p className="text-xs text-text-muted">
                            {pickupDate.toLocaleDateString()} at {pickupDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-black text-text text-base">{pickupTons} T</p>
                        {price > 0 ? (
                          <p className="text-xs text-emerald-600 font-bold">
                            ₹{(pickupTons * price).toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-xs text-text-muted">Standard rate</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Collections Card */}
          <div className="glass-panel rounded-3xl p-6 border border-black/5 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-black text-text flex items-center gap-2">
                  <Recycle className="w-5 h-5 text-emerald-600" />
                  Recent Property Collections
                </h2>
                <p className="text-xs text-text-muted mt-0.5">Intake logged by drivers</p>
              </div>
              <Link 
                href="/glass/driver"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                Log Collection <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3 flex-1">
              {(!currentStats.recentCollections || currentStats.recentCollections.length === 0) ? (
                <div className="p-8 text-center bg-surface/50 rounded-2xl border border-dashed border-gray-200">
                  <Recycle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-text-muted text-sm font-medium">No collections recorded in this period.</p>
                  <Link 
                    href="/glass/driver" 
                    className="inline-block mt-3 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    Log New Collection
                  </Link>
                </div>
              ) : (
                currentStats.recentCollections.map((collection: GlassCollection) => {
                  const propName = collection.property || "Unknown Property";
                  const tons = collection.tonsCollected ?? collection.tons_collected ?? 0;
                  const payment = collection.paymentAmount ?? collection.payment_amount ?? 0;
                  const status = collection.status || "collected";
                  const driverName = collection.driverName || collection.driver_name || "Driver";
                  const collDate = collection.date ? new Date(collection.date) : new Date();

                  const statusConfig = {
                    collected: { label: "In Transit", bg: "bg-amber-50 text-amber-700 border-amber-200" },
                    dropped_at_godown: { label: "In Godown", bg: "bg-blue-50 text-blue-700 border-blue-200" },
                    separated: { label: "Segregated", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" }
                  }[status] || { label: status, bg: "bg-gray-50 text-gray-700 border-gray-200" };

                  return (
                    <div 
                      key={collection.id} 
                      className="p-4 bg-surface hover:bg-surface-hover rounded-2xl border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900 text-sm sm:text-base">{propName}</p>
                          <span className={`text-xs uppercase tracking-wider font-black px-2.5 py-0.5 rounded-lg border ${statusConfig.bg}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-1 flex items-center gap-2">
                          <span>👤 {driverName}</span>
                          <span>•</span>
                          <span>{collDate.toLocaleDateString()}</span>
                        </p>
                      </div>

                      <div className="text-left sm:text-right flex sm:flex-col justify-between items-center sm:items-end">
                        <p className="font-black text-slate-900 text-base sm:text-lg">{tons} T</p>
                        <p className="text-xs sm:text-sm text-emerald-700 font-bold">
                          {payment > 0 ? `Paid ₹${payment.toLocaleString()}` : "Free Pickup"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  trend, 
  icon, 
  badge, 
  color 
}: { 
  title: string; 
  value: string; 
  trend: string; 
  icon: React.ReactNode; 
  badge: string; 
  color: "emerald" | "blue" | "amber" | "cyan" | "purple" | "rose";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
    rose: "bg-rose-50 border-rose-200 text-rose-800",
  };

  return (
    <div className="glass-panel p-5 sm:p-6 rounded-3xl hover:shadow-md transition-all border border-black/5 group relative overflow-hidden">
      <div className="flex justify-between items-start mb-3">
        <div className="p-2.5 sm:p-3 bg-surface rounded-2xl border border-black/5 shadow-xs group-hover:scale-105 transition-transform">
          {icon}
        </div>
        <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${colorMap[color]}`}>
          {badge}
        </span>
      </div>
      <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{title}</h3>
      <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
      <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">{trend}</p>
    </div>
  );
}
