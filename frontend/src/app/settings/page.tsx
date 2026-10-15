"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useStore } from "@/lib/StoreContext";
import { 
  Save, 
  Building2, 
  Wallet, 
  Package, 
  CheckCircle2, 
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  Check,
  Lock,
  KeyRound
} from "lucide-react";
import { 
  getInventoryTypes, 
  updateInventoryType, 
  InventoryType, 
  getSettings, 
  updateSettings,
  updateSecureUpi 
} from "@/lib/api";
import { sanitizePhone } from "@/lib/validation";
import { toast } from "react-hot-toast";

const DEFAULT_SETTINGS = {
  company_name: "",
  support_email: "",
  dispatch_hotline: "",
  central_address: "",
  loyalty_rate: 0.50,
  upi_id: ""
};

const UPI_VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z]{2,64}$/;

export default function SettingsPage() {
  const router = useRouter();
  const { currentUserRole } = useStore();
  const [activeTab, setActiveTab] = useState<"business" | "billing">("business");
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
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SETTINGS.support_email);
  const [dispatchHotline, setDispatchHotline] = useState(DEFAULT_SETTINGS.dispatch_hotline);
  const [centralAddress, setCentralAddress] = useState(DEFAULT_SETTINGS.central_address);
  const [upiId, setUpiId] = useState(DEFAULT_SETTINGS.upi_id);
  const [initialUpiId, setInitialUpiId] = useState(DEFAULT_SETTINGS.upi_id);
  const [upiVerified, setUpiVerified] = useState<boolean>(true);
  const [upiSecurityAlert, setUpiSecurityAlert] = useState<string | null>(null);

  // Sudo Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  // Billing States
  const [loyaltyRate, setLoyaltyRate] = useState(DEFAULT_SETTINGS.loyalty_rate);

  // Load Settings on Mount
  useEffect(() => {
    // 1. Try local storage cache for immediate display
    try {
      const cached = localStorage.getItem("flyera_system_settings");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.company_name) setCompanyName(parsed.company_name);
        if (parsed.support_email) setSupportEmail(parsed.support_email);
        if (parsed.dispatch_hotline) setDispatchHotline(parsed.dispatch_hotline);
        if (parsed.central_address) setCentralAddress(parsed.central_address);
        if (parsed.upi_id) {
          setUpiId(parsed.upi_id);
          setInitialUpiId(parsed.upi_id);
        }
        if (parsed.loyalty_rate !== undefined) setLoyaltyRate(Number(parsed.loyalty_rate));
      }
    } catch (e) {}

    // 2. Fetch from backend with HMAC verification
    getSettings()
      .then(res => {
        if (res) {
          if (res.company_name) setCompanyName(res.company_name);
          if (res.support_email) setSupportEmail(res.support_email);
          if (res.dispatch_hotline) setDispatchHotline(res.dispatch_hotline);
          if (res.central_address) setCentralAddress(res.central_address);
          if (res.upi_id) {
            setUpiId(res.upi_id);
            setInitialUpiId(res.upi_id);
          }
          if (res.upi_verified !== undefined) setUpiVerified(res.upi_verified);
          if (res.upi_security_alert) setUpiSecurityAlert(res.upi_security_alert);
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

  const handleInitiateSave = () => {
    const cleanHotline = sanitizePhone(dispatchHotline);
    if (dispatchHotline.trim() && cleanHotline.length !== 10) {
      toast.error("Dispatch hotline must be a valid 10-digit mobile number");
      return;
    }

    const cleanUpi = upiId.trim();
    if (cleanUpi && !UPI_VPA_REGEX.test(cleanUpi)) {
      toast.error("Invalid UPI ID format! Expected standard NPCI VPA (e.g. company@okhdfcbank)");
      return;
    }

    // If UPI ID was altered, require SuperAdmin password authorization
    if (cleanUpi !== initialUpiId.trim() && cleanUpi) {
      setAdminPassword("");
      setIsPasswordModalOpen(true);
      return;
    }

    executeSave();
  };

  const executeSave = async (overridePassword?: string) => {
    setLoading(true);
    const cleanHotline = sanitizePhone(dispatchHotline);

    try {
      const cleanUpi = upiId.trim();

      // If UPI ID changed, execute secure UPI update with HMAC sealing
      if (cleanUpi !== initialUpiId.trim() && cleanUpi && overridePassword) {
        await updateSecureUpi({
          upi_id: cleanUpi,
          admin_password: overridePassword
        });
        setInitialUpiId(cleanUpi);
        setUpiVerified(true);
        setUpiSecurityAlert(null);
      }

      const settingsPayload = {
        company_name: companyName,
        support_email: supportEmail,
        dispatch_hotline: cleanHotline || "",
        central_address: centralAddress,
        loyalty_rate: String(loyaltyRate)
      };

      // Save to localStorage immediately
      try {
        const existing = JSON.parse(localStorage.getItem("flyera_system_settings") || "{}");
        localStorage.setItem("flyera_system_settings", JSON.stringify({ ...existing, ...settingsPayload, upi_id: cleanUpi }));
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

      setIsPasswordModalOpen(false);
      toast.success("Settings & sealed credentials saved successfully!");
    } catch (err: any) {
      console.error("Save settings error:", err);
      toast.error(err.message || "Failed to save settings. Please verify password.");
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
        setSupportEmail(parsed.support_email || DEFAULT_SETTINGS.support_email);
        setDispatchHotline(parsed.dispatch_hotline || DEFAULT_SETTINGS.dispatch_hotline);
        setCentralAddress(parsed.central_address || DEFAULT_SETTINGS.central_address);
        setUpiId(parsed.upi_id || DEFAULT_SETTINGS.upi_id);
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
        <main className="flex-1 min-w-0 p-6 md:p-12 flex flex-col items-center justify-center text-center">
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

      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 lg:p-10 pt-20 md:pt-8 pb-24 md:pb-12 transition-all relative">
        {/* Page Header */}
        <PageHeader
          title="System Settings"
          subtitle="Configure company credentials, pricing structure & default operational parameters"
          badgeText="System Configuration"
          actionSlot={
            <Button
              onClick={handleInitiateSave}
              disabled={loading}
              icon={<Save className="w-4 h-4" />}
            >
              {loading ? "Saving Changes..." : "Save Changes"}
            </Button>
          }
        />

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Segmented Navigation */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="glass-panel p-2 flex lg:flex-col gap-1.5 overflow-x-auto shadow-sm">
              {[
                { id: "business", label: "Business Profile", icon: Building2, desc: "Organization & Contact" },
                { id: "billing", label: "Pricing & Billing", icon: Wallet, desc: "Tier rates & loyalty points" },
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-200 text-left whitespace-nowrap lg:whitespace-normal cursor-pointer ${
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
                      Information displayed on customer digital delivery notes and communications
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
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                          Dispatch Hotline
                        </label>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                          dispatchHotline.length === 10
                            ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                            : dispatchHotline.length > 0
                            ? "text-amber-700 bg-amber-50 border border-amber-200"
                            : "text-slate-400"
                        }`}>
                          {dispatchHotline.length}/10 digits
                        </span>
                      </div>
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 flex items-center gap-1.5 text-xs font-bold text-slate-500 select-none border-r border-slate-200 pr-2.5 z-10 pointer-events-none">
                          <span>+91</span>
                        </div>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={dispatchHotline}
                          onChange={e => setDispatchHotline(sanitizePhone(e.target.value))}
                          placeholder="98765 43210"
                          className={`w-full border rounded-xl pl-16 pr-10 py-3 bg-white text-slate-800 font-mono font-semibold outline-none transition-all text-sm shadow-xs ${
                            dispatchHotline.length > 0 && dispatchHotline.length < 10
                              ? "border-rose-400 ring-4 ring-rose-400/10 focus:border-rose-500"
                              : dispatchHotline.length === 10
                              ? "border-emerald-400 ring-4 ring-emerald-400/10 focus:border-emerald-500"
                              : "border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10"
                          }`}
                        />
                        {dispatchHotline.length === 10 && (
                          <div className="absolute right-3 text-emerald-500" title="Valid 10-digit number">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      {dispatchHotline.length > 0 && dispatchHotline.length < 10 ? (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          Must be exactly 10 digits ({dispatchHotline.length}/10 entered)
                        </p>
                      ) : dispatchHotline.length === 10 ? (
                        <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          Valid 10-digit hotline number
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          10-digit customer support & dispatch number
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                          Merchant UPI ID (VPA for QR Payments)
                        </label>
                        {upiVerified ? (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> HMAC-SHA256 Sealed
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1 animate-pulse">
                            <ShieldAlert className="w-3 h-3 text-rose-600" /> Tamper Mismatch!
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={upiId}
                          onChange={e => setUpiId(e.target.value)}
                          placeholder="e.g. flyera@okhdfcbank"
                          className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm shadow-xs"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        Receiving bank VPA. Altering requires SuperAdmin password authorization.
                      </p>
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
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">Pricing Tiers & Rates</h2>
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
                      Configure standard retail, wholesale, and premium client product rates
                    </p>
                  </div>

                  <div className="space-y-4">
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

              {/* Bottom Actions */}
              <div className="mt-8 pt-5 border-t border-slate-100 flex justify-end gap-3">
                <Button variant="secondary" onClick={handleDiscard}>
                  Discard Changes
                </Button>
                <Button
                  variant="primary"
                  onClick={handleInitiateSave}
                  disabled={loading}
                  icon={<Save className="w-4 h-4" />}
                >
                  {loading ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sudo Re-Authentication Modal for Changing Merchant UPI ID */}
        <Modal
          isOpen={isPasswordModalOpen}
          onClose={() => !loading && setIsPasswordModalOpen(false)}
          title="Security Re-Authentication Required"
        >
          <form onSubmit={(e) => { e.preventDefault(); executeSave(adminPassword); }} className="space-y-4">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
              <div className="flex items-center gap-2 font-bold mb-1 text-amber-950">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>SuperAdmin Authorization Check</span>
              </div>
              <p>
                You are updating the company&apos;s receiving UPI ID to: <strong className="font-mono text-slate-900 bg-white px-1.5 py-0.5 rounded border border-amber-300">{upiId}</strong>.
              </p>
              <p className="mt-1 text-[11px] text-amber-800">
                To prevent unauthorized bank account hijacking or malware tampering, please enter your SuperAdmin password to authorize this update.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                SuperAdmin Password *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="Enter your login password"
                  autoFocus
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setIsPasswordModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !adminPassword.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? "Sealing & Saving..." : "Authorize & Save"}
              </Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}
