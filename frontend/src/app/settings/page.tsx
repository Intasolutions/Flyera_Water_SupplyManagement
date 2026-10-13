"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/StoreContext";
import { 
  Save, 
  Building2, 
  Wallet, 
  Package, 
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { 
  getInventoryTypes, 
  updateInventoryType, 
  InventoryType, 
  getSettings, 
  updateSettings 
} from "@/lib/api";
import { toast } from "react-hot-toast";

const DEFAULT_SETTINGS = {
  company_name: "",
  gstin: "",
  support_email: "",
  dispatch_hotline: "",
  central_address: "",
  gst_enabled: true,
  loyalty_rate: 0.50,
  upi_id: ""
};

export default function SettingsPage() {
  const router = useRouter();
  const { currentUserRole } = useStore();
  const [activeTab, setActiveTab] = useState<"business" | "billing" | "system">("business");
  const [loading, setLoading] = useState(false);
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);

  // Guard: Restrict settings and UPI configuration to Admin only
  useEffect(() => {
    if (currentUserRole && currentUserRole !== "Owner") {
      toast.error("Settings and UPI configuration are restricted to Administrators only.");
      router.replace("/");
    }
  }, [currentUserRole, router]);

  // Business Profile States
  const [companyName, setCompanyName] = useState(DEFAULT_SETTINGS.company_name);
  const [gstin, setGstin] = useState(DEFAULT_SETTINGS.gstin);
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SETTINGS.support_email);
  const [dispatchHotline, setDispatchHotline] = useState(DEFAULT_SETTINGS.dispatch_hotline);
  const [centralAddress, setCentralAddress] = useState(DEFAULT_SETTINGS.central_address);
  const [upiId, setUpiId] = useState(DEFAULT_SETTINGS.upi_id);

  // Billing States
  const [gstEnabled, setGstEnabled] = useState(DEFAULT_SETTINGS.gst_enabled);
  const [loyaltyRate, setLoyaltyRate] = useState(DEFAULT_SETTINGS.loyalty_rate);

  // Load Settings on Mount
  useEffect(() => {
    // 1. Try local storage cache for immediate display
    try {
      const cached = localStorage.getItem("flyera_system_settings");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.company_name) setCompanyName(parsed.company_name);
        if (parsed.gstin) setGstin(parsed.gstin);
        if (parsed.support_email) setSupportEmail(parsed.support_email);
        if (parsed.dispatch_hotline) setDispatchHotline(parsed.dispatch_hotline);
        if (parsed.central_address) setCentralAddress(parsed.central_address);
        if (parsed.upi_id) setUpiId(parsed.upi_id);
        if (parsed.gst_enabled !== undefined) setGstEnabled(parsed.gst_enabled === true || parsed.gst_enabled === "true");
        if (parsed.loyalty_rate !== undefined) setLoyaltyRate(Number(parsed.loyalty_rate));
      }
    } catch (e) {}

    // 2. Fetch from backend
    getSettings()
      .then(res => {
        if (res) {
          if (res.company_name) setCompanyName(res.company_name);
          if (res.gstin) setGstin(res.gstin);
          if (res.support_email) setSupportEmail(res.support_email);
          if (res.dispatch_hotline) setDispatchHotline(res.dispatch_hotline);
          if (res.central_address) setCentralAddress(res.central_address);
          if (res.upi_id) setUpiId(res.upi_id);
          if (res.gst_enabled !== undefined) setGstEnabled(res.gst_enabled === true || res.gst_enabled === "true");
          if (res.loyalty_rate !== undefined) setLoyaltyRate(Number(res.loyalty_rate));
          try {
            localStorage.setItem("flyera_system_settings", JSON.stringify(res));
          } catch (e) {}
        }
      })
      .catch(console.warn);

    // 3. Load product tiers
    getInventoryTypes()
      .then(types => setInventoryTypes(types || []))
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const settingsPayload = {
        company_name: companyName,
        gstin: gstin,
        support_email: supportEmail,
        dispatch_hotline: dispatchHotline,
        central_address: centralAddress,
        upi_id: upiId,
        gst_enabled: String(gstEnabled),
        loyalty_rate: String(loyaltyRate)
      };

      // Save to localStorage immediately
      try {
        localStorage.setItem("flyera_system_settings", JSON.stringify(settingsPayload));
      } catch (e) {}

      // Persist to backend settings API
      const settingsPromise = updateSettings(settingsPayload).catch(err => {
        console.warn("Backend settings sync warning:", err);
      });

      // Persist product pricing matrix
      const inventoryPromise = Promise.all(
        inventoryTypes.map(inv =>
          updateInventoryType(inv.id, {
            name: inv.name,
            price: Number(inv.price),
            wholesale_price: Number(inv.wholesale_price),
            premium_price: Number(inv.premium_price)
          }).catch(err => console.warn(`Failed updating product ${inv.name}:`, err))
        )
      );

      await Promise.all([settingsPromise, inventoryPromise]);

      toast.success("Settings saved successfully!");
    } catch (err) {
      console.error("Save settings error:", err);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    try {
      const cached = localStorage.getItem("flyera_system_settings");
      if (cached) {
        const parsed = JSON.parse(cached);
        setCompanyName(parsed.company_name || DEFAULT_SETTINGS.company_name);
        setGstin(parsed.gstin || DEFAULT_SETTINGS.gstin);
        setSupportEmail(parsed.support_email || DEFAULT_SETTINGS.support_email);
        setDispatchHotline(parsed.dispatch_hotline || DEFAULT_SETTINGS.dispatch_hotline);
        setCentralAddress(parsed.central_address || DEFAULT_SETTINGS.central_address);
        setUpiId(parsed.upi_id || DEFAULT_SETTINGS.upi_id);
        setGstEnabled(parsed.gst_enabled === true || parsed.gst_enabled === "true");
        setLoyaltyRate(Number(parsed.loyalty_rate) || DEFAULT_SETTINGS.loyalty_rate);
        toast("Changes discarded", { icon: "↩️" });
        return;
      }
    } catch (e) {}
    window.location.reload();
  };

  if (currentUserRole !== "Owner") {
    return (
      <div className="flex min-h-screen bg-[#FDFBF7]">
        <Sidebar />
        <main className="flex-1 ml-0 md:ml-72 p-6 md:p-12 flex flex-col items-center justify-center text-center">
          <div className="max-w-md p-8 bg-white/90 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-1.5">Access Restricted</h2>
            <p className="text-xs font-semibold text-slate-500 mb-6">
              System Settings and UPI configuration are restricted to Administrators only.
            </p>
            <Button onClick={() => router.push("/")} variant="primary">
              Return to Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

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
                { id: "system", label: "Production Reset", icon: AlertTriangle, desc: "Factory wipe & superuser" },
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
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        placeholder="e.g. Flyera - Water & Glass Logistics"
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        GSTIN / Registration Number
                      </label>
                      <input
                        type="text"
                        value={gstin}
                        onChange={e => setGstin(e.target.value)}
                        placeholder="e.g. GSTIN-27AAACH7409R1ZZ"
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        Official Support Email
                      </label>
                      <input
                        type="email"
                        value={supportEmail}
                        onChange={e => setSupportEmail(e.target.value)}
                        placeholder="operations@flyera.demo"
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        Dispatch Hotline
                      </label>
                      <input
                        type="text"
                        value={dispatchHotline}
                        onChange={e => setDispatchHotline(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        Merchant UPI ID (VPA for QR Payments)
                      </label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={e => setUpiId(e.target.value)}
                        placeholder="e.g. flyera@okhdfcbank"
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm shadow-xs"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        Central Godown & Bottling Depot Address
                      </label>
                      <textarea
                        value={centralAddress}
                        onChange={e => setCentralAddress(e.target.value)}
                        placeholder="Plot 42, Hinjewadi Industrial Zone Phase 2, Pune, Maharashtra 411057"
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
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={gstEnabled}
                          onChange={e => setGstEnabled(e.target.checked)}
                        />
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
                          value={loyaltyRate}
                          step="0.05"
                          onChange={e => setLoyaltyRate(parseFloat(e.target.value) || 0)}
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

              {activeTab === "system" && (
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-rose-100 pb-5">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-600 block mb-1">
                      Danger Zone
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">System Maintenance & Factory Reset</h2>
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
                      Wipe testing records and initialize a fresh production database with a new superuser
                    </p>
                  </div>

                  <div className="p-6 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-rose-950">Clean Production Setup Console</h3>
                        <p className="text-xs text-rose-800 font-semibold mt-1 leading-relaxed">
                          This specialized console clears all existing mock clients, deliveries, allocations, glass records, and staff logins. It then configures your primary Superuser account with your chosen username and secure password for live deployment.
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-rose-200/60 flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="danger"
                        onClick={() => router.push("/setup")}
                        icon={<ArrowRight className="w-4 h-4" />}
                      >
                        Open Production Setup & Superuser Console
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Actions */}
              {activeTab !== "system" && (
                <div className="mt-8 pt-5 border-t border-slate-100 flex justify-end gap-3">
                  <Button variant="secondary" onClick={handleDiscard}>
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
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
