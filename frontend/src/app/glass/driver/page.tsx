"use client";

import { useState, useEffect, useRef } from "react";
import { useStore, GlassCollection } from "@/lib/StoreContext";
import { 
  Recycle, 
  CheckCircle, 
  IndianRupee, 
  UserPlus, 
  Users, 
  Truck, 
  Sparkles, 
  MapPin, 
  ArrowRight,
  Crosshair,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Phone
} from "lucide-react";
import { 
  getCurrentUser, 
  getVehicles, 
  User, 
  Vehicle,
  createGlassCollection,
  dropoffGlassCollection,
  dropoffAllGlass,
  getGlassCollections,
  createClient
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
  
  // GPS State
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>("Ready to acquire GPS");
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);
  const bestAccuracyRef = useRef<number>(999999);

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

          // Reverse geocode to auto-fill address if not filled yet
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
                  setNewLocation(prev => prev || resolved);
                }
              }
            })
            .catch(() => {});
        }

        // High accuracy satellite fix: save battery
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
          setGpsStatus("Location permission denied. Please allow GPS.");
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

    setTimeout(() => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setIsLocating(false);
      }
    }, 12000);
  };

  useEffect(() => {
    startGpsAcquisition();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
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
      if (!newClientName) {
        toast.error("Please enter property / client name");
        return;
      }
      finalPropertyName = newClientName;
      finalLocation = newLocation || (gpsLocation ? `${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}` : "");
      finalPhone = newPhone;

      addClient({
        id: Date.now().toString(),
        name: newClientName,
        address: finalLocation,
        phone: newPhone,
        tier: "Standard",
        points: 0,
        optIn: false,
        history: "New Glass Client"
      });

      createClient({
        name: newClientName,
        address: finalLocation,
        phone: newPhone,
        tier: "Standard",
        latitude: gpsLocation?.lat,
        longitude: gpsLocation?.lng
      }).catch(err => console.warn("Failed to create client in backend:", err));
    } else {
      if (!selectedClientId) return;
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) return;
      finalPropertyName = client.name;
      finalLocation = client.address || (gpsLocation ? `${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}` : "");
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
      latitude: gpsLocation?.lat,
      longitude: gpsLocation?.lng,
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
      latitude: gpsLocation?.lat,
      longitude: gpsLocation?.lng,
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
            {/* Live Auto-GPS Acquisition Card */}
            <div className="p-3.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 space-y-2">
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
                        {gpsLocation ? `${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}` : "Detecting live GPS..."}
                      </span>
                      {gpsAccuracy !== null && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                          gpsAccuracy <= 15
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          ±{gpsAccuracy}m precision
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
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50 shrink-0 shadow-2xs"
                  title="Refetch High-Accuracy GPS"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLocating ? "animate-spin text-emerald-600" : ""}`} />
                  <span className="text-[11px]">Refetch</span>
                </button>
              </div>

              {gpsLocation && (
                <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Coordinates Auto-Saved on Submission
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${gpsLocation.lat},${gpsLocation.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Preview Pin on Maps
                  </a>
                </div>
              )}
            </div>
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
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Address / Pickup Location
                      </label>
                      {gpsLocation && (
                        <button
                          type="button"
                          onClick={() => {
                            if (gpsLocation) {
                              setNewLocation(`${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}`);
                            }
                          }}
                          className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        >
                          <Crosshair className="w-3 h-3" /> Use GPS Pin
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={newLocation}
                      onChange={e => setNewLocation(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-semibold text-sm shadow-xs"
                      placeholder={gpsLocation ? `e.g. ${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)} or Street Address` : "e.g. 102 Beach Road"}
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
                      <a
                        href={`https://www.google.com/maps?q=${
                          c.latitude && c.longitude ? `${c.latitude},${c.longitude}` : encodeURIComponent(c.location)
                        }`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-500 hover:text-emerald-700 font-medium flex items-center gap-1 mt-0.5 hover:underline"
                        title="Open collection location in Google Maps"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> {c.location}
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                    {c.phone && (
                      <button
                        type="button"
                        onClick={() => {
                          const clean = c.phone?.replace(/[^0-9+*#]/g, "");
                          if (clean) window.location.href = `tel:${clean}`;
                        }}
                        className="text-xs text-slate-500 hover:text-emerald-700 font-bold flex items-center gap-1 mt-1 hover:underline"
                        title={`Call ${c.phone}`}
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{c.phone}</span>
                      </button>
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
