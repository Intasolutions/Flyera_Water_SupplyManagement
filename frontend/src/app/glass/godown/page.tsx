"use client";

import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/StoreContext";
import {
  Factory,
  ArrowDownToLine,
  Info,
  Truck,
  Sparkles,
  Layers,
  CheckCircle2,
  Scale,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { separateGlassStock, getGlassCollections, getGlassInventoryList } from "@/lib/api";
import { toast } from "react-hot-toast";

export default function GlassGodownPage() {
  const { glassInventory, glassCollections, separateGlass, addGlassCollection } = useStore();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [whiteTons, setWhiteTons] = useState("");
  const [mixedTons, setMixedTons] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLatestDrops();
  }, []);

  const fetchLatestDrops = async () => {
    try {
      setLoading(true);
      const apiColls = await getGlassCollections("dropped_at_godown");
      if (apiColls && apiColls.length > 0) {
        apiColls.forEach((ac: any) => {
          if (!glassCollections.some(c => c.id === ac.id)) {
            addGlassCollection({
              id: ac.id,
              driverId: ac.driver_id || ac.driverId || "",
              driverName: ac.driver_name || ac.driverName || "Driver",
              vehicle: ac.vehicle || "",
              property: ac.property || "",
              location: ac.location,
              phone: ac.phone,
              tonsCollected: ac.tons_collected ?? ac.tonsCollected ?? 0,
              paymentAmount: ac.payment_amount ?? ac.paymentAmount ?? 0,
              status: ac.status || "dropped_at_godown",
              date: ac.date || new Date().toISOString()
            });
          }
        });
      }
    } catch (err) {
      console.error("Failed to load dropped collections:", err);
    } finally {
      setLoading(false);
    }
  };

  const pendingCollections = useMemo(() => {
    return glassCollections.filter(c => c.status === "dropped_at_godown");
  }, [glassCollections]);

  const selectedCollection = pendingCollections.find(c => c.id === selectedCollectionId);

  const currentWhite = glassInventory.find(i => i.type === "white")?.tons || 0;
  const currentMixed = glassInventory.find(i => i.type === "mixed")?.tons || 0;

  const totalPendingTons = pendingCollections.reduce((sum, c) => sum + (c.tonsCollected || 0), 0);

  const handleSeparate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedCollection) {
      setError("Please select a vehicle drop from the queue.");
      return;
    }

    const white = parseFloat(whiteTons) || 0;
    const mixed = parseFloat(mixedTons) || 0;
    const totalSeparated = white + mixed;

    if (totalSeparated <= 0) {
      setError("Please specify quantities extracted.");
      return;
    }

    const availableTons = selectedCollection.tonsCollected ?? (selectedCollection as any).tons_collected ?? 0;
    if (totalSeparated > availableTons) {
      setError(`Cannot separate more than the vehicle's dropped stock (${availableTons} T).`);
      return;
    }

    separateGlass(selectedCollection.id, white, mixed, "s4");

    try {
      await separateGlassStock({
        collection_id: selectedCollection.id,
        tons_separated: totalSeparated,
        white_tons: white,
        mixed_tons: mixed
      });
      toast.success("Glass segregation recorded successfully!");
    } catch (err) {
      console.warn("Backend separation error:", err);
    }

    setWhiteTons("");
    setMixedTons("");
    setSelectedCollectionId(null);
  };

  return (
    <div className="flex min-h-screen bg-[#FDFBF7]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 lg:p-10 pt-20 md:pt-8 pb-24 md:pb-12 transition-all">
        {/* Standardized Frosted Page Header */}
        <PageHeader
          title="Godown Cullet Segregation"
          subtitle="Segregate unwashed collected glass into high-value Flint (White) and Amber/Mixed cullet piles"
          badgeText="Workstation Active"
          actionSlot={
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLatestDrops}
              disabled={loading}
              icon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : "text-slate-500"}`} />}
            >
              Refresh Drops
            </Button>
          }
        />

        {/* Top KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <StatCard
            label="Pending Segregation"
            value={`${totalPendingTons.toFixed(1)} T`}
            subtext={`${pendingCollections.length} vehicle loads waiting`}
            icon={<Scale className="w-6 h-6" />}
            color="amber"
            category="In Yard Queue"
          />
          <StatCard
            label="Flint (White) Stock"
            value={`${currentWhite.toFixed(1)} T`}
            subtext="Ready for furnace recycling"
            icon={<Sparkles className="w-6 h-6" />}
            color="blue"
            category="Sorted Inventory"
          />
          <StatCard
            label="Mixed / Amber Stock"
            value={`${currentMixed.toFixed(1)} T`}
            subtext="Ready for industrial vendor"
            icon={<Layers className="w-6 h-6" />}
            color="purple"
            category="Sorted Inventory"
          />
          <StatCard
            label="Total Yard Cullet"
            value={`${(currentWhite + currentMixed).toFixed(1)} T`}
            subtext="Consolidated sellable scrap"
            icon={<Factory className="w-6 h-6" />}
            color="emerald"
            category="Total Asset"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Pending Loads & Processing Workstation (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-panel p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Godown Yard Gate-In
                  </span>
                  <h2 className="text-lg font-black text-slate-800">Vehicle Drops Pending Sorting</h2>
                </div>
                <span className="bg-amber-50 text-amber-800 border border-amber-200/80 text-xs px-2.5 py-1 rounded-lg font-black">
                  {pendingCollections.length} In Queue
                </span>
              </div>

              {pendingCollections.length === 0 ? (
                <div className="bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl p-8 text-center">
                  <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 font-bold text-sm">All yard dropped loads have been segregated!</p>
                  <p className="text-slate-400 text-xs mt-1 font-medium">New collections dropped by drivers will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {pendingCollections.map(c => {
                    const isSelected = selectedCollectionId === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCollectionId(c.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${isSelected
                            ? "bg-white border-primary shadow-sm ring-2 ring-primary/20"
                            : "bg-white/80 border-slate-100 hover:border-slate-200 hover:bg-white"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${isSelected ? "bg-primary text-white" : "bg-slate-100 text-slate-600"
                              }`}
                          >
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-black text-sm text-slate-800">{c.vehicle || "Vehicle Intake"}</p>
                            <p className="text-xs text-slate-400 font-medium">Driver: {c.driverName || "Driver"}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-slate-800 block">
                            {c.tonsCollected} Tons
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(c.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedCollection && (
              <div className="glass-panel p-6 shadow-sm border-primary/40 animate-fade-in">
                <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md inline-block mb-1">
                      Active Segregation Workstation
                    </span>
                    <h3 className="text-xl font-black text-slate-800">
                      Processing Drop: {selectedCollection.vehicle}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Target Quantity
                    </span>
                    <span className="text-2xl font-black text-amber-600">
                      {selectedCollection.tonsCollected} T
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSeparate} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2 block">
                        Flint / White Cullet (Tons)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={whiteTons}
                        onChange={e => setWhiteTons(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none text-slate-800 font-black text-lg focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xs"
                        placeholder="e.g. 2.4"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2 block">
                        Mixed / Amber Cullet (Tons)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={mixedTons}
                        onChange={e => setMixedTons(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none text-slate-800 font-black text-lg focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xs"
                        placeholder="e.g. 3.1"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold">Total Segregated Output:</span>
                    <span
                      className={`text-base font-black ${(parseFloat(whiteTons) || 0) + (parseFloat(mixedTons) || 0) > selectedCollection.tonsCollected
                          ? "text-rose-600"
                          : "text-slate-800"
                        }`}
                    >
                      {((parseFloat(whiteTons) || 0) + (parseFloat(mixedTons) || 0)).toFixed(1)} / {selectedCollection.tonsCollected} Tons
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    fullWidth
                    className="py-3.5 text-sm font-black shadow-md"
                    icon={<ArrowDownToLine className="w-4 h-4" />}
                  >
                    Confirm Separation & Move to Stock
                  </Button>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Total Stock Capacity Meters (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 shadow-sm">
              <div className="mb-6">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Godown Warehouse Bays
                </span>
                <h2 className="text-xl font-black text-slate-800">Current Sorted Cullet Stock</h2>
                <p className="text-xs font-medium text-slate-400 mt-1">Ready for scrap vendor pickup and industrial recycling</p>
              </div>

              <div className="space-y-5">
                {/* White Glass Meter */}
                <div className="p-5 bg-white/90 rounded-2xl border border-slate-200/70 shadow-xs">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md inline-block mb-1">
                        Flint Grade A
                      </span>
                      <h3 className="font-black text-base text-slate-800">White Cullet Silo</h3>
                    </div>
                    <span className="text-2xl font-black text-sky-600">{currentWhite.toFixed(1)} T</span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(100, (currentWhite / 50) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1.5">
                    <span>Bay Capacity: 50 Tons</span>
                    <span>{((currentWhite / 50) * 100).toFixed(0)}% Utilized</span>
                  </div>
                </div>

                {/* Mixed Glass Meter */}
                <div className="p-5 bg-white/90 rounded-2xl border border-slate-200/70 shadow-xs">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md inline-block mb-1">
                        Commercial Grade B
                      </span>
                      <h3 className="font-black text-base text-slate-800">Mixed & Amber Cullet Silo</h3>
                    </div>
                    <span className="text-2xl font-black text-purple-600">{currentMixed.toFixed(1)} T</span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-400 to-indigo-600 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(100, (currentMixed / 50) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1.5">
                    <span>Bay Capacity: 50 Tons</span>
                    <span>{((currentMixed / 50) * 100).toFixed(0)}% Utilized</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
