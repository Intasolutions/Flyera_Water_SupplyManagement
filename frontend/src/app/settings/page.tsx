"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Save, Building2, Wallet, Package } from "lucide-react";
import { getInventoryTypes, updateInventoryType, InventoryType } from "@/lib/api";
import { toast } from "react-hot-toast";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("business");
  const [loading, setLoading] = useState(false);
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);

  useEffect(() => {
    getInventoryTypes().then(setInventoryTypes).catch(console.error);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (activeTab === "billing") {
        await Promise.all(
          inventoryTypes.map(inv => updateInventoryType(inv.id, { 
            name: inv.name,
            price: inv.price, 
            wholesale_price: inv.wholesale_price, 
            premium_price: inv.premium_price 
          }))
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8 transition-all relative">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-text mb-1">Settings</h1>
          <p className="text-text-muted">Manage your business preferences and configuration.</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Settings Navigation */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex lg:flex-col p-2 gap-1 overflow-x-auto">
              {[
                { id: "business", label: "Business Details", icon: Building2 },
                { id: "billing", label: "Billing & Pricing", icon: Wallet },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-text-muted hover:bg-gray-50 hover:text-text font-medium"
                  }`}
                >
                  <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? "text-primary" : "text-text-muted"}`} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings Content */}
          <div className="flex-1 max-w-3xl">
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 md:p-8">
              {activeTab === "business" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="mb-6 border-b border-gray-100 pb-6">
                    <h2 className="text-xl font-bold text-text mb-2">Business Information</h2>
                    <p className="text-text-muted text-sm">Update your company details and contact information.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-text mb-1.5">Business Name</label>
                      <input type="text" defaultValue="AquaFlow Delivery" className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-text bg-gray-50/50" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-text mb-1.5">Registration Number</label>
                      <input type="text" defaultValue="GSTIN-09AAACH7409R1ZZ" className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-text bg-gray-50/50" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-text mb-1.5">Contact Email</label>
                      <input type="email" defaultValue="contact@aquaflow.demo" className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-text bg-gray-50/50" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-text mb-1.5">Support Phone</label>
                      <input type="text" defaultValue="+91 98765 43210" className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-text bg-gray-50/50" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-text mb-1.5">Operating Address</label>
                      <textarea defaultValue="123 Industrial Area, Phase 2, Sector 82, City, State 123456" rows={3} className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-text bg-gray-50/50 resize-none"></textarea>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "billing" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="mb-6 border-b border-gray-100 pb-6">
                    <h2 className="text-xl font-bold text-text mb-2">Billing & Pricing</h2>
                    <p className="text-text-muted text-sm">Manage default pricing rules and tax configurations.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <h4 className="font-bold text-text">Enable Tax Computation</h4>
                        <p className="text-sm text-text-muted">Automatically calculate GST on delivery invoices.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <h4 className="font-bold text-text">Loyalty Point Conversion</h4>
                        <p className="text-sm text-text-muted">1 Point equals how much discount? (₹)</p>
                      </div>
                      <input type="number" defaultValue="0.5" className="w-24 text-center border border-gray-200 rounded-xl p-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-text" />
                    </div>

                    <div className="mt-8">
                      <h3 className="font-bold text-lg text-text mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" /> Inventory Product Pricing
                      </h3>
                      <div className="space-y-4">
                        {inventoryTypes.map((inv, idx) => (
                          <div key={inv.id} className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                            <h4 className="font-bold text-text mb-4">{inv.name}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-text-muted mb-1 uppercase tracking-wider">Standard Price (₹)</label>
                                <input 
                                  type="number" 
                                  value={inv.price} 
                                  onChange={(e) => {
                                    const newArr = [...inventoryTypes];
                                    newArr[idx].price = Number(e.target.value);
                                    setInventoryTypes(newArr);
                                  }}
                                  className="w-full border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-text" 
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-text-muted mb-1 uppercase tracking-wider">Wholesale Price (₹)</label>
                                <input 
                                  type="number" 
                                  value={inv.wholesale_price} 
                                  onChange={(e) => {
                                    const newArr = [...inventoryTypes];
                                    newArr[idx].wholesale_price = Number(e.target.value);
                                    setInventoryTypes(newArr);
                                  }}
                                  className="w-full border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-text" 
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-text-muted mb-1 uppercase tracking-wider">Premium Price (₹)</label>
                                <input 
                                  type="number" 
                                  value={inv.premium_price} 
                                  onChange={(e) => {
                                    const newArr = [...inventoryTypes];
                                    newArr[idx].premium_price = Number(e.target.value);
                                    setInventoryTypes(newArr);
                                  }}
                                  className="w-full border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-text" 
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

              {/* End tabs content */}

              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3">
                <button className="px-6 py-2.5 bg-gray-100 font-bold rounded-xl text-text hover:bg-gray-200 transition-colors">Discard</button>
                <button 
                  onClick={handleSave} 
                  disabled={loading}
                  className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-blue-700 shadow-sm shadow-primary/40 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {loading ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
