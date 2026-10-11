"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
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
  MoreHorizontal
} from "lucide-react";
import { useStore, AppRole, AppBusiness } from "@/lib/StoreContext";

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const { currentUserRole, activeBusiness, setCurrentUserRole, setActiveBusiness } = useStore();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
    }
    setInstallPrompt(null);
  };

  const waterLinks = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Deliveries", href: "/deliveries", icon: Truck },
    { name: "Routes", href: "/routes", icon: Map },
    { name: "Vehicles", href: "/vehicles", icon: Truck },
    { name: "Inventory", href: "/inventory", icon: Package },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Staff", href: "/staff", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const glassLinks = [
    { name: "Glass Dashboard", href: "/glass", icon: LayoutDashboard },
    { name: "Driver Collections", href: "/glass/driver", icon: Truck },
    { name: "Godown Separation", href: "/glass/godown", icon: Factory },
    { name: "Vendor Pickups", href: "/glass/vendor", icon: Warehouse },
  ];

  const isGlass = currentUserRole === "GlassStaff" || (currentUserRole === "Owner" && activeBusiness === "Glass");
  const links = isGlass ? glassLinks : waterLinks;

  const handleSignOut = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  };

  // Quick bottom bar links for mobile phone navigation
  const mobileQuickLinks = isGlass ? [
    { name: "Dashboard", href: "/glass", icon: LayoutDashboard },
    { name: "Intake", href: "/glass/driver", icon: Truck },
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
      {/* Mobile Clean Top Status Bar - Minimal & Professional (No redundant hamburger) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-xl border-b border-black/5 flex items-center justify-between px-5 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm ${
            isGlass 
              ? "bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/20" 
              : "bg-gradient-to-tr from-sky-600 to-blue-500 shadow-sky-500/20"
          }`}>
            {isGlass ? <Recycle className="w-5 h-5" /> : <Droplet className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">
              FLYERA
            </h1>
            <span className="text-xs font-black text-slate-600 uppercase tracking-wider block mt-1">
              {isGlass ? "Glass Circular" : "Water Logistics"}
            </span>
          </div>
        </div>

        {/* Optional Clean Mobile PWA Install Pill */}
        {isInstallable && (
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-primary border border-sky-200/80 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Install App</span>
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

      {/* Sidebar Navigation Drawer */}
      <aside
        className={`w-80 max-w-[85vw] inset-y-0 h-full min-h-dvh bg-white backdrop-blur-2xl fixed left-0 top-0 flex flex-col p-5 z-50 border-r border-slate-200/80 shadow-2xl transition-transform duration-300 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
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
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                  FLYERA
                </h1>
                <p className="text-xs uppercase tracking-wider font-black text-slate-600 mt-1">
                  {isGlass ? "Glass Circular" : "Water Logistics"}
                </p>
              </div>
            </div>

            {/* Close Button inside Drawer (Mobile only) */}
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden text-slate-500 hover:text-slate-900 p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Close menu drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Business Switcher for Owner / Admin */}
          {currentUserRole === "Owner" && (
            <div className="p-1 bg-slate-100/90 border border-slate-200/70 rounded-2xl mb-2 flex gap-1">
              <button
                onClick={() => setActiveBusiness("Water")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeBusiness === "Water"
                    ? "bg-white shadow-xs text-sky-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Droplet className="w-4 h-4" />
                Water
              </button>
              <button
                onClick={() => setActiveBusiness("Glass")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeBusiness === "Glass"
                    ? "bg-white shadow-xs text-emerald-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Recycle className="w-4 h-4" />
                Glass
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links with Comfortable 15px Font & Clear Icons */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-1 py-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {links.map(link => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-[15px] sm:text-base font-bold transition-all duration-200 ${
                  isActive 
                    ? isGlass
                      ? "bg-emerald-50 text-emerald-800 font-black shadow-xs border border-emerald-200"
                      : "bg-sky-50 text-sky-800 font-black shadow-xs border border-sky-200"
                    : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive 
                        ? isGlass ? "text-emerald-700" : "text-sky-700" 
                        : "text-slate-500 group-hover:text-slate-800"
                    }`}
                  />
                  <span>{link.name}</span>
                </div>
                {isActive && (
                  <span className={`w-2.5 h-2.5 rounded-full ${isGlass ? "bg-emerald-600" : "bg-primary"}`} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* PWA Install Button inside Drawer */}
        {isInstallable && (
          <div className="px-1 mb-3">
            <button
              onClick={handleInstallClick}
              className="w-full p-3.5 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 flex items-center justify-between transition-all group shadow-xs active:scale-95"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs sm:text-sm font-black text-slate-900 leading-none">Install Flyera App</p>
                  <p className="text-xs text-sky-800 font-bold mt-0.5">Offline PWA Standalone</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-primary group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        )}

        {/* User Card & Logout Footer */}
        <div className="mt-auto pt-3 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 ${
                  isGlass 
                    ? "bg-gradient-to-tr from-emerald-600 to-teal-500" 
                    : "bg-gradient-to-tr from-sky-600 to-blue-500"
                }`}
              >
                {currentUserRole === "Owner" ? "OW" : currentUserRole === "GlassStaff" ? "GS" : "DR"}
              </div>
              <div className="truncate">
                <p className="text-sm sm:text-base font-black text-slate-900 truncate">
                  {currentUserRole}
                </p>
                <span className="text-xs text-slate-600 font-bold block">
                  {currentUserRole === "Owner" ? "Admin Access" : "Staff Access"}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
    </>
  );
}
