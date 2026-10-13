"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Droplet, Lock, User, Recycle, ArrowRight, ShieldCheck, Sparkles, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { login, getCurrentUser } from "@/lib/api";
import { useStore, AppRole } from "@/lib/StoreContext";

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUserRole } = useStore();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const authRes = await login(username, password);
      localStorage.setItem("access_token", authRes.access_token);
      if (authRes.refresh_token) {
        localStorage.setItem("refresh_token", authRes.refresh_token);
      }
      
      const user = await getCurrentUser();
      try {
        localStorage.setItem("flyera_user", JSON.stringify(user));
      } catch (e) {}
      
      let mappedRole: AppRole = "Owner";
      if (user.role === "ADMIN") mappedRole = "Owner";
      if (user.role === "DRIVER" || user.role === "HELPER") mappedRole = "WaterStaff";
      if (user.role === "WATER_STAFF") mappedRole = "WaterStaff";
      if (user.role === "GLASS_STAFF") mappedRole = "GlassStaff";
      if (user.role === "GLASS_DRIVER") mappedRole = "GlassStaff";

      setCurrentUserRole(mappedRole);
      
      if (user.role === "DRIVER" || user.role === "HELPER") {
        router.push("/driver");
      } else if (user.role === "GLASS_DRIVER") {
        router.push("/glass/driver");
      } else if (user.role === "GLASS_STAFF") {
        router.push("/glass");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify username and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen h-[100dvh] w-full bg-[#FDFBF7] flex flex-col items-center justify-center px-4 py-2 relative overflow-hidden select-none">
      {/* Ambient glowing backdrop orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-64 h-64 bg-amber-100/50 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-sm sm:max-w-md relative z-10 flex flex-col items-center justify-center my-auto">
        {/* Brand Header */}
        <div className="text-center mb-3 sm:mb-4">
          <div className="inline-flex items-center justify-center gap-1.5 p-1.5 sm:p-2 bg-white/80 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-xs border border-black/5 mb-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm shadow-primary/20">
              <Droplet className="w-4 h-4" />
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20">
              <Recycle className="w-4 h-4" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            FLYERA
          </h1>
          <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
            Water Logistics &amp; Glass Recycling Suite
          </p>
        </div>

        {/* Frosted Glass Login Panel */}
        <div className="bg-white/90 backdrop-blur-xl p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.06)] border border-white/60 w-full">
          <div className="mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-black text-slate-800">Sign in to your portal</h2>
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium">Access operations, live fleet &amp; recycling workstations</p>
          </div>

          {error && (
            <div className="mb-3 p-2.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold border border-rose-200/80 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Username / Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-800 text-sm font-semibold focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xs"
                  placeholder="e.g. admin or 9998887776"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Security Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-800 text-sm font-semibold focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xs"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={loading}
              className="py-2.5 sm:py-3 text-xs sm:text-sm font-black shadow-md mt-1"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {loading ? "Authenticating..." : "Sign In to Dashboard"}
            </Button>
          </form>
        </div>

        {/* Security watermark footer & Brand signature */}
        <div className="text-center mt-3 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>256-Bit SSL Encrypted Session</span>
          </div>
          <div className="pt-0.5">
            <a
              href="/setup"
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              First time production launch? <span className="underline">Initialize Superuser</span>
            </a>
          </div>
          <p className="text-[11px] font-semibold text-slate-400">
            Powered by{" "}
            <a
              href="https://in-tasolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-black bg-gradient-to-r from-slate-950 via-slate-900 to-blue-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity underline decoration-blue-500/30 underline-offset-2"
              title="Visit IN-TA Solutions"
            >
              IN-TA Solution PVT LTD
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
