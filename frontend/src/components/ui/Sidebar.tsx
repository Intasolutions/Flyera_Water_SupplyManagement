"use client";

import { useState } from "react";
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
  Car
} from "lucide-react";
import { useStore, AppRole, AppBusiness } from "@/lib/StoreContext";
import { Button } from "@/components/ui/Button";

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { currentUserRole, activeBusiness, setCurrentUserRole, setActiveBusiness } = useStore();

  const waterLinks = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Deliveries", href: "/deliveries", icon: Truck },
    { name: "Routes", href: "/routes", icon: Map },
    { name: "Vehicles", href: "/vehicles", icon: Car },
    { name: "Inventory", href: "/inventory", icon: Package },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Staff", href: "/staff", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const glassLinks = [
    { name: "Glass Dashboard", href: "/glass", icon: LayoutDashboard },
    { name: "Driver Collections", href: "/glass/driver", icon: Truck },
    { name: "Godown Separation", href: "/glass/godown", icon: Factory },
    { name: "Vendor Pickups", href: "/glass/vendor", icon: Car },
  ];

  let links = waterLinks;
  if (currentUserRole === "GlassStaff" || (currentUserRole === "Owner" && activeBusiness === "Glass")) {
    links = glassLinks;
  }

  return (
    <>
      {/* Mobile / Tablet Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-black/5 flex items-center justify-between px-4 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary rounded-lg">
            <Droplet className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-text">AquaFlow</h1>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-text">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar (Desktop & toggled Mobile) */}
      <div className={`w-64 h-screen bg-white fixed left-0 top-0 flex flex-col p-4 z-50 border-r border-black/5 shadow-sm transition-transform duration-300 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col mb-6 px-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${links === glassLinks ? 'bg-emerald-500' : 'bg-primary'}`}>
                {links === glassLinks ? <Recycle className="w-6 h-6 text-white" /> : <Droplet className="w-6 h-6 text-white" />}
              </div>
              <h1 className="text-xl font-bold premium-gradient-text tracking-tight">
                {links === glassLinks ? 'GlassFlow' : 'AquaFlow'}
              </h1>
            </div>
            <button onClick={() => setIsOpen(false)} className="md:hidden text-text-muted hover:text-text">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-surface rounded-lg p-3 border border-black/5 space-y-2">
            <div>
              <p className="text-xs font-semibold text-text-muted mb-1 block">Logged In As:</p>
              <div className="w-full text-sm font-bold text-text bg-white border border-black/10 rounded px-3 py-2">
                {currentUserRole}
              </div>
            </div>
            
            {currentUserRole === "Owner" && (
              <div>
                <label className="text-xs font-semibold text-text-muted mb-1 block mt-2">Business Context:</label>
                <select 
                  value={activeBusiness} 
                  onChange={(e) => setActiveBusiness(e.target.value as AppBusiness)}
                  className="w-full text-sm bg-white border border-black/10 rounded px-2 py-1 outline-none text-text focus:border-primary font-medium"
                >
                  <option value="Water">Water Supply</option>
                  <option value="Glass">Glass Collection</option>
                </select>
              </div>
            )}
          </div>
        </div>

      <nav className="flex-1 space-y-2 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" 
                  : "text-text-muted hover:bg-surface-hover hover:text-text border border-transparent"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-text-muted"}`} />
              <span className="font-medium">{link.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 p-4 bg-surface rounded-xl border border-black/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
              {currentUserRole === 'Owner' ? 'OW' : currentUserRole === 'GlassStaff' ? 'GS' : 'ST'}
            </div>
            <div>
              <p className="text-sm font-bold text-text truncate max-w-[120px]">
                {currentUserRole}
              </p>
              <p className="text-xs text-text-muted font-medium">
                {currentUserRole === 'Owner' ? 'Admin Account' : 'Staff Account'}
              </p>
            </div>
          </div>
        </div>
        
        <Button 
          variant="danger"
          fullWidth
          onClick={() => {
            localStorage.removeItem("access_token");
            window.location.href = "/login";
          }}
        >
          Sign Out
        </Button>
      </div>
    </div>
    </>
  );
}
