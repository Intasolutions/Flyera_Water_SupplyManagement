"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/StoreContext";
import { getClients, Client as ApiClient, getAssignments, getRoutes, createDelivery, getInventoryTypes, getCurrentUser, getVehicles, createClient } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";
import { 
  MapPin, Phone, Package, CheckCircle2, IndianRupee, Minus, Plus, QrCode, AlertTriangle, Navigation, Route
} from "lucide-react";

export default function DriverApp() {
  const { completeDelivery, assignments: mockAssignments } = useStore();
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [activeClient, setActiveClient] = useState<string | null>(null);
  
  const [step, setStep] = useState(1); // 1: Delivery Details, 2: Payment
  
  // Maps inventory_type_id -> { full, empty, damaged }
  const [deliveryItems, setDeliveryItems] = useState<Record<string, { full: number, empty: number, damaged: number }>>({});
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>("");
  const [activeAllocations, setActiveAllocations] = useState<any[]>([]);

  // Mock initial stock (in a full app, this would be fetched from the Assignment API)
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
  const [gpsLocation, setGpsLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>("Waiting for GPS...");
  
  const [vehicleDisplay, setVehicleDisplay] = useState("No Vehicle Assigned");
  const [routeDisplay, setRouteDisplay] = useState("No Route");
  const [assignmentStatus, setAssignmentStatus] = useState<string | null>(null);

  useEffect(() => {
    // Fetch assignments, clients, routes and inventory in parallel
    Promise.all([getAssignments(), getClients(), getRoutes(), getInventoryTypes(), getCurrentUser(), getVehicles()])
      .then(([assignments, allClients, allRoutes, invTypes, user, allVehicles]) => {
        setInventoryTypes(invTypes);
        
        // Find assignment for current driver
        let active = assignments.find(a => a.status === "ACTIVE" && a.driver_id === user.id);
        
        // Fallback to PENDING if not ACTIVE yet
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

          // Filter clients by the assigned route and sync deliveries
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
          // No active or pending assignment found for this driver
          setAssignmentStatus("UNASSIGNED");
          setClients([]);
          setInitialStock(0);
          setCurrentStock(0);
        }
      })
      .catch(console.error);
  }, []); // REMOVED mockAssignments dependency so it stops flickering!

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
        // Fallback for mock demo without real assignment
        completeDelivery("mock_assignment_id", activeClient, itemsPayload[0]?.delivered_full || 0, totalAmount, method);
      }
      
      const totalFullDelivered = itemsPayload.reduce((sum, item) => sum + item.delivered_full, 0);

      // Update local state to immediately show completion checkmark and reduce stock
      setClients(prev => prev.map(c => 
        c.id === activeClient ? { ...c, isCompleted: true, deliveredCount: totalFullDelivered } as any : c
      ));
      
      setCurrentStock(prev => Math.max(0, prev - totalFullDelivered));
    }
    setActiveClient(null);
  };

  useEffect(() => {
    if (isAddClientOpen) {
      setGpsLocation(null);
      setGpsStatus("Locating you...");
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setGpsLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
            setGpsStatus(`GPS Locked (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`);
          },
          (error) => {
            console.warn("Geolocation error", error);
            setGpsStatus("GPS Failed (Will save without map pin)");
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      } else {
        setGpsStatus("GPS not supported by browser");
      }
    }
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
      toast.success("Client added successfully!");
    } catch (err) {
      console.error("Failed to create client", err);
      toast.error("Failed to add client. Try again.");
    } finally {
      setIsAddingClient(false);
    }
  };

  const clientDetails = clients.find(c => c.id === activeClient);

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
  const updateCurrentDelivery = (field: 'full' | 'empty' | 'damaged', value: number) => {
    setDeliveryItems(prev => ({
      ...prev,
      [selectedInventoryId]: {
        ...(prev[selectedInventoryId] || { full: 0, empty: 0, damaged: 0 }),
        [field]: value
      }
    }));
  };

  return (
    <div className="min-h-screen bg-background text-text p-4 md:p-8 relative">
      <header className="flex justify-between items-center mb-6 pt-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Driver Interface</h1>
          <p className="text-sm text-text-muted font-medium flex items-center gap-2">
            {vehicleDisplay} • {routeDisplay}
            {assignmentStatus === 'PENDING' && (
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Pending Dispatch
              </span>
            )}
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm border border-black/5 flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <span>Stock: {currentStock}/{initialStock}</span>
        </div>
      </header>

      {/* TABLET SPLIT SCREEN LAYOUT */}
      {assignmentStatus === 'UNASSIGNED' ? (
        <div className="flex flex-col items-center justify-center pt-24 pb-12 animate-in fade-in zoom-in duration-500 text-center px-4">
          <div className="relative mb-8 mt-12">
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse"></div>
            <div className="w-32 h-32 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex items-center justify-center relative z-10 border border-black/5 mx-auto">
              <MapPin className="w-14 h-14 text-primary opacity-20 absolute" />
              <MapPin className="w-14 h-14 text-primary translate-y-[-10px] animate-bounce" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-3">No Route Assigned</h2>
          <p className="text-slate-500 font-medium text-lg max-w-sm">
            You currently have no active route. Sit back and relax while the dispatcher assigns your next journey.
          </p>
        </div>
      ) : (
      <div className="flex flex-col md:flex-row gap-6 animate-in fade-in duration-300">
        
        {/* Left Side: Route List */}
        <div className={`flex-1 ${activeClient ? 'hidden md:block' : 'block'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <MapPin className="text-primary w-5 h-5" /> Today's Stops
            </h2>
            <div className="flex gap-2">
              <button onClick={() => setIsAddClientOpen(true)} className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 md:px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-100 transition-colors active:scale-95 border border-emerald-200">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Client</span>
              </button>
              <button className="text-sm font-bold text-primary bg-primary/10 px-3 md:px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-primary/20 transition-colors active:scale-95">
                <Route className="w-4 h-4" /> <span className="hidden sm:inline">Optimize</span>
              </button>
            </div>
          </div>

          {/* Daily Work Summary Box */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl p-5 text-white mb-6 shadow-[0_8px_20px_rgba(37,99,235,0.2)]">
            <h3 className="font-bold text-sm text-blue-100 uppercase tracking-wider mb-4">Daily Work Summary</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-3xl font-black">{clients.filter(c => (c as any).isCompleted).length}</p>
                <p className="text-sm text-blue-200 font-medium">Completed Stops</p>
              </div>
              <div className="w-px bg-white/20"></div>
              <div className="flex-1">
                <p className="text-3xl font-black">
                  {clients.reduce((acc, c) => acc + ((c as any).deliveredCount || 0), 0)}
                </p>
                <p className="text-sm text-blue-200 font-medium">Bottles Delivered</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {clients.map(c => {
              const isCompleted = (c as any).isCompleted;
              return (
                <div key={c.id} className={`bg-white p-5 rounded-3xl border shadow-sm transition-all ${isCompleted ? 'border-emerald-200 bg-emerald-50/30 opacity-60' : activeClient === c.id ? 'border-primary shadow-md shadow-primary/10' : 'border-black/5 hover:border-primary/30'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className={`font-bold text-lg ${isCompleted ? 'text-emerald-700' : 'text-text'}`}>{c.name}</h3>
                      <p className="text-xs text-text-muted font-medium flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {c.address}
                      </p>
                    </div>
                    {isCompleted && <CheckCircle2 className="w-7 h-7 text-emerald-500" />}
                  </div>
                  {!isCompleted && (
                    <div className="flex gap-2 mt-4">
                      <button className="flex-1 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 hover:bg-gray-100 text-text transition-colors">
                        <Phone className="w-4 h-4" /> <span className="hidden sm:inline">Call</span>
                      </button>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude && c.longitude ? `${c.latitude},${c.longitude}` : encodeURIComponent(c.address || c.name || "")}`} target="_blank" rel="noreferrer" className="flex-[1.5] py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 hover:bg-blue-100 text-blue-700 transition-colors">
                        <Navigation className="w-4 h-4" /> Navigate
                      </a>
                      <button 
                        onClick={() => handleStartDelivery(c.id)}
                        className={`flex-[1.5] py-2 rounded-xl text-sm font-bold transition-colors ${activeClient === c.id ? 'bg-primary text-white shadow-sm' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                      >
                        {activeClient === c.id ? 'Selected' : 'Deliver'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Active Delivery Details */}
        {activeClient && clientDetails && (
          <div className="flex-1 md:max-w-md lg:max-w-lg md:sticky top-8 self-start">
            
            {step === 1 && (
              <div className="bg-white p-6 rounded-3xl shadow-lg border border-black/5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">{clientDetails.name}</h2>
                  <button onClick={() => setActiveClient(null)} className="md:hidden text-text-muted">Close</button>
                </div>

                {/* Client History & Plan */}
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl mb-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Billing Plan</p>
                      <p className="text-sm font-medium text-slate-700">{clientDetails.tier || 'Standard'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 text-right">Loyalty Points</p>
                      <p className="text-sm font-medium text-slate-700 text-right">{clientDetails.loyalty_points} Pts</p>
                    </div>
                  </div>
                </div>
                
                {activeAllocations.length > 0 && (
                  <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Select Product to Deliver</label>
                    <div className="relative">
                      <Package className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none" />
                      <select 
                        value={selectedInventoryId}
                        onChange={(e) => setSelectedInventoryId(e.target.value)}
                        className="w-full border border-gray-200 py-3 pl-10 pr-4 rounded-xl bg-white font-bold text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer"
                      >
                        {activeAllocations.map(alloc => {
                          const inv = inventoryTypes.find(i => i.id === alloc.inventory_type_id);
                          return (
                            <option key={alloc.inventory_type_id} value={alloc.inventory_type_id}>
                              {inv?.name || "Unknown Product"} (Stock: {alloc.allocated_count})
                            </option>
                          );
                        })}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
                    </div>
                  </div>
                )}

                {/* Selected Items Summary */}
                {Object.entries(deliveryItems).some(([_, counts]) => counts.full > 0 || counts.empty > 0) && (
                  <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-3 animate-in fade-in duration-300">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cart Summary</p>
                    <div className="space-y-2">
                      {Object.entries(deliveryItems).map(([invId, counts]) => {
                        if (counts.full === 0 && counts.empty === 0) return null;
                        const inv = inventoryTypes.find(i => i.id === invId);
                        return (
                          <div key={invId} className="flex justify-between items-center text-sm font-medium bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                            <span className="text-slate-800">{inv?.name}</span>
                            <div className="flex gap-3 text-xs">
                              {counts.full > 0 && <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">{counts.full} Full</span>}
                              {counts.empty > 0 && <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">{counts.empty} Empty</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-lg text-blue-600">Full Given</p>
                      <p className="text-xs text-text-muted font-medium">Bottles delivered</p>
                    </div>
                    <Counter value={currentDelivery.full} setValue={(val) => updateCurrentDelivery('full', val)} />
                  </div>
                  
                  <div className="h-px bg-gray-100 w-full" />

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-lg text-emerald-600">Empty Taken</p>
                      <p className="text-xs text-text-muted font-medium">Bottles retrieved</p>
                    </div>
                    <Counter value={currentDelivery.empty} setValue={(val) => updateCurrentDelivery('empty', val)} />
                  </div>

                  <div className="h-px bg-gray-100 w-full" />

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-lg text-red-500">Damaged/Missing</p>
                      <p className="text-xs text-text-muted font-medium">Report broken cans</p>
                    </div>
                    <Counter value={currentDelivery.damaged} setValue={(val) => updateCurrentDelivery('damaged', val)} />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
                  <div className="flex justify-between items-center mb-4 px-2">
                    <span className="text-text-muted font-medium">Total Amount</span>
                    <span className="text-4xl font-black text-text">₹{totalAmount}</span>
                  </div>
                  <Button 
                    variant="primary"
                    fullWidth
                    className="py-4 text-lg"
                    onClick={() => setStep(2)}
                    disabled={!Object.values(deliveryItems).some(c => c.full > 0 || c.empty > 0)}
                  >
                    Proceed to Payment
                  </Button>
                  <Button 
                    variant="outline"
                    fullWidth
                    onClick={() => {
                      setDeliveryItems({});
                      handlePayment("Skipped");
                    }}
                  >
                    Skip (Not needed today)
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border border-black/5 text-center animate-in fade-in slide-in-from-right-8 duration-300">
                <h2 className="text-5xl font-black mb-3 text-text">₹{totalAmount}</h2>
                <p className="text-text-muted font-medium">{clientDetails.name}</p>
                <div className="mt-6 mb-8 inline-block bg-amber-50 text-amber-600 border border-amber-200 px-4 py-2 rounded-full text-sm font-bold shadow-sm">
                  + {totalFullDelivered * 5} Loyalty Points Earned!
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mb-6">
                  <button onClick={() => handlePayment("Cash")} className="bg-gray-50 p-6 rounded-3xl flex flex-col items-center gap-4 border border-black/5 active:scale-95 hover:border-emerald-500/50 hover:bg-emerald-50/30 transition-all">
                    <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
                      <IndianRupee className="w-7 h-7 text-emerald-600" />
                    </div>
                    <span className="font-bold text-text">Cash</span>
                  </button>
                  
                  <button onClick={() => handlePayment("Razorpay QR")} className="bg-gray-50 p-6 rounded-3xl flex flex-col items-center gap-4 border border-black/5 active:scale-95 hover:border-blue-500/50 hover:bg-blue-50/30 transition-all">
                    <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                      <QrCode className="w-7 h-7 text-blue-600" />
                    </div>
                    <span className="font-bold text-text">Razorpay QR</span>
                  </button>
                </div>

                <button onClick={() => setStep(1)} className="text-text-muted font-medium hover:text-text transition-colors py-2 px-6">
                  Back
                </button>
              </div>
            )}

          </div>
        )}
        
        {/* Placeholder if nothing selected on Tablet */}
        {!activeClient && (
          <div className="hidden md:flex flex-1 items-center justify-center bg-white/50 rounded-3xl border border-black/5 border-dashed">
            <div className="text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-text-muted">Select a route stop to begin delivery.</p>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Add Client Modal */}
      <Modal isOpen={isAddClientOpen} onClose={() => setIsAddClientOpen(false)} title="Add New Client">
        <form onSubmit={handleAddClient} className="space-y-5">
          <div className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${gpsLocation ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            <MapPin className={`w-5 h-5 shrink-0 ${gpsLocation ? 'text-emerald-500' : 'text-amber-500 animate-pulse'}`} />
            <div>
              <p className="text-sm font-bold">{gpsStatus}</p>
              <p className="text-xs opacity-80 mt-0.5">
                {gpsLocation ? "This location will be saved for the client's map pin." : "Please wait while we acquire your GPS signal."}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-text mb-1">Store / Client Name *</label>
              <input 
                type="text" 
                required
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary transition-all font-medium" 
                placeholder="E.g. Fresh Bites Cafe"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-text mb-1">Phone Number (Optional)</label>
              <input 
                type="tel" 
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary transition-all font-medium" 
                placeholder="10 digit mobile number"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-text mb-1">Full Address (Optional)</label>
            <input 
              type="text" 
              value={newClientAddress}
              onChange={(e) => setNewClientAddress(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary transition-all font-medium" 
              placeholder="e.g. Shop 42, Main Road, Block C"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-text mb-1">Pricing Tier</label>
              <select 
                value={newClientTier}
                onChange={(e) => setNewClientTier(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary transition-all font-medium cursor-pointer"
              >
                <option value="Standard">Standard (₹80/20L)</option>
                <option value="Wholesale">Wholesale (₹65/20L)</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input 
                type="checkbox" 
                checked={newClientOptIn}
                onChange={(e) => setNewClientOptIn(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <span className="font-bold text-sm text-text select-none cursor-pointer" onClick={() => setNewClientOptIn(!newClientOptIn)}>
                Opt-in to Loyalty
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
            <Button variant="secondary" onClick={() => setIsAddClientOpen(false)} type="button" fullWidth>Cancel</Button>
            <Button variant="primary" type="submit" fullWidth disabled={isAddingClient || !newClientName}>
              {isAddingClient ? 'Saving Client...' : 'Save Client & GPS'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

function Counter({ value, setValue }: { value: number, setValue: (v: number) => void }) {
  return (
    <div className="flex items-center gap-4 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
      <button 
        onClick={() => setValue(Math.max(0, value - 1))}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white shadow-sm border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all text-text"
      >
        <Minus className="w-5 h-5" />
      </button>
      <span className="w-6 text-center font-black text-xl text-text">{value}</span>
      <button 
        onClick={() => setValue(value + 1)}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary shadow-sm shadow-primary/20 text-white hover:bg-blue-700 active:scale-95 transition-all"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}
