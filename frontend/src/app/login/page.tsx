"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Droplet, 
  Lock, 
  User, 
  Recycle, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Download, 
  Smartphone, 
  X, 
  Share, 
  PlusSquare 
} from "lucide-react";
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

  // PWA Install state
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isStandaloneMode = 
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);

      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsIos(/iphone|ipad|ipod/.test(userAgent));
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      try {
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === "accepted") {
          setIsStandalone(true);
        }
        setInstallPrompt(null);
        return;
      } catch (err) {
        console.warn("PWA prompt error", err);
      }
    }
    setShowInstallGuide(true);
  };

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
      
      // 1. Try directly from login payload
      let user: any = authRes.user;

      // 2. Fallback to /auth/me
      if (!user) {
        try {
          user = await getCurrentUser();
        } catch (meErr) {
          console.warn("Could not load /auth/me, trying token decoding", meErr);
        }
      }

      // 3. Fallback to decoding the access_token JWT payload directly
      if (!user && authRes.access_token) {
        try {
          const parts = authRes.access_token.split(".");
          if (parts.length >= 2) {
            const decoded = JSON.parse(atob(parts[1]));
            user = {
              id: decoded.sub,
              name: decoded.name || username,
              role: decoded.role || "ADMIN",
              username: username,
            };
          }
        } catch (jwtErr) {
          console.warn("JWT payload decoding error", jwtErr);
        }
      }

      if (!user) {
        throw new Error("Unable to establish authenticated session. Please try again.");
      }

      try {
        localStorage.setItem("flyera_user", JSON.stringify(user));
      } catch (e) {}
      
      let mappedRole: AppRole = "Owner";
      const roleUpper = (user.role || "").toUpperCase();
      if (roleUpper === "ADMIN") {
        mappedRole = "Owner";
      } else if (roleUpper.includes("GLASS")) {
        mappedRole = "GlassStaff";
      } else {
        mappedRole = "WaterStaff";
      }

      setCurrentUserRole(mappedRole);
      
      // Role-based destination:
      // Co-Worker (Water) -> /driver (Water Driver Co-Pilot)
      // Glass Co-Worker -> /glass/driver (Glass Driver Intake)
      // Admin -> / (Management Dashboard)
      if (roleUpper === "ADMIN") {
        router.push("/");
      } else if (roleUpper.includes("GLASS")) {
        router.push("/glass/driver");
      } else {
        // Any water co-worker directly sees the water driver page
        router.push("/driver");
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify username and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen h-[100dvh] w-full bg-[#FDFBF7] flex flex-col items-center justify-center px-4 py-2 relative overflow-hidden select-none">
      {/* Floating Top-Right Install App Button */}
      {!isStandalone && (
        <button
          onClick={handleInstallClick}
          type="button"
          className="fixed top-4 right-4 z-30 inline-flex items-center gap-2 px-3.5 py-2 bg-white/90 hover:bg-white text-slate-800 hover:text-primary text-xs font-black rounded-xl border border-slate-200/90 shadow-sm backdrop-blur-md transition-all active:scale-95 group"
          title="Install Flyera App"
        >
          <Download className="w-3.5 h-3.5 text-primary group-hover:translate-y-0.5 transition-transform" />
          <span>Install App</span>
        </button>
      )}

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

      {/* Mobile PWA Install Guide Modal (iOS Safari & Manual Android instructions) */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80 space-y-5">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                aria-label="Close guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">Install Flyera App</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Install Flyera on your device home screen for fast full-screen access and offline support.
              </p>
            </div>

            {isIos ? (
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-700 font-semibold">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                  <span>Tap the <span className="font-black text-slate-900 inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200"><Share className="w-3 h-3 text-primary inline" /> Share</span> icon at the bottom of Safari.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                  <span>Scroll down and tap <span className="font-black text-slate-900 inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200"><PlusSquare className="w-3 h-3 text-primary inline" /> Add to Home Screen</span>.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                  <span>Tap <span className="font-black text-slate-900">&quot;Add&quot;</span> in the top-right corner to finish.</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-700 font-semibold">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                  <span>Tap your browser&apos;s <span className="font-black text-slate-900">Menu (⋮ 3 dots)</span> icon.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                  <span>Select <span className="font-black text-slate-900">&quot;Install app&quot;</span> or <span className="font-black text-slate-900">&quot;Add to Home screen&quot;</span>.</span>
                </div>
              </div>
            )}

            <Button variant="primary" fullWidth onClick={() => setShowInstallGuide(false)}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
