"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { 
  Save, 
  Building2, 
  Wallet, 
  Package, 
  ShieldCheck, 
  Percent, 
  Receipt,
  Sparkles
} from "lucide-react";
import { getInventoryTypes, updateInventoryType, InventoryType } from "@/lib/api";
import { toast } from "react-hot-toast";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"business" | "billing">("business");
  const [loading, setLoading] = useState(false);
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);

  useEffect(() => {
    getInventoryTypes().then(types => setInventoryTypes(types || [])).catch(console.error);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (activeTab === "billing") {
        await Promise.all(
          inventoryTypes.map(inv =>
            updateInventoryType(inv.id, {
              name: inv.name,
              price: inv.price,
              wholesale_price: inv.wholesale_price,
              premium_price: inv.premium_price
            })
          )
        );
      }
      setTimeout(() => {
        setLoading(false);
        toast.success("Settings saved successfully!");
      }, 500);
    } catch (err) {
      console.error(err);
      setLoading(false);
      toast.error("Failed to save settings.");
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FDFBF7]">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-72 p-4 sm:p-6 md:p-10 lg:p-12 pt-20 md:pt-10 pb-24 md:pb-12 transition-all relative">
        {/* Page Header */}
        <PageHeader
          title="System Settings"
          subtitle="Configure company credentials, pricing structure & default operational parameters"
          badgeText="System Configuration"
          actionSlot={
            <Button
              onClick={handleSave}
              disabled={loading}
              icon={<Save className="w-4 h-4" />}
            >
              {loading ? "Saving Changes..." : "Save Changes"}
            </Button>
          }
        />

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Frosted Segmented Navigation */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="glass-panel p-2 flex lg:flex-col gap-1.5 overflow-x-auto shadow-sm">
              {[
                { id: "business", label: "Business Profile", icon: Building2, desc: "Organization & Contact" },
                { id: "billing", label: "Pricing & Billing", icon: Wallet, desc: "Tier rates & GST taxes" },
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-200 text-left whitespace-nowrap lg:whitespace-normal ${
                      isActive
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                        : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-black text-xs block">{tab.label}</span>
                      <span className="text-[10px] text-slate-400 font-semibold block hidden lg:block">
                        {tab.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Settings Content Area */}
          <div className="flex-1 max-w-3xl">
            <div className="glass-panel p-6 md:p-8 shadow-sm">
              {activeTab === "business" && (
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-slate-100 pb-5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                      Organization Master
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">Company Information</h2>
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
                      Information displayed on customer digital delivery notes and invoices
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        Company / Entity Name
                      </label>
                      <input
                        type="text"
                        defaultValue="Flyera - Water & Glass Logistics"
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        GSTIN / Registration Number
                      </label>
                      <input
                        type="text"
                        defaultValue="GSTIN-27AAACH7409R1ZZ"
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        Official Support Email
                      </label>
                      <input
                        type="email"
                        defaultValue="operations@flyera.demo"
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        Dispatch Hotline
                      </label>
                      <input
                        type="text"
                        defaultValue="+91 98765 43210"
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm shadow-xs"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        Central Godown & Bottling Depot Address
                      </label>
                      <textarea
                        defaultValue="Plot 42, Hinjewadi Industrial Zone Phase 2, Pune, Maharashtra 411057"
                        rows={3}
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm shadow-xs resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "billing" && (
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-slate-100 pb-5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                      Tariff & Pricing Engine
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">Pricing Tiers & Tax Rules</h2>
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
                      Configure standard retail, wholesale, and premium client rates
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
                      <div>
                        <h4 className="font-black text-slate-800 text-sm sm:text-base">Automated GST Invoicing</h4>
                        <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-0.5">
                          Calculate statutory 18% GST on all commercial business invoices
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
                      <div>
                        <h4 className="font-black text-slate-800 text-sm sm:text-base">Loyalty Points Redemption Value</h4>
                        <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-0.5">Cash discount value per loyalty point</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-black text-sm">₹</span>
                        <input
                          type="number"
                          defaultValue="0.50"
                          step="0.05"
                          className="w-20 text-center border border-slate-200 rounded-xl p-2 font-black text-slate-800 text-sm outline-none focus:border-primary shadow-xs"
                        />
                      </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                          <Package className="w-5 h-5 text-primary" /> Product Price Matrix
                        </h3>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                          Applied at delivery
                        </span>
                      </div>

                      <div className="space-y-4">
                        {inventoryTypes.map((inv, idx) => (
                          <div
                            key={inv.id}
                            className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3"
                          >
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                              <span className="font-black text-slate-800 text-sm sm:text-base">{inv.name}</span>
                              <span className="text-xs font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                                SKU #{idx + 1}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                                  Standard Price (₹)
                                </label>
                                <input
                                  type="number"
                                  value={inv.price}
                                  onChange={e => {
                                    const copy = [...inventoryTypes];
                                    copy[idx].price = Number(e.target.value);
                                    setInventoryTypes(copy);
                                  }}
                                  className="w-full border border-slate-200 rounded-xl p-2.5 font-black text-slate-800 text-sm outline-none focus:border-primary shadow-xs"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                                  Wholesale Price (₹)
                                </label>
                                <input
                                  type="number"
                                  value={inv.wholesale_price}
                                  onChange={e => {
                                    const copy = [...inventoryTypes];
                                    copy[idx].wholesale_price = Number(e.target.value);
                                    setInventoryTypes(copy);
                                  }}
                                  className="w-full border border-slate-200 rounded-xl p-2.5 font-black text-slate-800 text-sm outline-none focus:border-primary shadow-xs"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                                  Premium Price (₹)
                                </label>
                                <input
                                  type="number"
                                  value={inv.premium_price}
                                  onChange={e => {
                                    const copy = [...inventoryTypes];
                                    copy[idx].premium_price = Number(e.target.value);
                                    setInventoryTypes(copy);
                                  }}
                                  className="w-full border border-slate-200 rounded-xl p-2.5 font-black text-slate-800 text-sm outline-none focus:border-primary shadow-xs"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Actions */}
              <div className="mt-8 pt-5 border-t border-slate-100 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Discard Changes
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={loading}
                  icon={<Save className="w-4 h-4" />}
                >
                  {loading ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
