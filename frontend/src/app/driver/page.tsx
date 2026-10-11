"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/StoreContext";
import { 
  getClients, 
  Client as ApiClient, 
  getAssignments, 
  getRoutes, 
  createDelivery, 
  getInventoryTypes, 
  getCurrentUser, 
  getVehicles, 
  createClient 
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "react-hot-toast";
import { 
  MapPin, 
  Phone, 
  Package, 
  CheckCircle2, 
  IndianRupee, 
  Minus, 
  Plus, 
  QrCode, 
  AlertTriangle, 
  Navigation, 
  Route as RouteIcon,
  Truck,
  Sparkles,
  ArrowRight,
  Crosshair,
  RefreshCw,
  ExternalLink
} from "lucide-react";

export default function DriverApp() {
  const { completeDelivery } = useStore();
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [activeClient, setActiveClient] = useState<string | null>(null);
  
  const [step, setStep] = useState(1); // 1: Delivery Details, 2: Payment
  
  // Maps inventory_type_id -> { full, empty, damaged }
  const [deliveryItems, setDeliveryItems] = useState<Record<string, { full: number; empty: number; damaged: number }>>({});
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>("");
  const [activeAllocations, setActiveAllocations] = useState<any[]>([]);

  const [initialStock, setInitialStock] = useState(0);
  const [currentStock, setCurrentStock] = useState(0);
  const [assignedRouteId, setAssignedRouteId] = useState<string | null>(null);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [inventoryTypes, setInventoryTypes] = useState<any[]>([]);
  
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientTier, setNewClientTier] = useState("Standard");
  const [newClientOptIn, setNewClientOptIn] = useState(true);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>("Ready to acquire GPS");
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);
  const bestAccuracyRef = useRef<number>(999999);
  
  const [vehicleDisplay, setVehicleDisplay] = useState("No Vehicle Assigned");
  const [routeDisplay, setRouteDisplay] = useState("No Route");
  const [assignmentStatus, setAssignmentStatus] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getAssignments(), 
      getClients(), 
      getRoutes(), 
      getInventoryTypes(), 
      getCurrentUser(), 
      getVehicles()
    ])
      .then(([assignments, allClients, allRoutes, invTypes, user, allVehicles]) => {
        setInventoryTypes(invTypes || []);
        
        // Find assignment for current driver
        let active = assignments.find(a => a.status === "ACTIVE" && a.driver_id === user.id);
        if (!active) {
          active = assignments.find(a => a.status === "PENDING" && a.driver_id === user.id);
        }

        if (active) {
          setAssignedRouteId(active.route_id);
          setActiveAssignmentId(active.id);
          setAssignmentStatus(active.status);
          
          const matchedRoute = allRoutes.find(r => r.id === active.route_id);
          const matchedVehicle = allVehicles.find(v => v.id === active.vehicle_id);
          
          if (matchedRoute) setRouteDisplay(matchedRoute.name);
          if (matchedVehicle) setVehicleDisplay(matchedVehicle.plate_number);

          // Filter clients by assigned route
          const routeClients = allClients.filter(c => c.route_id === active.route_id);
          const mappedClients = routeClients.map(c => {
            const delivery = (active as any).deliveries?.find((d: any) => d.client_id === c.id);
            if (delivery) {
              const bottles = delivery.items?.reduce((sum: number, item: any) => sum + (item.delivered_full || 0), 0) || 0;
              return { ...c, isCompleted: true, deliveredCount: bottles };
            }
            return c;
          });
          setClients(mappedClients);
          
          if (active.allocations && active.allocations.length > 0) {
            setActiveAllocations(active.allocations);
            const total = active.allocations.reduce((sum, alloc) => sum + alloc.allocated_count, 0);
            const totalDelivered = (active as any).deliveries?.reduce((sum: number, d: any) => sum + (d.items?.reduce((itemSum: number, item: any) => itemSum + (item.delivered_full || 0), 0) || 0), 0) || 0;
            setInitialStock(total);
            setCurrentStock(total - totalDelivered);
          }
        } else {
          setAssignmentStatus("UNASSIGNED");
          setClients([]);
          setInitialStock(0);
          setCurrentStock(0);
        }
      })
      .catch(console.error);
  }, []);

  const handleStartDelivery = (id: string) => {
    setActiveClient(id);
    setStep(1);
    setDeliveryItems({});
    if (activeAllocations.length > 0) {
      setSelectedInventoryId(activeAllocations[0].inventory_type_id);
    }
  };

  const handlePayment = async (method: string) => {
    if (activeClient) {
      const itemsPayload = Object.entries(deliveryItems)
        .filter(([_, counts]) => counts.full > 0 || counts.empty > 0)
        .map(([invId, counts]) => {
          const inv = inventoryTypes.find(i => i.id === invId);
          return {
            inventory_type_id: invId,
            delivered_full: counts.full,
            collected_empty: counts.empty,
            price_charged: getClientPrice(inv, clients.find(c => c.id === activeClient)?.tier)
          };
        });

      if (activeAssignmentId) {
        try {
          await createDelivery({
            assignment_id: activeAssignmentId,
            client_id: activeClient,
            total_amount: totalAmount,
            payment_method: method,
            status: method === "Skipped" ? "SKIPPED" : "COMPLETED",
            items: itemsPayload
          });
        } catch (e) {
          console.error("Failed to sync delivery to backend", e);
        }
      } else {
        completeDelivery("mock_assignment_id", activeClient, itemsPayload[0]?.delivered_full || 0, totalAmount, method);
      }
      
      const totalFullDelivered = itemsPayload.reduce((sum, item) => sum + item.delivered_full, 0);

      setClients(prev => prev.map(c => 
        c.id === activeClient ? { ...c, isCompleted: true, deliveredCount: totalFullDelivered } as any : c
      ));
      
      setCurrentStock(prev => Math.max(0, prev - totalFullDelivered));
      toast.success("Delivery completed successfully!");
    }
    setActiveClient(null);
  };

  const startGpsAcquisition = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (!("geolocation" in navigator)) {
      setGpsStatus("Geolocation not supported by device");
      return;
    }

    setIsLocating(true);
    setGpsStatus("Locking GPS satellites (refining accuracy)...");
    bestAccuracyRef.current = 999999;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const roundedAcc = Math.round(accuracy);

        if (accuracy < bestAccuracyRef.current) {
          bestAccuracyRef.current = accuracy;
          setGpsLocation({ lat: latitude, lng: longitude });
          setGpsAccuracy(roundedAcc);

          if (accuracy <= 15) {
            setGpsStatus(`GPS Locked (±${roundedAcc}m High Precision)`);
          } else {
            setGpsStatus(`Refining fix: ±${roundedAcc}m (waiting for satellite lock...)`);
          }

          // Reverse geocode if address is currently blank
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.address) {
                const parts = [
                  data.address.road || data.address.pedestrian,
                  data.address.suburb || data.address.neighbourhood || data.address.residential,
                  data.address.city || data.address.town || data.address.county
                ].filter(Boolean);
                const resolved = parts.join(", ") || data.display_name;
                if (resolved) {
                  setNewClientAddress(prev => prev || resolved);
                }
              }
            })
            .catch(() => {});
        }

        // Tightly locked to within 10 meters: clear watch to save battery
        if (accuracy <= 10 && watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
          setIsLocating(false);
          setGpsStatus(`GPS Locked (±${roundedAcc}m High Precision)`);
        }
      },
      (error) => {
        console.warn("Geolocation watch error:", error);
        setIsLocating(false);
        if (error.code === 1) {
          setGpsStatus("Location permission denied. Please allow GPS access.");
        } else if (error.code === 3) {
          setGpsStatus("GPS acquisition timed out. Tap 'Refetch' to retry.");
        } else {
          setGpsStatus("Could not acquire accurate GPS. Tap 'Refetch'.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 25000,
        maximumAge: 0
      }
    );

    // Stop active watch after 12s if not already stopped
    setTimeout(() => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setIsLocating(false);
      }
    }, 12000);
  };

  useEffect(() => {
    if (isAddClientOpen) {
      setGpsLocation(null);
      setGpsAccuracy(null);
      startGpsAcquisition();
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setIsLocating(false);
      }
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isAddClientOpen]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !assignedRouteId) return;
    
    setIsAddingClient(true);
    
    try {
      const client = await createClient({
        name: newClientName,
        phone: newClientPhone,
        address: newClientAddress,
        route_id: assignedRouteId,
        tier: newClientTier,
        opt_in_loyalty: newClientOptIn,
        loyalty_points: 0,
        latitude: gpsLocation?.lat,
        longitude: gpsLocation?.lng
      });
      setClients(prev => [...prev, client]);
      setIsAddClientOpen(false);
      setNewClientName("");
      setNewClientPhone("");
      setNewClientAddress("");
      setNewClientTier("Standard");
      setNewClientOptIn(true);
      toast.success("Client added and saved to route!");
    } catch (err) {
      console.error("Failed to create client", err);
      toast.error("Failed to add client. Try again.");
    } finally {
      setIsAddingClient(false);
    }
  };

  const clientDetails = clients.find(c => c.id === activeClient);

  const handleCallClient = (e: React.MouseEvent, clientName: string, phone?: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    if (!phone || !phone.trim()) {
      toast.error(`No phone number listed for ${clientName}`);
      return;
    }

    // Clean phone number: strip spaces, dashes, parentheses, non-digit characters
    const cleanPhone = phone.replace(/[^0-9+*#]/g, "");

    if (!cleanPhone || cleanPhone.length < 3) {
      toast.error(`Invalid phone number format for ${clientName}`);
      return;
    }

    // Copy to clipboard for easy manual dial or tablets
    if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(cleanPhone).catch(() => {});
    }

    toast.success(`Opening dialer: ${cleanPhone}`);

    // Direct window location trigger to reliably launch device phone dialer
    window.location.href = `tel:${cleanPhone}`;
  };

  const getClientPrice = (inv: any, tier?: string) => {
    if (!inv) return 80;
    if (tier === "Wholesale") return inv.wholesale_price || 65;
    if (tier === "Premium") return inv.premium_price || 60;
    return inv.price || 80;
  };
  
  const totalAmount = Object.entries(deliveryItems).reduce((sum, [invId, counts]) => {
    const inv = inventoryTypes.find(i => i.id === invId);
    return sum + (counts.full * getClientPrice(inv, clientDetails?.tier));
  }, 0);
  const totalFullDelivered = Object.values(deliveryItems).reduce((sum, item) => sum + item.full, 0);

  const currentDelivery = deliveryItems[selectedInventoryId] || { full: 0, empty: 0, damaged: 0 };
  const updateCurrentDelivery = (field: "full" | "empty" | "damaged", value: number) => {
    setDeliveryItems(prev => ({
      ...prev,
      [selectedInventoryId]: {
        ...(prev[selectedInventoryId] || { full: 0, empty: 0, damaged: 0 }),
        [field]: value
      }
    }));
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-900 p-4 md:p-8 relative">
      {/* Mobile-Friendly Frosted Header */}
      <header className="glass-panel p-4 md:p-6 mb-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Driver Co-Pilot</h1>
            <span className="text-xs font-black uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-1 rounded-lg">
              Water Run
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-600 flex items-center gap-2">
            <span className="font-black text-slate-900">{vehicleDisplay}</span>
            <span>•</span>
            <span className="font-bold text-slate-700">{routeDisplay}</span>
            {assignmentStatus === "PENDING" && (
              <span className="bg-amber-100 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                Pending Dispatch
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          <div className="bg-white/90 border border-slate-200/80 px-4 py-2.5 rounded-2xl text-xs font-black shadow-xs flex items-center gap-2 flex-1 sm:flex-initial justify-center">
            <Package className="w-4 h-4 text-primary" />
            <span className="text-slate-800">
              Van Stock: <span className="text-primary text-sm font-black">{currentStock}</span>/{initialStock}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {assignmentStatus === "UNASSIGNED" ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 glass-panel max-w-lg mx-auto">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-4">
            <Truck className="w-10 h-10 animate-bounce" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">No Active Route Assigned</h2>
          <p className="text-slate-500 font-medium text-sm max-w-sm mb-4 leading-relaxed">
            You currently have no scheduled delivery route. Please wait for the hub dispatcher to assign your vehicle.
          </p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
          {/* Left Side: Route Stops */}
          <div className={`flex-1 ${activeClient ? "hidden md:block" : "block"}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-base text-slate-800 flex items-center gap-2">
                <MapPin className="text-primary w-4 h-4" /> Today&apos;s Route Stops
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAddClientOpen(true)}
                  className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-emerald-100 transition-all border border-emerald-200 active:scale-95 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> <span>Add Client</span>
                </button>
              </div>
            </div>

            {/* Daily Work Summary Card */}
            <div className="glass-card p-5 mb-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Daily Route Progress
                </span>
                <span className="text-xs font-black bg-white/10 px-2.5 py-1 rounded-lg text-emerald-300">
                  Live Sync
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-2xl sm:text-3xl font-black">{clients.filter(c => (c as any).isCompleted).length}</p>
                  <p className="text-xs sm:text-sm text-slate-200 font-bold">Stops Completed</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-2xl sm:text-3xl font-black">
                    {clients.reduce((acc, c) => acc + ((c as any).deliveredCount || 0), 0)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-200 font-bold">Bottles Handed Off</p>
                </div>
              </div>
            </div>

            {/* Stops Directory */}
            <div className="space-y-3.5">
              {clients.map(c => {
                const isCompleted = (c as any).isCompleted;
                return (
                  <div
                    key={c.id}
                    className={`glass-card p-4 transition-all duration-300 ${
                      isCompleted
                        ? "border-emerald-200/60 bg-emerald-50/20 opacity-70"
                        : activeClient === c.id
                        ? "border-primary ring-2 ring-primary/20 shadow-md"
                        : "border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className={`font-black text-base ${isCompleted ? "text-emerald-800" : "text-slate-800"}`}>
                          {c.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 font-semibold flex items-center gap-1.5 mt-1">
                          <MapPin className="w-4 h-4 text-slate-500 shrink-0" /> {c.address || "Local address"}
                        </p>
                      </div>
                      {isCompleted && (
                        <span className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </span>
                      )}
                    </div>

                    {!isCompleted && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={(e) => handleCallClient(e, c.name, c.phone)}
                          className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                            c.phone
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                              : "bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100"
                          }`}
                          title={c.phone ? `Call ${c.name} (${c.phone})` : "No phone number registered"}
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Call</span>
                        </button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${
                            c.latitude && c.longitude ? `${c.latitude},${c.longitude}` : encodeURIComponent(c.address || c.name || "")
                          }`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-[1.2] py-2 bg-sky-50 border border-sky-100 rounded-xl text-xs font-black flex items-center justify-center gap-1 text-sky-700 hover:bg-sky-100 transition-all active:scale-95"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Maps
                        </a>
                        <button
                          type="button"
                          onClick={() => handleStartDelivery(c.id)}
                          className={`flex-[1.5] py-2 rounded-xl text-xs font-black transition-all active:scale-95 ${
                            activeClient === c.id
                              ? "bg-primary text-white shadow-xs"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {activeClient === c.id ? "Delivering..." : "Deliver"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Active Delivery Station */}
          {activeClient && clientDetails && (
            <div className="flex-1 md:max-w-md lg:max-w-lg md:sticky top-8 self-start">
              {step === 1 && (
                <div className="glass-panel p-6 shadow-md border-slate-100">
                  <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-lg mb-1 inline-block">
                        Active Stop
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900">{clientDetails.name}</h2>
                      {clientDetails.address && (
                        <p className="text-xs text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {clientDetails.address}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setActiveClient(null)}
                      className="md:hidden text-xs font-black text-slate-500 hover:text-slate-800 px-2.5 py-1"
                    >
                      Close
                    </button>
                  </div>

                  {/* Active Stop Quick Actions: Call & Map Navigation */}
                  <div className="flex gap-2.5 mb-5">
                    <button
                      type="button"
                      onClick={(e) => handleCallClient(e, clientDetails.name, clientDetails.phone)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 ${
                        clientDetails.phone
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-slate-100 border border-slate-200 text-slate-400"
                      }`}
                    >
                      <Phone className="w-4 h-4 shrink-0" />
                      <span>{clientDetails.phone ? `Call ${clientDetails.phone}` : "No Phone Listed"}</span>
                    </button>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${
                        clientDetails.latitude && clientDetails.longitude
                          ? `${clientDetails.latitude},${clientDetails.longitude}`
                          : encodeURIComponent(clientDetails.address || clientDetails.name || "")
                      }`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2.5 px-3.5 bg-sky-50 hover:bg-sky-100 border border-sky-100 rounded-xl text-xs font-black text-sky-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Maps</span>
                    </a>
                  </div>

                  {/* Client Info Pill */}
                  <div className="bg-sky-50/70 border border-sky-100 p-3.5 rounded-2xl mb-5 flex justify-between items-center text-xs sm:text-sm">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-sky-800 block mb-0.5">Tier</span>
                      <span className="font-black text-slate-900">{clientDetails.tier || "Standard"}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black uppercase tracking-wider text-sky-800 block mb-0.5">Reward Points</span>
                      <span className="font-black text-slate-900">{clientDetails.loyalty_points || 0} Pts</span>
                    </div>
                  </div>

                  {/* Product Selector */}
                  {activeAllocations.length > 0 && (
                    <div className="mb-5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                        Delivering Product
                      </label>
                      <select
                        value={selectedInventoryId}
                        onChange={e => setSelectedInventoryId(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-sm cursor-pointer shadow-xs"
                      >
                        {activeAllocations.map(alloc => {
                          const inv = inventoryTypes.find(i => i.id === alloc.inventory_type_id);
                          return (
                            <option key={alloc.inventory_type_id} value={alloc.inventory_type_id}>
                              {inv?.name || "Product"} (In Van: {alloc.allocated_count})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Quantity Steppers */}
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
                      <div>
                        <p className="font-black text-sm text-sky-700">Full Handed Over</p>
                        <p className="text-[11px] text-slate-400 font-medium">Bottles delivered</p>
                      </div>
                      <Counter value={currentDelivery.full} setValue={val => updateCurrentDelivery("full", val)} />
                    </div>

                    <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
                      <div>
                        <p className="font-black text-sm text-emerald-700">Empty Collected</p>
                        <p className="text-[11px] text-slate-400 font-medium">Empty return retrieved</p>
                      </div>
                      <Counter value={currentDelivery.empty} setValue={val => updateCurrentDelivery("empty", val)} />
                    </div>

                    <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
                      <div>
                        <p className="font-black text-sm text-rose-600">Damaged / Cullet</p>
                        <p className="text-[11px] text-slate-400 font-medium">Cracked or lost cans</p>
                      </div>
                      <Counter value={currentDelivery.damaged} setValue={val => updateCurrentDelivery("damaged", val)} />
                    </div>
                  </div>

                  {/* Bill & Actions */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex justify-between items-center mb-2 px-1">
                      <span className="text-slate-400 text-xs font-black uppercase tracking-wider">Subtotal Due</span>
                      <span className="text-3xl font-black text-slate-800">₹{totalAmount}</span>
                    </div>

                    <Button
                      variant="primary"
                      fullWidth
                      className="py-3.5 text-base font-black shadow-md"
                      onClick={() => setStep(2)}
                      disabled={!Object.values(deliveryItems).some(c => c.full > 0 || c.empty > 0)}
                    >
                      Proceed to Collect ₹{totalAmount}
                    </Button>
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => {
                        setDeliveryItems({});
                        handlePayment("Skipped");
                      }}
                    >
                      Skip (Customer Not Available)
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="glass-panel p-6 shadow-md border-slate-100 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Collect Payment
                  </span>
                  <h2 className="text-4xl font-black text-slate-800 mb-1">₹{totalAmount}</h2>
                  <p className="text-slate-500 font-bold text-xs mb-4">{clientDetails.name}</p>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                      onClick={() => handlePayment("Cash")}
                      className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center gap-2 hover:border-emerald-500 hover:bg-emerald-50/20 active:scale-95 transition-all"
                    >
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
                        <IndianRupee className="w-6 h-6" />
                      </div>
                      <span className="font-black text-slate-800 text-sm">Cash</span>
                    </button>

                    <button
                      onClick={() => handlePayment("Razorpay QR")}
                      className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center gap-2 hover:border-sky-500 hover:bg-sky-50/20 active:scale-95 transition-all"
                    >
                      <div className="w-12 h-12 bg-sky-100 text-sky-700 rounded-2xl flex items-center justify-center">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <span className="font-black text-slate-800 text-sm">UPI / QR</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setStep(1)}
                    className="text-xs font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ← Back to quantities
                  </button>
                </div>
              )}
            </div>
          )}

          {!activeClient && (
            <div className="hidden md:flex flex-1 items-center justify-center glass-panel border-dashed border-slate-200 min-h-[300px]">
              <div className="text-center p-8">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">Select a stop from the left column to begin delivery.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Client Modal */}
      <Modal isOpen={isAddClientOpen} onClose={() => setIsAddClientOpen(false)} title="Register Client on Route">
        <form onSubmit={handleAddClient} className="space-y-4">
          <div className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/90 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl shrink-0 ${
                  gpsAccuracy !== null && gpsAccuracy <= 15
                    ? "bg-emerald-100 text-emerald-700"
                    : isLocating
                    ? "bg-sky-100 text-sky-700 animate-pulse"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  <Crosshair className={`w-4 h-4 ${isLocating ? "animate-spin" : ""}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-slate-800">
                      {gpsLocation ? `${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}` : "Detecting GPS..."}
                    </span>
                    {gpsAccuracy !== null && (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                        gpsAccuracy <= 15
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        ±{gpsAccuracy}m
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">{gpsStatus}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={startGpsAcquisition}
                disabled={isLocating}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50 shrink-0"
                title="Refetch High-Accuracy GPS"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLocating ? "animate-spin text-primary" : ""}`} />
                <span className="text-[11px]">Refetch</span>
              </button>
            </div>

            {gpsLocation && (
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> High Precision Confirmed
                </span>
                <a
                  href={`https://www.google.com/maps?q=${gpsLocation.lat},${gpsLocation.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> Verify on Maps
                </a>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Client / Store Name *
            </label>
            <input
              type="text"
              required
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-sm"
              placeholder="e.g. Cafe Blue Express"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={newClientPhone}
                onChange={e => setNewClientPhone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-sm"
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Pricing Tier
              </label>
              {(() => {
                const mainBottle = inventoryTypes.find((i: any) => i.name.toLowerCase().includes("20l")) || inventoryTypes[0];
                return (
                  <select
                    value={newClientTier}
                    onChange={e => setNewClientTier(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-sm cursor-pointer"
                  >
                    <option value="Standard">
                      Standard Rate {mainBottle ? `(₹${mainBottle.price} on 20L)` : "(Retail)"}
                    </option>
                    <option value="Wholesale">
                      Wholesale Discount {mainBottle ? `(₹${mainBottle.wholesale_price} on 20L)` : "(Bulk)"}
                    </option>
                    <option value="Premium">
                      Premium VIP Contract {mainBottle ? `(₹${mainBottle.premium_price} on 20L)` : "(VIP)"}
                    </option>
                  </select>
                );
              })()}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Address / Landmark
            </label>
            <input
              type="text"
              value={newClientAddress}
              onChange={e => setNewClientAddress(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-sm"
              placeholder="Shop #12, Phase 1"
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsAddClientOpen(false)} type="button" fullWidth>
              Cancel
            </Button>
            <Button variant="primary" type="submit" fullWidth disabled={isAddingClient || !newClientName}>
              {isAddingClient ? "Saving..." : "Save Client"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Counter({ value, setValue }: { value: number; setValue: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-2xl border border-slate-100">
      <button
        onClick={() => setValue(Math.max(0, value - 1))}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-xs border border-slate-200/80 hover:bg-slate-50 active:scale-95 transition-all text-slate-800"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-6 text-center font-black text-lg text-slate-800">{value}</span>
      <button
        onClick={() => setValue(value + 1)}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary text-white shadow-xs hover:bg-sky-600 active:scale-95 transition-all"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
