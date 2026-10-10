"use client";

import { useState } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { useStore } from "@/lib/StoreContext";
import { Car, Info } from "lucide-react";

export default function GlassVendorPage() {
  const { glassInventory, glassVendorPickups, recordVendorPickup } = useStore();
  const [vendorName, setVendorName] = useState("");
  const [glassType, setGlassType] = useState<"white" | "mixed">("white");
  const [tons, setTons] = useState("");
  const [error, setError] = useState("");

  const currentWhite = glassInventory.find(i => i.type === "white")?.tons || 0;
  const currentMixed = glassInventory.find(i => i.type === "mixed")?.tons || 0;

  const handlePickup = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const t = parseFloat(tons);
    if (!vendorName || !t) return;

    if (glassType === "white" && t > currentWhite) {
      setError(`Cannot pickup more than available White Glass (${currentWhite} T)`);
      return;
    }
    if (glassType === "mixed" && t > currentMixed) {
      setError(`Cannot pickup more than available Mixed Glass (${currentMixed} T)`);
      return;
    }

    recordVendorPickup(glassType, t, vendorName);
    setVendorName("");
    setTons("");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8 transition-all">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-text mb-1">Vendor Pickups</h1>
          <p className="text-text-muted">Record material handed over to scrap collectors.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pickup Form */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-text mb-6 flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
              New Vendor Pickup
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-600 text-sm">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handlePickup} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Vendor Name</label>
                <input 
                  type="text"
                  required
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  className="w-full bg-surface border border-black/10 rounded-lg px-4 py-2 outline-none text-text focus:border-primary"
                  placeholder="e.g. ABC Glass Recyclers"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Material Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setGlassType("white")}
                    className={`py-2 rounded-lg border font-medium text-sm transition-all ${
                      glassType === "white" ? "bg-primary/10 border-primary text-primary" : "bg-white border-black/10 text-text-muted hover:border-black/20"
                    }`}
                  >
                    White Glass ({currentWhite.toFixed(1)} T)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlassType("mixed")}
                    className={`py-2 rounded-lg border font-medium text-sm transition-all ${
                      glassType === "mixed" ? "bg-primary/10 border-primary text-primary" : "bg-white border-black/10 text-text-muted hover:border-black/20"
                    }`}
                  >
                    Mixed Glass ({currentMixed.toFixed(1)} T)
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-text-muted mb-1 block">Tons Picked Up</label>
                <input 
                  type="number"
                  step="0.1"
                  required
                  value={tons}
                  onChange={e => setTons(e.target.value)}
                  className="w-full bg-surface border border-black/10 rounded-lg px-4 py-2 outline-none text-text focus:border-primary"
                  placeholder="e.g. 5.0"
                />
              </div>
              
              <button 
                type="submit"
                className="w-full py-2.5 bg-primary hover:bg-blue-700 text-white font-medium rounded-lg transition-colors mt-2"
              >
                Record Pickup
              </button>
            </form>
          </div>

          {/* History */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-text mb-6">Pickup History</h2>
            <div className="space-y-4">
              {glassVendorPickups.length === 0 && (
                <p className="text-text-muted text-sm py-4">No vendor pickups recorded yet.</p>
              )}
              {glassVendorPickups.map(pickup => (
                <div key={pickup.id} className="p-4 bg-surface rounded-xl border border-black/5 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-text">{pickup.vendorName}</p>
                    <p className="text-xs text-text-muted">{new Date(pickup.date).toLocaleDateString()} {new Date(pickup.date).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-text">{pickup.tons} T</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${
                      pickup.type === 'white' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {pickup.type} Glass
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
