"use client";

import { useState, useEffect } from "react";

import { useStore, GlassCollection } from "@/lib/StoreContext";
import { Recycle, CheckCircle, IndianRupee, UserPlus, Users } from "lucide-react";
import { getCurrentUser, getVehicles, User, Vehicle } from "@/lib/api";

export default function GlassDriverPage() {
  const { glassCollections, addGlassCollection, dropGlassAtGodown, dropAllGlassAtGodown, clients, addClient } = useStore();
  
  const [isNewClient, setIsNewClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentVehicle, setCurrentVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    Promise.all([getCurrentUser(), getVehicles()]).then(([user, vehicles]) => {
      setCurrentUser(user);
      if (user.assigned_vehicle_id) {
        const v = vehicles.find((veh: Vehicle) => veh.id === user.assigned_vehicle_id);
        setCurrentVehicle(v || null);
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

      // Add as a new global client so they appear in dropdowns next time
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

    const newCollection: GlassCollection = {
      id: Date.now().toString(),
      driverId: currentUser?.id || "unknown", 
      driverName: currentUser?.name || "Unknown Driver", 
      vehicle: currentVehicle ? `${currentVehicle.model || 'Vehicle'} (${currentVehicle.plate_number})` : "Unassigned Vehicle",
      property: finalPropertyName,
      location: finalLocation,
      phone: finalPhone,
      tonsCollected: parseFloat(tons),
      paymentAmount: parseFloat(payment) || 0,
      status: "collected",
      date: new Date().toISOString()
    };

    addGlassCollection(newCollection);
    
    // Reset form
    setSelectedClientId("");
    setNewClientName("");
    setNewLocation("");
    setNewPhone("");
    setTons("");
    setPayment("");
  };

  const activeCollections = glassCollections.filter(c => c.status === "collected");

  return (
    <div className="min-h-screen bg-background text-text pb-24 md:p-8 relative">
      <header className="bg-gradient-to-r from-emerald-600 to-teal-500 shadow-lg p-5 sticky top-0 z-10 text-white rounded-b-3xl">
        <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2 drop-shadow-sm">
          <Recycle className="w-7 h-7 text-emerald-100" /> Glass Collections
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/10 text-emerald-50">
            🚚 {currentVehicle ? `${currentVehicle.model || 'Vehicle'} (${currentVehicle.plate_number})` : "Unassigned"}
          </div>
          <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/10 text-emerald-50">
            👤 {currentUser?.name || "Loading..."}
          </div>
        </div>
      </header>

      <div className="p-4 md:px-0 space-y-6 max-w-4xl mx-auto">
        {/* New Collection Form */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
          <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <UserPlus className="w-6 h-6 text-emerald-600" />
            </div>
            Log New Collection
          </h2>

          {/* Mode Switcher */}
          <div className="flex p-1 bg-surface border border-black/5 rounded-xl mb-6">
            <button
              onClick={() => setIsNewClient(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${!isNewClient ? 'bg-white shadow-md text-primary ring-1 ring-black/5' : 'text-text-muted hover:text-text'}`}
            >
              <Users className="w-4 h-4" />
              Existing Client
            </button>
            <button
              onClick={() => setIsNewClient(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${isNewClient ? 'bg-white shadow-md text-primary ring-1 ring-black/5' : 'text-text-muted hover:text-text'}`}
            >
              <UserPlus className="w-4 h-4" />
              New Client
            </button>
          </div>

          <form onSubmit={handleAddCollection} className="space-y-4">
            {!isNewClient ? (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">Select Client</label>
                <select
                  required
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3.5 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium appearance-none cursor-pointer"
                >
                  <option value="" disabled>-- Select a client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.address})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">Property Name</label>
                  <input 
                    type="text"
                    required
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3.5 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                    placeholder="e.g. Ocean View Resort"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">Address</label>
                  <input 
                    type="text"
                    required
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                    className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3.5 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                    placeholder="e.g. 123 Beach Road"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">Phone Number</label>
                  <input 
                    type="tel"
                    required
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3.5 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 mt-5">
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">Tons Collected</label>
              <input 
                type="number"
                step="0.1"
                required
                value={tons}
                onChange={e => setTons(e.target.value)}
                className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3.5 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-lg"
                placeholder="0.0"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 flex items-center justify-between">
                <span>Amount Paid (₹)</span>
                <span className="text-[10px] text-text-muted normal-case font-medium bg-gray-100 px-2 py-0.5 rounded-full">Optional</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <IndianRupee className="w-5 h-5 text-gray-400" />
                </div>
                <input 
                  type="number"
                  value={payment}
                  onChange={e => setPayment(e.target.value)}
                  className="w-full bg-surface border border-gray-200 rounded-xl pl-11 pr-4 py-3.5 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-lg"
                  placeholder="0"
                />
              </div>
            </div>
            
            <button 
              type="submit"
              className="w-full py-4.5 mt-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] text-white font-black text-lg rounded-2xl transition-all shadow-[0_8px_20px_0_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
            >
              <Recycle className="w-6 h-6" />
              Confirm Collection
            </button>
          </form>
        </div>

        {/* Active Collections (In Transit) */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 mt-8">
          <h2 className="text-xl font-black text-slate-800 mb-5 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-xl">
                <Recycle className="w-6 h-6 text-blue-600" />
              </div>
              In Transit Load
            </span>
            <span className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-sm">
              {activeCollections.length} stops
            </span>
          </h2>
          
          <div className="space-y-3">
            {activeCollections.length === 0 && (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center">
                <Recycle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-text-muted text-sm font-medium">Truck is empty.<br/>Log a collection above.</p>
              </div>
            )}
            {activeCollections.map(c => (
              <div key={c.id} className="p-4 bg-surface rounded-xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-text text-lg">{c.property}</p>
                  {c.location && <p className="text-sm text-text-muted mt-0.5">{c.location}</p>}
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md">
                      {c.tonsCollected} Tons
                    </span>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md">
                      Paid: ₹{c.paymentAmount}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => dropGlassAtGodown(c.id)}
                  className="w-full sm:w-auto p-3 text-success hover:bg-success/10 bg-success/5 border border-success/20 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                >
                  <CheckCircle className="w-5 h-5" />
                  Drop
                </button>
              </div>
            ))}
          </div>
          
          {activeCollections.length > 0 && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="flex justify-between items-center mb-4 px-2">
                <span className="text-sm font-bold text-text-muted uppercase tracking-wider">Total on Truck</span>
                <span className="text-2xl font-black text-text">
                  {activeCollections.reduce((acc, c) => acc + c.tonsCollected, 0).toFixed(1)} T
                </span>
              </div>
              <button 
                onClick={() => dropAllGlassAtGodown("s1")}
                className="w-full py-4.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-black text-lg rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                Drop Entire Load at Godown
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
