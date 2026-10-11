"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getGlassCollections, getGlassInventoryList, getGlassVendorPickups } from "@/lib/api";

export type Client = {
  id: string;
  name: string;
  address: string;
  phone: string;
  tier: string;
  points: number;
  optIn: boolean;
  history: string;
};

export type Inventory = {
  id: string;
  name: string;
  full: number;
  empty: number;
  damaged: number;
  price: number;
};

export type Assignment = {
  id: string;
  vehicle: string;
  driver: string;
  helper?: string;
  route: string;
  status: "pending" | "active" | "completed";
  progress: number;
  stock: string;
};

export type Staff = {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  assignment: string;
};

export type Route = {
  id: string;
  name: string;
  area: string;
  assignedVehicle: string;
};

// --- Glass Business Types ---

export type GlassInventory = {
  id: string;
  type: "unseparated" | "white" | "mixed";
  tons: number;
};

export type GlassCollection = {
  id: string;
  driverId: string;
  driverName: string;
  driver_id?: string;
  driver_name?: string;
  vehicle: string;
  property: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  tonsCollected: number;
  tons_collected?: number;
  paymentAmount: number; // manual entry, 0 for free
  payment_amount?: number;
  status: "collected" | "dropped_at_godown" | "separated";
  date: string;
};

export type GlassSeparation = {
  id: string;
  staffId: string;
  tonsSeparated: number; 
  whiteTons: number;
  mixedTons: number;
  date: string;
};

export type GlassVendorPickup = {
  id: string;
  vendorName: string;
  vendor_name?: string;
  type: "white" | "mixed";
  tons: number;
  pricePerTon?: number;
  price_per_ton?: number;
  date: string;
};

// Global App State Roles
export type AppRole = "Owner" | "WaterStaff" | "GlassStaff";
export type AppBusiness = "Water" | "Glass";

interface StoreContextType {
  // App State
  currentUserRole: AppRole;
  activeBusiness: AppBusiness;
  setCurrentUserRole: (role: AppRole) => void;
  setActiveBusiness: (business: AppBusiness) => void;

  // Water State
  clients: Client[];
  inventory: Inventory[];
  assignments: Assignment[];
  staff: Staff[];
  routes: Route[];
  addClient: (c: Client) => void;
  addInventoryItem: (i: Inventory) => void;
  updateInventory: (id: string, fullDelta: number, emptyDelta: number, damagedDelta: number) => void;
  addAssignment: (a: Assignment) => void;
  deleteAssignment: (id: string) => void;
  completeAssignment: (id: string) => void;
  completeDelivery: (assignmentId: string, clientId: string, fullDelivered: number, pointsEarned: number, paymentMethod: string) => void;
  addStaff: (s: Staff) => void;
  addRoute: (r: Route) => void;

  // Glass State
  glassInventory: GlassInventory[];
  glassCollections: GlassCollection[];
  glassVendorPickups: GlassVendorPickup[];
  addGlassCollection: (c: GlassCollection) => void;
  dropGlassAtGodown: (collectionId: string) => void;
  dropAllGlassAtGodown: (driverId: string) => void;
  separateGlass: (collectionId: string, whiteTons: number, mixedTons: number, staffId: string) => void;
  recordVendorPickup: (type: "white" | "mixed", tons: number, vendorName: string) => void;
}

const defaultClients: Client[] = [];
const defaultInventory: Inventory[] = [];
const defaultAssignments: Assignment[] = [];
const defaultStaff: Staff[] = [];
const defaultRoutes: Route[] = [];

const defaultGlassInventory: GlassInventory[] = [];
const defaultGlassCollections: GlassCollection[] = [];
const defaultGlassVendorPickups: GlassVendorPickup[] = [];

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // App State
  const [currentUserRole, setCurrentUserRole] = useState<AppRole>("Owner");
  const [activeBusiness, setActiveBusiness] = useState<AppBusiness>("Water");

  // Water State
  const [clients, setClients] = useState<Client[]>(defaultClients);
  const [inventory, setInventory] = useState<Inventory[]>(defaultInventory);
  const [assignments, setAssignments] = useState<Assignment[]>(defaultAssignments);
  const [staff, setStaff] = useState<Staff[]>(defaultStaff);
  const [routes, setRoutes] = useState<Route[]>(defaultRoutes);

  // Glass State
  const [glassInventory, setGlassInventory] = useState<GlassInventory[]>(defaultGlassInventory);
  const [glassCollections, setGlassCollections] = useState<GlassCollection[]>(defaultGlassCollections);
  const [glassVendorPickups, setGlassVendorPickups] = useState<GlassVendorPickup[]>(defaultGlassVendorPickups);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load from localStorage and verify auth on mount
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token && window.location.pathname !== "/login") {
      window.location.href = "/login";
      return;
    }

    if (token && window.location.pathname !== "/login") {
      // Validate token with backend (placeholder for actual API call, assumed valid for demo logic if present)
      setIsAuthenticated(true);
    }

    const savedClients = localStorage.getItem("aqua_clients_v2");
    const savedInventory = localStorage.getItem("aqua_inventory_v2");
    const savedAssignments = localStorage.getItem("aqua_assignments_v2");
    const savedStaff = localStorage.getItem("aqua_staff_v2");
    const savedRoutes = localStorage.getItem("aqua_routes_v2");
    const savedGlassInv = localStorage.getItem("glass_inventory_v2");
    const savedGlassColl = localStorage.getItem("glass_collections_v2");
    const savedGlassVend = localStorage.getItem("glass_vendors_v2");
    const savedRole = localStorage.getItem("app_role_v2");
    const savedBusiness = localStorage.getItem("app_business_v2");

    if (savedClients) setClients(JSON.parse(savedClients));
    if (savedInventory) setInventory(JSON.parse(savedInventory));
    if (savedAssignments) setAssignments(JSON.parse(savedAssignments));
    if (savedStaff) setStaff(JSON.parse(savedStaff));
    if (savedRoutes) setRoutes(JSON.parse(savedRoutes));
    
    if (savedGlassInv) setGlassInventory(JSON.parse(savedGlassInv));
    if (savedGlassColl) setGlassCollections(JSON.parse(savedGlassColl));
    if (savedGlassVend) setGlassVendorPickups(JSON.parse(savedGlassVend));
    if (savedRole) setCurrentUserRole(savedRole as AppRole);
    if (savedBusiness) setActiveBusiness(savedBusiness as AppBusiness);
    
    setIsLoaded(true);

    // Sync live glass data from backend if server is active
    Promise.all([
      getGlassCollections().catch(() => null),
      getGlassInventoryList().catch(() => null),
      getGlassVendorPickups().catch(() => null)
    ]).then(([colls, inv, pickups]) => {
      if (colls && colls.length > 0) {
        setGlassCollections(colls.map((c: any) => ({
          id: c.id,
          driverId: c.driver_id || c.driverId || "",
          driverName: c.driver_name || c.driverName || "Driver",
          vehicle: c.vehicle || "",
          property: c.property || "",
          location: c.location,
          phone: c.phone,
          tonsCollected: c.tons_collected ?? c.tonsCollected ?? 0,
          paymentAmount: c.payment_amount ?? c.paymentAmount ?? 0,
          status: c.status || "collected",
          date: c.date || new Date().toISOString()
        })));
      }
      if (inv && inv.length > 0) {
        setGlassInventory(inv.map((i: any) => ({
          id: i.id,
          type: i.type,
          tons: i.tons
        })));
      }
      if (pickups && pickups.length > 0) {
        setGlassVendorPickups(pickups.map((p: any) => ({
          id: p.id,
          vendorName: p.vendor_name || p.vendorName || "Vendor",
          type: p.type,
          tons: p.tons,
          pricePerTon: p.price_per_ton ?? p.pricePerTon ?? 0,
          date: p.date || new Date().toISOString()
        })));
      }
    }).catch(() => {});
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem("aqua_clients_v2", JSON.stringify(clients));
    localStorage.setItem("aqua_inventory_v2", JSON.stringify(inventory));
    localStorage.setItem("aqua_assignments_v2", JSON.stringify(assignments));
    localStorage.setItem("aqua_staff_v2", JSON.stringify(staff));
    localStorage.setItem("aqua_routes_v2", JSON.stringify(routes));
    
    localStorage.setItem("glass_inventory_v2", JSON.stringify(glassInventory));
    localStorage.setItem("glass_collections_v2", JSON.stringify(glassCollections));
    localStorage.setItem("glass_vendors_v2", JSON.stringify(glassVendorPickups));
    localStorage.setItem("app_role_v2", currentUserRole);
    localStorage.setItem("app_business_v2", activeBusiness);
  }, [clients, inventory, assignments, staff, routes, glassInventory, glassCollections, glassVendorPickups, currentUserRole, activeBusiness, isLoaded]);

  const addClient = (c: Client) => setClients([...clients, c]);
  
  const addInventoryItem = (i: Inventory) => setInventory([...inventory, i]);

  const updateInventory = (id: string, fullDelta: number, emptyDelta: number, damagedDelta: number) => {
    setInventory(prev => prev.map(inv => 
      inv.id === id ? { ...inv, full: inv.full + fullDelta, empty: inv.empty + emptyDelta, damaged: inv.damaged + damagedDelta } : inv
    ));
  };

  const addAssignment = (a: Assignment) => setAssignments([...assignments, a]);

  const deleteAssignment = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const completeAssignment = (id: string) => {
    setAssignments(prev => prev.map(a => 
      a.id === id ? { ...a, status: "completed", progress: 100 } : a
    ));
  };

  const completeDelivery = (assignmentId: string, clientId: string, fullDelivered: number, pointsEarned: number, paymentMethod: string) => {
    // 1. Update Client history & points
    setClients(prev => prev.map(c => 
      c.id === clientId ? { ...c, points: c.points + pointsEarned, history: `Last: ${fullDelivered}x 20L (Today via ${paymentMethod})` } : c
    ));
    // 2. Update Main Inventory (Deduct full, add empty)
    updateInventory("i1", -fullDelivered, fullDelivered, 0); 
    // 3. Update Assignment Stock & Progress
    setAssignments(prev => prev.map(a => {
      if (a.id === assignmentId) {
        // Parse stock string e.g. "50x 20L"
        const stockParts = a.stock.split("x");
        let currentStock = 0;
        if (stockParts.length === 2) {
          currentStock = parseInt(stockParts[0]);
        }
        const newStock = Math.max(0, currentStock - fullDelivered);
        const newProgress = Math.min(100, a.progress + 15); // mock progress increase
        return { ...a, stock: `${newStock}x 20L`, progress: newProgress };
      }
      return a;
    }));
  };

  const addStaff = (s: Staff) => setStaff([...staff, s]);
  
  const addRoute = (r: Route) => setRoutes([...routes, r]);

  // Glass Actions
  const addGlassCollection = (c: GlassCollection) => setGlassCollections([...glassCollections, c]);

  const dropGlassAtGodown = (collectionId: string) => {
    setGlassCollections(prev => prev.map(c => c.id === collectionId ? { ...c, status: "dropped_at_godown" } : c));
    // We no longer manually increment an "unseparated" inventory pool.
    // Unseparated stock is derived directly from collections in "dropped_at_godown" status.
  };

  const dropAllGlassAtGodown = (driverId: string) => {
    setGlassCollections(prev => prev.map(c => 
      (c.driverId === driverId && c.status === "collected") 
        ? { ...c, status: "dropped_at_godown" } 
        : c
    ));
  };

  const separateGlass = (collectionId: string, whiteTons: number, mixedTons: number, staffId: string) => {
    // 1. Mark collection as separated
    setGlassCollections(prev => prev.map(c => c.id === collectionId ? { ...c, status: "separated" } : c));
    
    // 2. Increase white and mixed inventory
    setGlassInventory(prev => prev.map(inv => {
      if (inv.type === "white") return { ...inv, tons: inv.tons + whiteTons };
      if (inv.type === "mixed") return { ...inv, tons: inv.tons + mixedTons };
      return inv;
    }));
  };

  const recordVendorPickup = (type: "white" | "mixed", tons: number, vendorName: string) => {
    const pickup: GlassVendorPickup = {
      id: Date.now().toString(),
      vendorName,
      type,
      tons,
      date: new Date().toISOString()
    };
    setGlassVendorPickups([...glassVendorPickups, pickup]);

    // Reduce separated inventory
    setGlassInventory(prev => prev.map(inv => {
      if (inv.type === type) return { ...inv, tons: Math.max(0, inv.tons - tons) };
      return inv;
    }));
  };

  if (!isLoaded) return null; // Avoid hydration mismatch

  return (
    <StoreContext.Provider value={{ 
      currentUserRole, activeBusiness, setCurrentUserRole, setActiveBusiness,
      clients, inventory, assignments, staff, routes, 
      addClient, addInventoryItem, updateInventory, 
      addAssignment, deleteAssignment, completeAssignment, completeDelivery, 
      addStaff, addRoute,
      glassInventory, glassCollections, glassVendorPickups,
      addGlassCollection, dropGlassAtGodown, dropAllGlassAtGodown, separateGlass, recordVendorPickup
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within a StoreProvider");
  return context;
};
