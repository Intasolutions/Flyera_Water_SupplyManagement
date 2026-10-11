"use client";

import { useState, useEffect } from "react";
import { useStore, GlassCollection } from "@/lib/StoreContext";
import { Recycle, CheckCircle, IndianRupee, UserPlus, Users, Truck, Sparkles, MapPin, ArrowRight } from "lucide-react";
import { 
  getCurrentUser, 
  getVehicles, 
  User, 
  Vehicle,
  createGlassCollection,
  dropoffGlassCollection,
  dropoffAllGlass,
  getGlassCollections
} from "@/lib/api";
import { toast } from "react-hot-toast";

export default function GlassDriverPage() {
  const { glassCollections, addGlassCollection, dropGlassAtGodown, dropAllGlassAtGodown, clients, addClient } = useStore();
  
  const [isNewClient, setIsNewClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentVehicle, setCurrentVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    Promise.all([
      getCurrentUser().catch(() => null),
      getVehicles().catch(() => []),
      getGlassCollections("collected").catch(() => [])
    ]).then(([user, vehicles, apiColls]) => {
      if (user) {
        setCurrentUser(user);
        if (user.assigned_vehicle_id) {
          const v = vehicles.find((veh: Vehicle) => veh.id === user.assigned_vehicle_id);
          setCurrentVehicle(v || null);
        }
      }
      if (apiColls && apiColls.length > 0) {
        apiColls.forEach((ac: any) => {
          if (!glassCollections.some(c => c.id === ac.id)) {
            addGlassCollection({
              id: ac.id,
              driverId: ac.driver_id || ac.driverId || "",
              driverName: ac.driver_name || ac.driverName || "Driver",
              vehicle: ac.vehicle || "",
              property: ac.property || "",
              location: ac.location,
              phone: ac.phone,
              tonsCollected: ac.tons_collected ?? ac.tonsCollected ?? 0,
              paymentAmount: ac.payment_amount ?? ac.paymentAmount ?? 0,
              status: ac.status || "collected",
              date: ac.date || new Date().toISOString()
            });
          }
        });
      }
    }).catch(console.error);
  }, []);
  
  // New Client Form Fields
  const [newClientName, setNewClientName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newPhone, setNewPhone] = useState("");
  
  // Shared Fields
  const [tons, setTons] = useState("");
  const [payment, setPayment] = useState("");

  const handleAddCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tons) return;

    let finalPropertyName = "";
    let finalLocation = "";
    let finalPhone = "";

    if (isNewClient) {
      if (!newClientName || !newLocation || !newPhone) return;
      finalPropertyName = newClientName;
      finalLocation = newLocation;
      finalPhone = newPhone;

      addClient({
        id: Date.now().toString(),
        name: newClientName,
        address: newLocation,
        phone: newPhone,
        tier: "Standard",
        points: 0,
        optIn: false,
        history: "New Glass Client"
      });
    } else {
      if (!selectedClientId) return;
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) return;
      finalPropertyName = client.name;
      finalLocation = client.address;
      finalPhone = client.phone;
    }

    const tonsNum = parseFloat(tons);
    const paymentNum = parseFloat(payment) || 0;

    const newCollection: GlassCollection = {
      id: Date.now().toString(),
      driverId: currentUser?.id || "unknown", 
      driverName: currentUser?.name || "Unknown Driver", 
      vehicle: currentVehicle ? `${currentVehicle.model || 'Vehicle'} (${currentVehicle.plate_number})` : "Unassigned Vehicle",
      property: finalPropertyName,
      location: finalLocation,
      phone: finalPhone,
      tonsCollected: tonsNum,
      paymentAmount: paymentNum,
      status: "collected",
      date: new Date().toISOString()
    };

    addGlassCollection(newCollection);
    
    createGlassCollection({
      driver_id: currentUser?.id,
      vehicle: currentVehicle ? `${currentVehicle.model || 'Vehicle'} (${currentVehicle.plate_number})` : "Unassigned Vehicle",
      property: finalPropertyName,
      location: finalLocation,
      phone: finalPhone,
      tons_collected: tonsNum,
      payment_amount: paymentNum
    }).then(res => {
      if (res && res.id) {
        newCollection.id = res.id;
      }
    }).catch(err => {
      console.warn("Failed to persist collection to backend:", err);
    });

    toast.success("Cullet collection logged!");
    setSelectedClientId("");
    setNewClientName("");
    setNewLocation("");
    setNewPhone("");
    setTons("");
    setPayment("");
  };

  const handleDropOne = (id: string) => {
    dropGlassAtGodown(id);
    dropoffGlassCollection(id).catch(err => {
      console.warn("Backend dropoff error:", err);
    });
    toast.success("Dropped at godown!");
  };

  const handleDropAll = () => {
    dropAllGlassAtGodown(currentUser?.id || "unknown");
    dropoffAllGlass(currentUser?.id).catch(err => {
      console.warn("Backend dropoff-all error:", err);
    });
    toast.success("Entire load dropped at godown!");
  };

  const activeCollections = glassCollections.filter(c => c.status === "collected");

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-900 pb-24 p-4 md:p-8 relative">
      {/* Frosted App Bar */}
      <header className="glass-panel p-4 md:p-6 mb-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-4xl mx-auto">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Recycle className="w-6 h-6 text-emerald-600" /> Glass Co-Pilot
            </h1>
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md">
              Intake Run
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-400 flex items-center gap-2">
            <span className="font-bold text-slate-700">
              {currentVehicle ? `${currentVehicle.model || "Vehicle"} (${currentVehicle.plate_number})` : "Unassigned Vehicle"}
            </span>
            <span>•</span>
            <span className="font-bold text-slate-700">{currentUser?.name || "Driver"}</span>
          </p>
        </div>

        <div className="bg-emerald-50/80 border border-emerald-200/80 px-4 py-2 rounded-2xl text-xs font-black text-emerald-800 shadow-xs flex items-center gap-2">
          <span>In-Transit Load:</span>
          <span className="text-sm font-black text-emerald-700">
            {activeCollections.reduce((acc, c) => acc + c.tonsCollected, 0).toFixed(1)} Tons
          </span>
        </div>
      </header>

      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Log Collection Panel */}
        <div className="glass-panel p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <Recycle className="w-5 h-5" />
              </div>
              Log Cullet Collection
            </h2>

            {/* Mode Switcher */}
            <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setIsNewClient(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  !isNewClient ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Existing Client
              </button>
              <button
                type="button"
                onClick={() => setIsNewClient(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  isNewClient ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                New Client
              </button>
            </div>
          </div>

          <form onSubmit={handleAddCollection} className="space-y-4">
            {!isNewClient ? (
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">
                  Select Registered Client / Location
                </label>
                <select
                  required
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-semibold text-sm cursor-pointer shadow-xs"
                >
                  <option value="" disabled>-- Select location --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.address})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Property / Hotel / Bar Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-semibold text-sm shadow-xs"
                    placeholder="e.g. Ocean View Lounge"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">
                      Address
                    </label>
                    <input
                      type="text"
                      required
                      value={newLocation}
                      onChange={e => setNewLocation(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-semibold text-sm shadow-xs"
                      placeholder="e.g. 102 Beach Road"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-semibold text-sm shadow-xs"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">
                  Tons Collected (T) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={tons}
                  onChange={e => setTons(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-black text-lg shadow-xs"
                  placeholder="0.0"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Payout Given (₹)</span>
                  <span className="text-[9px] text-slate-400 normal-case font-bold">Optional</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <IndianRupee className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    value={payment}
                    onChange={e => setPayment(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-3 outline-none text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-black text-lg shadow-xs"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 mt-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Recycle className="w-4 h-4" /> Confirm & Load on Vehicle
            </button>
          </form>
        </div>

        {/* Active Collections (In Transit) */}
        <div className="glass-panel p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <div className="p-2 bg-sky-50 rounded-xl text-sky-600">
                <Truck className="w-5 h-5" />
              </div>
              In-Transit Cargo Load
            </h2>
            <span className="bg-sky-50 text-sky-700 border border-sky-100 text-xs px-2.5 py-1 rounded-lg font-black">
              {activeCollections.length} Drops On-Board
            </span>
          </div>

          <div className="space-y-3">
            {activeCollections.length === 0 ? (
              <div className="bg-white/60 border border-dashed border-slate-200 rounded-2xl p-8 text-center">
                <Recycle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-xs font-bold">Truck bed is empty.<br />Log a collection above to begin intake.</p>
              </div>
            ) : (
              activeCollections.map(c => (
                <div
                  key={c.id}
                  className="p-4 bg-white rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div>
                    <p className="font-black text-slate-800 text-sm">{c.property}</p>
                    {c.location && (
                      <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {c.location}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                        {c.tonsCollected} T Cullet
                      </span>
                      <span className="text-[10px] font-black text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-md">
                        Payout: ₹{c.paymentAmount}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDropOne(c.id)}
                    className="p-2.5 text-emerald-700 hover:bg-emerald-100 bg-emerald-50 border border-emerald-200 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-black shrink-0"
                  >
                    <CheckCircle className="w-4 h-4" /> Drop at Yard
                  </button>
                </div>
              ))
            )}
          </div>

          {activeCollections.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center mb-3 px-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total Truck Weight</span>
                <span className="text-2xl font-black text-slate-800">
                  {activeCollections.reduce((acc, c) => acc + c.tonsCollected, 0).toFixed(1)} Tons
                </span>
              </div>
              <button
                onClick={handleDropAll}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Drop Entire Load at Godown Yard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
