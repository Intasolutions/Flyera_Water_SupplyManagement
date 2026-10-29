"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  BarChart3,
  Truck, 
  Users, 
  Package, 
  Settings, 
  Droplet,
  Menu, 
  X, 
  Map, 
  Recycle, 
  Factory, 
  Warehouse, 
  LogOut, 
  ChevronRight,
  Download,
  Smartphone,
  MoreHorizontal,
  Share,
  PlusSquare
} from "lucide-react";
import { useStore, AppRole, AppBusiness } from "@/lib/StoreContext";

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const { currentUserRole, activeBusiness, setCurrentUserRole, setActiveBusiness } = useStore();

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
    // If browser does not support programmatic prompt (iOS Safari or Chrome before trigger)
    setShowInstallGuide(true);
  };

  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("flyera_user");
        if (raw) {
          const parsed = JSON.parse(raw);
          setUserRole(parsed.role?.toUpperCase() || "");
        }
      } catch (e) {}
    }
  }, []);

  const isDriver = userRole === "DRIVER" || userRole === "HELPER" || userRole === "GLASS_DRIVER";

  const waterLinks = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Deliveries", href: "/deliveries", icon: Truck },
    { name: "Routes", href: "/routes", icon: Map },
    { name: "Vehicles", href: "/vehicles", icon: Truck },
    { name: "Inventory", href: "/inventory", icon: Package },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Staff", href: "/staff", icon: Users },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const glassLinks = [
    { name: "Glass Dashboard", href: "/glass", icon: LayoutDashboard },
    ...(isDriver ? [{ name: "Driver Collections", href: "/glass/driver", icon: Truck }] : []),
    { name: "Godown Separation", href: "/glass/godown", icon: Factory },
    { name: "Vendor Pickups", href: "/glass/vendor", icon: Warehouse },
  ];

  const isGlass = currentUserRole === "GlassStaff" || (currentUserRole === "Owner" && activeBusiness === "Glass");

  const driverWaterLinks = [
    { name: "Driver Co-Pilot", href: "/driver", icon: Truck },
  ];
  const driverGlassLinks = [
    { name: "Driver Collections", href: "/glass/driver", icon: Truck },
  ];

  const rawLinks = isDriver
    ? (userRole === "GLASS_DRIVER" ? driverGlassLinks : driverWaterLinks)
    : (isGlass ? glassLinks : waterLinks);
  const links = rawLinks.filter(link => {
    // Only Admin / Owner can see Settings
    if (link.href === "/settings" && currentUserRole !== "Owner") {
      return false;
    }
    return true;
  });

  const handleSignOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("flyera_user");
    window.location.href = "/login";
  };

  // Quick bottom bar links for mobile phone navigation
  const mobileQuickLinks = isDriver ? (
    userRole === "GLASS_DRIVER" ? [
      { name: "Intake", href: "/glass/driver", icon: Truck },
    ] : [
      { name: "Co-Pilot", href: "/driver", icon: Truck },
    ]
  ) : isGlass ? [
    { name: "Dashboard", href: "/glass", icon: LayoutDashboard },
    { name: "Godown", href: "/glass/godown", icon: Factory },
    { name: "Vendors", href: "/glass/vendor", icon: Warehouse },
  ] : [
    { name: "Home", href: "/", icon: LayoutDashboard },
    { name: "Dispatch", href: "/deliveries", icon: Truck },
    { name: "Stock", href: "/inventory", icon: Package },
    { name: "Clients", href: "/clients", icon: Users },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-xl border-b border-black/5 flex items-center justify-between px-4 z-40 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setIsOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm ${
              isGlass 
                ? "bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/20" 
                : "bg-gradient-to-tr from-sky-600 to-blue-500 shadow-sky-500/20"
            }`}>
              {isGlass ? <Recycle className="w-4 h-4" /> : <Droplet className="w-4 h-4" />}
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">
                FLYERA
              </h1>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mt-0.5">
                {isGlass ? "Glass Circular" : "Water Logistics"}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile PWA Install Pill (Always visible in mobile browser until installed) */}
        {!isStandalone && (
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 bg-gradient-to-r from-sky-50 to-blue-50 hover:from-sky-100 hover:to-blue-100 text-sky-800 border border-sky-200/90 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs active:scale-95 shrink-0"
          >
            <Smartphone className="w-3.5 h-3.5 text-primary" />
            <span>Install App</span>
            <Download className="w-3.5 h-3.5 text-primary" />
          </button>
        )}
      </div>

      {/* Backdrop for Mobile Drawer */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 md:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Navigation Drawer (Sticky In-Flow on Desktop, Overlay Drawer on Mobile) */}
      <aside
        className={`w-72 max-w-[85vw] md:max-w-72 flex flex-col p-5 border-r border-slate-200/80 bg-white transition-transform duration-300 fixed inset-y-0 left-0 h-full min-h-dvh shadow-2xl z-50 md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 md:shadow-none md:z-30 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="flex flex-col mb-4">
          <div className="flex items-center justify-between mb-4 pt-1">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md transition-transform hover:scale-105 shrink-0 ${
                  isGlass 
                    ? "bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/25" 
                    : "bg-gradient-to-tr from-sky-600 to-blue-500 shadow-sky-500/25"
                }`}
              >
                {isGlass ? <Recycle className="w-6 h-6" /> : <Droplet className="w-6 h-6" />}
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                  FLYERA
                </h1>
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mt-1">
                  {isGlass ? "Glass Circular" : "Water Logistics"}
                </p>
              </div>
            </div>

            {/* Close Button inside Drawer (Mobile only) */}
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden text-slate-500 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Close menu drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Business Switcher for Owner / Admin */}
          {currentUserRole === "Owner" && (
            <div className="p-1 bg-slate-100/80 border border-slate-200/60 rounded-xl mb-2 flex gap-1">
              <button
                onClick={() => setActiveBusiness("Water")}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeBusiness === "Water"
                    ? "bg-white shadow-xs text-sky-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Droplet className="w-3.5 h-3.5" />
                Water
              </button>
              <button
                onClick={() => setActiveBusiness("Glass")}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeBusiness === "Glass"
                    ? "bg-white shadow-xs text-emerald-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Recycle className="w-3.5 h-3.5" />
                Glass
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links with Crisp Desktop 14px Font & Balanced Spacing */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-1 py-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {links.map(link => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive 
                    ? isGlass
                      ? "bg-emerald-50 text-emerald-700 font-bold shadow-2xs border border-emerald-100"
                      : "bg-sky-50 text-primary font-bold shadow-2xs border border-sky-100"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-105 ${
                      isActive 
                        ? isGlass ? "text-emerald-600" : "text-primary" 
                        : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  <span>{link.name}</span>
                </div>
                {isActive && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isGlass ? "bg-emerald-600" : "bg-primary"}`} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* PWA Install Button inside Drawer (Always accessible in browser) */}
        {!isStandalone && (
          <div className="px-1 mb-2.5">
            <button
              onClick={handleInstallClick}
              className="w-full p-2.5 rounded-xl bg-sky-50 hover:bg-sky-100/80 border border-sky-200/80 text-sky-800 flex items-center justify-between transition-all group shadow-2xs active:scale-95"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 leading-none">Install Flyera App</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Offline PWA Standalone</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-primary group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        )}

        {/* User Card & Logout Footer */}
        <div className="mt-auto pt-2.5 border-t border-slate-100">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-2xs shrink-0 ${
                  isGlass 
                    ? "bg-gradient-to-tr from-emerald-600 to-teal-500" 
                    : "bg-gradient-to-tr from-sky-600 to-blue-500"
                }`}
              >
                {currentUserRole === "Owner" ? "AD" : currentUserRole === "GlassStaff" ? "GS" : currentUserRole === "WaterStaff" ? "WS" : "DR"}
              </div>
              <div className="truncate">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {currentUserRole === "Owner" ? "Administrator" : currentUserRole === "WaterStaff" ? "Water Staff" : currentUserRole === "GlassStaff" ? "Glass Staff" : currentUserRole}
                </p>
                <span className="text-xs text-slate-500 font-medium block">
                  {currentUserRole === "Owner" ? "Full Admin Access" : "Staff Operations"}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Brand Footer */}
          <div className="pt-2 pb-0.5 text-center">
            <p className="text-[10.5px] font-semibold text-slate-400 tracking-tight">
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
      </aside>

      {/* Professional Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/98 backdrop-blur-2xl border-t border-slate-200/80 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] px-2 py-2 flex items-center justify-around">
        {mobileQuickLinks.map(link => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
                isActive
                  ? isGlass 
                    ? "text-emerald-700 font-black" 
                    : "text-primary font-black"
                  : "text-slate-600 font-bold hover:text-slate-900"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-bold leading-tight mt-0.5">{link.name}</span>
            </Link>
          );
        })}

        {/* 5th Tab: Opens Full Menu Drawer */}
        <button
          onClick={() => setIsOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
            isOpen 
              ? "text-primary font-black" 
              : "text-slate-600 font-bold hover:text-slate-900"
          }`}
          aria-label="Open full menu"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-xs font-bold leading-tight mt-0.5">Menu</span>
        </button>
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

            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-3 bg-primary text-white text-xs font-black rounded-xl hover:bg-primary/90 transition-all shadow-sm active:scale-98"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
