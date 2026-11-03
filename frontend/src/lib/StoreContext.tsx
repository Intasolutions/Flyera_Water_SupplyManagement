"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Global App State Roles
export type AppRole = "Owner" | "WaterStaff" | "GlassStaff";
export type AppBusiness = "Water" | "Glass";

interface StoreContextType {
  currentUserRole: AppRole;
  activeBusiness: AppBusiness;
  setCurrentUserRole: (role: AppRole) => void;
  setActiveBusiness: (business: AppBusiness) => void;
}

const PUBLIC_PATHS = ["/login", "/setup"];

// Browser copies of business data from the prototype. The server is the only source now.
const LEGACY_STORAGE_KEYS = [
  "aqua_clients_v2",
  "aqua_inventory_v2",
  "aqua_assignments_v2",
  "aqua_staff_v2",
  "aqua_routes_v2",
  "glass_inventory_v2",
  "glass_collections_v2",
  "glass_vendors_v2",
  "app_role_v2",
];

export function roleToAppRole(role?: string | null): AppRole {
  if (role === "ADMIN" || role === "Owner") return "Owner";
  if (role === "GLASS_STAFF" || role === "GLASS_DRIVER") return "GlassStaff";
  return "WaterStaff";
}

function homePathFor(role?: string | null): string {
  if (role === "DRIVER" || role === "HELPER") return "/driver";
  if (role === "GLASS_DRIVER") return "/glass/driver";
  if (role === "GLASS_STAFF") return "/glass";
  return "/";
}

// A convenience for people. The backend enforces the same rules on every request.
function canOpenPath(role: string | null | undefined, path: string): boolean {
  const isGlassPath = path === "/glass" || path.startsWith("/glass/");
  if (role === "ADMIN" || role === "Owner") return true;
  if (role === "DRIVER" || role === "HELPER") return path === "/driver";
  if (role === "GLASS_DRIVER") return path === "/glass/driver";
  if (role === "GLASS_STAFF") return isGlassPath;
  return !isGlassPath;
}

function storedUserRole(): string | null {
  try {
    const raw = localStorage.getItem("flyera_user");
    return raw ? JSON.parse(raw).role || null : null;
  } catch {
    return null;
  }
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [currentUserRole, setCurrentUserRole] = useState<AppRole>("WaterStaff");
  const [activeBusiness, setActiveBusinessState] = useState<AppBusiness>("Water");
  const [isLoaded, setIsLoaded] = useState(false);
  const [clearedPath, setClearedPath] = useState<string | null>(null);

  useEffect(() => {
    LEGACY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    setCurrentUserRole(roleToAppRole(storedUserRole()));
    const savedBusiness = localStorage.getItem("app_business_v2");
    if (savedBusiness === "Water" || savedBusiness === "Glass") setActiveBusinessState(savedBusiness);
    setIsLoaded(true);
  }, []);

  // Runs on every navigation, not only on first load, so links cannot get around it.
  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) {
      setClearedPath(pathname);
      return;
    }
    if (!localStorage.getItem("access_token") && !localStorage.getItem("refresh_token")) {
      router.replace("/login");
      return;
    }
    const role = storedUserRole();
    if (!canOpenPath(role, pathname)) {
      router.replace(homePathFor(role));
      return;
    }
    setClearedPath(pathname);
  }, [pathname, router]);

  const setActiveBusiness = (business: AppBusiness) => {
    setActiveBusinessState(business);
    localStorage.setItem("app_business_v2", business);
  };

  if (!isLoaded || clearedPath !== pathname) return null; // Avoid hydration mismatch and pages flashing before a redirect

  return (
    <StoreContext.Provider value={{ currentUserRole, activeBusiness, setCurrentUserRole, setActiveBusiness }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within a StoreProvider");
  return context;
};
