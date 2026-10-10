"use client";

import { useState } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { useStore } from "@/lib/StoreContext";
import { Factory, ArrowDownToLine, Info, Truck } from "lucide-react";

export default function GlassGodownPage() {
  const { glassInventory, glassCollections, separateGlass } = useStore();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [whiteTons, setWhiteTons] = useState("");
  const [mixedTons, setMixedTons] = useState("");
  const [error, setError] = useState("");

  const pendingCollections = glassCollections.filter(c => c.status === "dropped_at_godown");
  const selectedCollection = pendingCollections.find(c => c.id === selectedCollectionId);

  const currentWhite = glassInventory.find(i => i.type === "white")?.tons || 0;
  const currentMixed = glassInventory.find(i => i.type === "mixed")?.tons || 0;

  const handleSeparate = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!selectedCollection) {
      setError("Please select a collection to process.");
      return;
    }

    const white = parseFloat(whiteTons) || 0;
    const mixed = parseFloat(mixedTons) || 0;
    const totalSeparated = white + mixed;

    if (totalSeparated <= 0) {
      setError("Please enter valid tons.");
      return;
    }

    // Usually we'd enforce exact conversion, but let's just make sure it's not wildly over
    if (totalSeparated > selectedCollection.tonsCollected) {
      setError(`Cannot separate more than the vehicle's dropped stock (${selectedCollection.tonsCollected} T).`);
      return;
    }

    separateGlass(selectedCollection.id, white, mixed, "s4");
    setWhiteTons("");
    setMixedTons("");
    setSelectedCollectionId(null);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8 transition-all">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-text mb-1">Godown Separation</h1>
          <p className="text-text-muted">Select a vehicle drop and separate into white and mixed glass.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Pending Collections & Processing Form */}
          <div className="space-y-6">
            
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-xl font-bold text-text mb-4">Pending Vehicle Drops</h2>
              
              {pendingCollections.length === 0 ? (
                <p className="text-text-muted text-sm py-4">No collections waiting to be separated.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {pendingCollections.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => setSelectedCollectionId(c.id)}
                      className={`p-4 rounded-xl border shadow-sm cursor-pointer transition-all ${
                        selectedCollectionId === c.id 
                          ? "bg-primary/5 border-primary" 
                          : "bg-surface border-black/5 hover:border-black/20"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${selectedCollectionId === c.id ? 'bg-primary text-white' : 'bg-black/5 text-text-muted'}`}>
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-text">{c.vehicle || "Unknown Vehicle"}</p>
                            <p className="text-xs text-text-muted">Driver: {c.driverName || "Unknown Driver"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-text">{c.tonsCollected} T</p>
                          <p className="text-xs text-text-muted">{new Date(c.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedCollection && (
              <div className="glass-panel rounded-2xl p-6 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-text flex items-center gap-2">
                    <Factory className="w-5 h-5 text-primary" />
                    Process Selected Drop
                  </h2>
                  <div className="text-right">
                    <p className="text-xs text-text-muted font-medium">To Process</p>
                    <p className="text-lg font-bold text-amber-500">{selectedCollection.tonsCollected} T</p>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-600 text-sm">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <form onSubmit={handleSeparate} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-text-muted mb-1 block">White Glass Extracted (Tons)</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={whiteTons}
                      onChange={e => setWhiteTons(e.target.value)}
                      className="w-full bg-white border border-black/10 rounded-lg px-4 py-2 outline-none text-text focus:border-primary shadow-sm"
                      placeholder="e.g. 2.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-text-muted mb-1 block">Mixed Glass Extracted (Tons)</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={mixedTons}
                      onChange={e => setMixedTons(e.target.value)}
                      className="w-full bg-white border border-black/10 rounded-lg px-4 py-2 outline-none text-text focus:border-primary shadow-sm"
                      placeholder="e.g. 4.0"
                    />
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between text-sm font-medium mb-4 p-3 bg-surface rounded-lg border border-black/5">
                      <span className="text-text-muted">Total Processed:</span>
                      <span className={`font-bold ${((parseFloat(whiteTons) || 0) + (parseFloat(mixedTons) || 0)) > selectedCollection.tonsCollected ? 'text-red-500' : 'text-text'}`}>
                        {((parseFloat(whiteTons) || 0) + (parseFloat(mixedTons) || 0)).toFixed(1)} / {selectedCollection.tonsCollected} T
                      </span>
                    </div>
                    
                    <button 
                      type="submit"
                      className="w-full py-2.5 bg-primary hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(37,99,235,0.39)]"
                    >
                      <ArrowDownToLine className="w-5 h-5" />
                      Separate Stock
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Current Separated Inventory */}
          <div className="glass-panel rounded-2xl p-6 h-fit sticky top-24">
            <h2 className="text-xl font-bold text-text mb-6">Total Godown Stock</h2>
            
            <div className="space-y-4">
              <div className="p-5 bg-surface rounded-xl border border-black/5 shadow-sm">
                <h3 className="text-sm font-medium text-text-muted mb-1">White Glass</h3>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-bold text-text">{currentWhite.toFixed(1)} <span className="text-xl text-text-muted">T</span></p>
                  <span className="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded">Ready for Vendor</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (currentWhite/50)*100)}%` }}></div>
                </div>
              </div>

              <div className="p-5 bg-surface rounded-xl border border-black/5 shadow-sm">
                <h3 className="text-sm font-medium text-text-muted mb-1">Mixed Glass</h3>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-bold text-text">{currentMixed.toFixed(1)} <span className="text-xl text-text-muted">T</span></p>
                  <span className="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded">Ready for Vendor</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, (currentMixed/50)*100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
