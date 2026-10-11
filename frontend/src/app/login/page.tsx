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
      
      const user = await getCurrentUser();
      
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

  const handleDemoFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glowing backdrop orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-64 h-64 bg-amber-100/50 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-2 p-3 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-black/5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20">
              <Droplet className="w-5 h-5" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Recycle className="w-5 h-5" />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            FLYERA
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Water Logistics &amp; Glass Recycling Suite
          </p>
        </div>

        {/* Frosted Glass Login Panel */}
        <div className="bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-white/60">
          <div className="mb-6">
            <h2 className="text-lg font-black text-slate-800">Sign in to your portal</h2>
            <p className="text-xs text-slate-400 font-medium">Access operations, live fleet &amp; recycling workstations</p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold border border-rose-200/80 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Username / Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-slate-800 text-sm font-semibold focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xs"
                  placeholder="e.g. admin or 9998887776"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Security Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-xl outline-none text-slate-800 text-sm font-semibold focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-xs"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
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
              className="py-3.5 text-sm font-black shadow-md mt-2"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {loading ? "Authenticating..." : "Sign In to Dashboard"}
            </Button>
          </form>

          {/* Quick-Fill Demo Pills */}
          <div className="mt-8 pt-5 border-t border-slate-100 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2.5">
              Quick One-Click Demo Logins:
            </span>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={() => handleDemoFill("admin", "password123")}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-all active:scale-95"
              >
                Admin (Owner)
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill("rahul", "password123")}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-all active:scale-95"
              >
                Rahul (Water Driver)
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill("vikram", "password123")}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-all active:scale-95"
              >
                Vikram (Glass Driver)
              </button>
            </div>
          </div>
        </div>

        {/* Security watermark footer */}
        <div className="text-center mt-6 flex items-center justify-center gap-1.5 text-slate-400 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>256-Bit SSL Encrypted Session</span>
        </div>
      </div>
    </div>
  );
}
