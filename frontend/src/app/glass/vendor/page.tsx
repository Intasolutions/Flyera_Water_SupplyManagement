"use client";

import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/StoreContext";
import {
  Truck,
  Info,
  ArrowUpRight,
  Sparkles,
  Layers,
  CheckCircle2,
  Building2,
  AlertTriangle,
  RefreshCw,
  Scale
} from "lucide-react";
import { createGlassVendorPickup, getGlassVendorPickups, getGlassInventoryList } from "@/lib/api";
import { toast } from "react-hot-toast";

export default function GlassVendorPage() {
  const { glassInventory, glassVendorPickups, recordVendorPickup } = useStore();
  const [vendorName, setVendorName] = useState("");
  const [glassType, setGlassType] = useState<"white" | "mixed">("white");
  const [tons, setTons] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentWhite = glassInventory.find(i => i.type === "white")?.tons || 0;
  const currentMixed = glassInventory.find(i => i.type === "mixed")?.tons || 0;

  const totalSoldTons = useMemo(() => {
    return glassVendorPickups.reduce((sum, p) => sum + (p.tons || 0), 0);
  }, [glassVendorPickups]);

  const handlePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const t = parseFloat(tons);

    if (!vendorName.trim() || !t || t <= 0) {
      setError("Please provide a valid vendor company name and tonnage.");
      return;
    }

    if (glassType === "white" && t > currentWhite) {
      setError(`Cannot dispatch more than available Flint/White Glass (${currentWhite.toFixed(1)} T)`);
      return;
    }
    if (glassType === "mixed" && t > currentMixed) {
      setError(`Cannot dispatch more than available Mixed Glass (${currentMixed.toFixed(1)} T)`);
      return;
    }

    setIsSubmitting(true);
    recordVendorPickup(glassType, t, vendorName.trim());

    try {
      await createGlassVendorPickup({
        vendor_name: vendorName.trim(),
        type: glassType,
        tons: t
      });
      toast.success("Vendor dispatch recorded successfully!");
      setVendorName("");
      setTons("");
    } catch (err: any) {
      console.warn("Backend vendor pickup error:", err);
      toast.error("Failed to record vendor pickup.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FDFBF7]">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-72 p-4 sm:p-6 md:p-10 lg:p-12 pt-20 md:pt-10 pb-24 md:pb-12 transition-all">
        {/* Standardized Frosted Page Header */}
        <PageHeader
          title="Vendor Dispatches & Outbound Sales"
          subtitle="Record bulk cullet sales handed over to glass factories, furnace operators & scrap recyclers"
          badgeText="Outbound Sales Active"
        />

        {/* Top KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <StatCard
            label="Available Flint (White)"
            value={`${currentWhite.toFixed(1)} T`}
            subtext="Furnace-ready sorted cullet"
            icon={<Sparkles className="w-6 h-6" />}
            color="blue"
            category="Inventory"
          />
          <StatCard
            label="Available Mixed / Amber"
            value={`${currentMixed.toFixed(1)} T`}
            subtext="Standard industrial cullet"
            icon={<Layers className="w-6 h-6" />}
            color="purple"
            category="Inventory"
          />
          <StatCard
            label="Total Cullet Dispatched"
            value={`${totalSoldTons.toFixed(1)} T`}
            subtext="Bulk scrap handed over"
            icon={<Scale className="w-6 h-6" />}
            color="emerald"
            category="Outbound Sales"
          />
          <StatCard
            label="Vendor Shipments"
            value={glassVendorPickups.length}
            subtext="Partner factory gate-outs"
            icon={<Building2 className="w-6 h-6" />}
            color="amber"
            category="Shipments"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Dispatch Record Form (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 shadow-sm">
              <div className="mb-6">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Outbound Gate-Out Pass
                </span>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  Record Vendor Gate-Out
                </h2>
              </div>

              {error && (
                <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handlePickup} className="space-y-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2 block">
                    Vendor / Factory Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={vendorName}
                    onChange={e => setVendorName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none text-slate-800 font-semibold text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xs"
                    placeholder="e.g. Hindalco Glass Works"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2 block">
                    Material Type *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGlassType("white")}
                      className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1 ${glassType === "white"
                          ? "bg-sky-50 border-sky-300 text-sky-700 ring-2 ring-sky-200/50 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                    >
                      <span>Flint (White)</span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {currentWhite.toFixed(1)} T Available
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGlassType("mixed")}
                      className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1 ${glassType === "mixed"
                          ? "bg-purple-50 border-purple-300 text-purple-700 ring-2 ring-purple-200/50 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                    >
                      <span>Mixed / Amber</span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {currentMixed.toFixed(1)} T Available
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2 block">
                    Weight Dispatched (Tons) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={tons}
                    onChange={e => setTons(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none text-slate-800 font-black text-lg focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xs"
                    placeholder="e.g. 4.5"
                  />
                </div>

                <Button
                  variant="primary"
                  fullWidth
                  disabled={isSubmitting}
                  className="py-3.5 text-sm font-black shadow-md mt-2"
                  icon={<ArrowUpRight className="w-4 h-4" />}
                >
                  {isSubmitting ? "Recording..." : "Authorize Gate-Out & Deduct Stock"}
                </Button>
              </form>
            </div>
          </div>

          {/* Right Column: Outbound History Ledger (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-panel p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Shipment Ledger
                  </span>
                  <h2 className="text-xl font-black text-slate-800">Recent Vendor Dispatches</h2>
                </div>
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs px-2.5 py-1 rounded-lg font-black">
                  {glassVendorPickups.length} Records
                </span>
              </div>

              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {glassVendorPickups.length === 0 ? (
                  <div className="bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl p-8 text-center">
                    <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 font-bold text-sm">No vendor dispatches logged yet.</p>
                    <p className="text-slate-400 text-xs mt-1 font-medium">Use the gate-out form to record scrap handed over to buyers.</p>
                  </div>
                ) : (
                  glassVendorPickups.map(pickup => (
                    <div
                      key={pickup.id}
                      className="p-4 bg-white/90 rounded-2xl border border-slate-100 flex justify-between items-center shadow-xs"
                    >
                      <div>
                        <p className="font-black text-slate-800 text-sm">{pickup.vendorName}</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {new Date(pickup.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at{" "}
                          {new Date(pickup.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-slate-800 block">
                          {pickup.tons} Tons
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md inline-block mt-0.5 ${pickup.type === "white"
                              ? "bg-sky-50 text-sky-700 border border-sky-100"
                              : "bg-purple-50 text-purple-700 border border-purple-100"
                            }`}
                        >
                          {pickup.type} Cullet
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
