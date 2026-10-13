"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Droplet, 
  Recycle, 
  ShieldAlert, 
  User, 
  Lock, 
  Phone, 
  Building2, 
  Wallet, 
  CheckCircle2, 
  ArrowRight, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Trash2,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getSetupStatus, resetAndCreateSuperuser, SetupStatus } from "@/lib/api";
import { toast } from "react-hot-toast";

export default function SetupPage() {
  const router = useRouter();

  // Status loading
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Form states
  const [masterKey, setMasterKey] = useState("FLYERA_PROD_RESET_2026");
  const [showMasterKey, setShowMasterKey] = useState(false);
  const [name, setName] = useState("Akash - Owner");
  const [username, setUsername] = useState("admin");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("Flyera - Water & Glass Logistics");
  const [dispatchHotline, setDispatchHotline] = useState("+91 98765 43210");
  const [upiId, setUpiId] = useState("akash78988-1@okaxis");
  const [confirmWipeText, setConfirmWipeText] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await getSetupStatus();
      setStatus(res);
    } catch (e: any) {
      console.warn("Status fetch failed:", e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleResetAndInitialize = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 4) {
      toast.error("Password must be at least 4 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match. Please verify.");
      return;
    }

    if (!username || username.trim().length < 3) {
      toast.error("Username must be at least 3 characters.");
      return;
    }

    if (!acknowledged) {
      toast.error("Please tick the confirmation checkbox to authorize database wipe.");
      return;
    }

    if (confirmWipeText.trim() !== "WIPE_ALL_DATA") {
      toast.error("Please type 'WIPE_ALL_DATA' in the confirmation box.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Clear client session tokens
      try {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("flyera_user");
        localStorage.removeItem("flyera_system_settings");
      } catch (err) {}

      const res = await resetAndCreateSuperuser({
        master_key: masterKey.trim(),
        confirm_wipe: "WIPE_ALL_DATA",
        name: name.trim(),
        username: username.trim(),
        password: password,
        phone: phone.trim() || undefined,
        company_name: companyName.trim() || undefined,
        dispatch_hotline: dispatchHotline.trim() || undefined,
        upi_id: upiId.trim() || undefined
      });

      setSuccessResult(res.user);
      toast.success("Database wiped clean and Superuser created successfully!");
    } catch (err: any) {
      console.error("Setup error:", err);
      toast.error(err.message || "Failed to reset database and initialize superuser.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-between p-4 sm:p-8 relative">
      {/* Background glowing ambient elements */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-100/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl w-full mx-auto relative z-10 py-6">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2 p-2 bg-white/90 backdrop-blur-md rounded-2xl shadow-xs border border-black/5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm shadow-primary/20">
              <Droplet className="w-4 h-4" />
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20">
              <Recycle className="w-4 h-4" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            FLYERA LOGISTICS
          </h1>
          <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider mt-1">
            Production Initialization &amp; Superuser Setup Tool
          </p>
        </div>

        {/* Success Screen Once Initialized */}
        {successResult ? (
          <div className="glass-panel p-6 sm:p-10 border-emerald-200 bg-white/95 text-center shadow-lg animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
              Production Database Initialized!
            </h2>
            <p className="text-slate-600 font-semibold text-sm sm:text-base max-w-md mx-auto mb-6">
              All demo clients, staff, routes, vehicles, and deliveries have been 100% wiped clean. Your clean production Superuser has been initialized.
            </p>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 max-w-md mx-auto text-left mb-8 space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Superuser Credentials Summary
              </span>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                <span>Account Name:</span>
                <span className="font-black text-slate-900">{successResult.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                <span>Login Username:</span>
                <span className="font-black text-primary text-sm">{successResult.username}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                <span>Assigned Role:</span>
                <span className="bg-purple-100 text-purple-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                  {successResult.role} (Superuser / Owner)
                </span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                <span>Phone:</span>
                <span className="font-bold text-slate-800">{successResult.phone || "Not set"}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Button
                variant="primary"
                fullWidth
                onClick={() => router.push("/login")}
                icon={<ArrowRight className="w-4 h-4" />}
                className="py-3 font-black shadow-md"
              >
                Go to Sign In &amp; Login
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Live Database Status Card */}
            <div className="glass-panel p-5 bg-white/90 border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Current Database State (Pre-Wipe Inspection)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={fetchStatus}
                  disabled={loadingStatus}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {loadingStatus ? (
                <p className="text-xs font-bold text-slate-400 py-2">Inspecting database tables...</p>
              ) : status ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Staff / Users</span>
                    <span className="text-base font-black text-slate-800 mt-0.5 block">
                      {status.total_users} Records
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Clients</span>
                    <span className="text-base font-black text-slate-800 mt-0.5 block">
                      {status.total_clients} Records
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Fleet Vehicles</span>
                    <span className="text-base font-black text-slate-800 mt-0.5 block">
                      {status.total_vehicles} Records
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Deliveries</span>
                    <span className="text-base font-black text-slate-800 mt-0.5 block">
                      {status.total_deliveries} Records
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-400">Database connected.</p>
              )}
            </div>

            {/* Caution Warning Banner */}
            <div className="bg-rose-50 border border-rose-200/90 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-rose-900 text-sm">
                  100% Production Factory Wipe Warning
                </h3>
                <p className="text-xs font-medium text-rose-800/90 mt-1 leading-relaxed">
                  Executing this form will completely wipe all test data (staff, clients, deliveries, vehicles, routes, glass entries). After this operation, <strong>only</strong> the Superuser configured below will be able to access the system.
                </p>
              </div>
            </div>

            {/* Setup Form */}
            <form onSubmit={handleResetAndInitialize} className="glass-panel p-6 sm:p-8 bg-white/95 border-slate-200 shadow-md space-y-6">
              {/* Section 1: Superuser Account */}
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-primary" />
                  <span>1. Production Superuser (Owner) Details</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Superuser Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Akash - Owner"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 text-xs sm:text-sm font-bold focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Login Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="e.g. admin or 9876543210"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 text-xs sm:text-sm font-bold focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Contact Phone (Optional)
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 text-xs sm:text-sm font-bold focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Master Authorization Key *
                    </label>
                    <div className="relative">
                      <input
                        type={showMasterKey ? "text" : "password"}
                        required
                        value={masterKey}
                        onChange={e => setMasterKey(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 text-xs sm:text-sm font-mono font-bold focus:border-primary focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMasterKey(!showMasterKey)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showMasterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      New Superuser Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 text-xs sm:text-sm font-bold focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Confirm Superuser Password *
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 text-xs sm:text-sm font-bold focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Production Business Profile */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>2. Production Company Settings</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Dispatch Hotline
                    </label>
                    <input
                      type="text"
                      value={dispatchHotline}
                      onChange={e => setDispatchHotline(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Default UPI ID (QR Slips)
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={e => setUpiId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Wipe Authorization */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h3 className="text-sm font-black text-rose-900 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>3. Authorization to Wipe All Existing Data</span>
                </h3>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={e => setAcknowledged(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 leading-snug">
                      I confirm that I want to wipe 100% of all data from the database. I understand that all test staff, test clients, routes, vehicles, and deliveries will be permanently erased.
                    </span>
                  </label>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Type <span className="font-mono text-rose-600 font-black">WIPE_ALL_DATA</span> below to unlock:
                    </label>
                    <input
                      type="text"
                      required
                      value={confirmWipeText}
                      onChange={e => setConfirmWipeText(e.target.value)}
                      placeholder="WIPE_ALL_DATA"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl outline-none text-slate-900 font-mono font-black text-xs sm:text-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isSubmitting}
                  disabled={!acknowledged || confirmWipeText.trim() !== "WIPE_ALL_DATA"}
                  className="py-3 sm:py-3.5 text-xs sm:text-sm font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  {isSubmitting ? "Wiping Database & Initializing Superuser..." : "Wipe All Data & Initialize Production Superuser"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Footer info & link */}
        <div className="mt-6 text-center">
          <p className="text-xs font-semibold text-slate-400">
            Powered by{" "}
            <a
              href="https://in-tasolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-black bg-gradient-to-r from-slate-950 via-slate-900 to-blue-600 bg-clip-text text-transparent underline decoration-blue-500/30 underline-offset-2"
            >
              IN-TA Solution PVT LTD
            </a>
          </p>
          <div className="mt-2">
            <button
              onClick={() => router.push("/login")}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 underline transition-colors"
            >
              ← Back to Sign In Screen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
