"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  Phone,
  Navigation,
  LogOut,
  Building2,
  Clock,
  ChevronRight,
  Check,
  AlertTriangle,
  Map,
  Plus
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
  getGlassAssignments,
  completeGlassAssignment,
  GlassAssignment,
  getGlassProperties,
  GlassProperty,
  createGlassProperty
} from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function GlassDriverPage() {
  const { glassCollections, addGlassCollection, dropGlassAtGodown } = useStore();
  const confirm = useConfirm();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<GlassAssignment | null>(null);
  const [routeProperties, setRouteProperties] = useState<GlassProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active run collection modal
  const [selectedProperty, setSelectedProperty] = useState<GlassProperty | null>(null);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [tonsInput, setTonsInput] = useState("");
  const [paymentInput, setPaymentInput] = useState("0");
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);

  // Ad-hoc Unscheduled Stop Modal
  const [adhocModalOpen, setAdhocModalOpen] = useState(false);
  const [adhocName, setAdhocName] = useState("");
  const [adhocAddress, setAdhocAddress] = useState("");
  const [adhocPhone, setAdhocPhone] = useState("");
  const [adhocCategory, setAdhocCategory] = useState("Hotel & Resort");

  // GPS State
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>("Ready to acquire GPS");
  const [isLocating, setIsLocating] = useState<boolean>(false);

  const startGpsAcquisition = () => {
    if (!("geolocation" in navigator)) {
      setGpsStatus("GPS not supported");
      return;
    }
    setIsLocating(true);
    setGpsStatus("Locking high-precision GPS...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsLocation({ lat: latitude, lng: longitude });
        setGpsAccuracy(Math.round(accuracy));
        setIsLocating(false);
        setGpsStatus(`GPS Locked (±${Math.round(accuracy)}m)`);
      },
      (err) => {
        setIsLocating(false);
        setGpsStatus("GPS acquisition timed out");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const loadDriverData = async () => {
    try {
      setIsRefreshing(true);
      const [user, assignmentsData, collsData] = await Promise.all([
        getCurrentUser().catch(() => null),
        getGlassAssignments("ACTIVE").catch(() => []),
        getGlassCollections("collected").catch(() => [])
      ]);

      if (user) {
        setCurrentUser(user);
      }

      // Sync local collections store
      if (collsData && collsData.length > 0) {
        collsData.forEach((ac: any) => {
          if (!glassCollections.some(c => c.id === ac.id)) {
            addGlassCollection({
              id: ac.id,
              driverId: ac.driver_id || ac.driverId || "",
              driverName: ac.driver_name || ac.driverName || "Driver",
              vehicle: ac.vehicle || "",
              property: ac.property || "",
              property_id: ac.property_id || ac.propertyId,
              assignment_id: ac.assignment_id || ac.assignmentId,
              location: ac.location,
              latitude: ac.latitude,
              longitude: ac.longitude,
              phone: ac.phone,
              tonsCollected: ac.tons_collected ?? ac.tonsCollected ?? 0,
              paymentAmount: ac.payment_amount ?? ac.paymentAmount ?? 0,
              status: ac.status || "collected",
              date: ac.date || new Date().toISOString()
            });
          }
        });
      }

      // Find active assignment for this driver (or any active run for admin/demo)
      let activeRun = assignmentsData.find(
        (a: GlassAssignment) => a.driver_id === user?.id || (a as any).driverId === user?.id
      );
      if (!activeRun && (user?.role === "ADMIN" || !activeRun)) {
        activeRun = assignmentsData[0] || null;
      }

      setActiveAssignment(activeRun || null);

      if (activeRun && (activeRun.route_id || activeRun.routeId)) {
        const routeId = activeRun.route_id || activeRun.routeId || undefined;
        const props = await getGlassProperties(routeId);
        setRouteProperties(props || []);
      } else {
        setRouteProperties([]);
      }
    } catch (err) {
      console.error("Failed to load driver data:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDriverData();
  }, []);

  // Open Log Modal for a specific property on the route
  const handleOpenPropertyModal = (p: GlassProperty) => {
    setSelectedProperty(p);
    setTonsInput("");
    setPaymentInput("0");
    startGpsAcquisition();
    setCollectionModalOpen(true);
  };

  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) return;
    const t = parseFloat(tonsInput);
    if (!t || t <= 0) {
      toast.error("Please enter a valid tonnage collected");
      return;
    }
    const pay = parseFloat(paymentInput) || 0;

    setIsSubmittingCollection(true);
    try {
      const vehicleDesc = activeAssignment?.vehicle_plate || activeAssignment?.vehiclePlate || "Truck";

      const payload = {
        property_id: selectedProperty.id,
        assignment_id: activeAssignment?.id || undefined,
        driver_id: currentUser?.id,
        vehicle: vehicleDesc,
        property: selectedProperty.name,
        location: selectedProperty.address || "",
        latitude: gpsLocation?.lat || selectedProperty.latitude,
        longitude: gpsLocation?.lng || selectedProperty.longitude,
        phone: selectedProperty.phone,
        tons_collected: t,
        payment_amount: pay,
        status: "collected" as const
      };

      const res = await createGlassCollection(payload);

      // Add to store
      addGlassCollection({
        id: res.id || Date.now().toString(),
        driverId: currentUser?.id || "",
        driverName: currentUser?.name || "Driver",
        vehicle: vehicleDesc,
        property: selectedProperty.name,
        property_id: selectedProperty.id,
        assignment_id: activeAssignment?.id,
        location: selectedProperty.address,
        latitude: gpsLocation?.lat || selectedProperty.latitude,
        longitude: gpsLocation?.lng || selectedProperty.longitude,
        phone: selectedProperty.phone,
        tonsCollected: t,
        paymentAmount: pay,
        status: "collected",
        date: new Date().toISOString()
      });

      toast.success(`Collected ${t.toFixed(1)} Tons from ${selectedProperty.name}!`);
      setCollectionModalOpen(false);
      setSelectedProperty(null);
      await loadDriverData();
    } catch (err: any) {
      toast.error("Failed to log collection: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmittingCollection(false);
    }
  };

  // Log Ad-hoc collection from a new / unscheduled stop
  const handleSaveAdhoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adhocName.trim()) {
      toast.error("Please enter property name");
      return;
    }
    const t = parseFloat(tonsInput);
    if (!t || t <= 0) {
      toast.error("Please enter tonnage collected");
      return;
    }
    const pay = parseFloat(paymentInput) || 0;

    setIsSubmittingCollection(true);
    try {
      // 1. Create Property
      const newProp = await createGlassProperty({
        name: adhocName.trim(),
        category: adhocCategory,
        address: adhocAddress.trim() || undefined,
        phone: adhocPhone.trim() || undefined,
        route_id: activeAssignment?.route_id || activeAssignment?.routeId || undefined,
        latitude: gpsLocation?.lat || undefined,
        longitude: gpsLocation?.lng || undefined
      });

      // 2. Log collection
      const vehicleDesc = activeAssignment?.vehicle_plate || activeAssignment?.vehiclePlate || "Truck";
      await createGlassCollection({
        property_id: newProp.id,
        assignment_id: activeAssignment?.id || undefined,
        driver_id: currentUser?.id,
        vehicle: vehicleDesc,
        property: newProp.name,
        location: adhocAddress.trim() || undefined,
        latitude: gpsLocation?.lat || undefined,
        longitude: gpsLocation?.lng || undefined,
        phone: adhocPhone.trim() || undefined,
        tons_collected: t,
        payment_amount: pay,
        status: "collected" as const
      });

      toast.success(`Ad-hoc pickup logged for ${newProp.name}!`);
      setAdhocModalOpen(false);
      setAdhocName("");
      setAdhocAddress("");
      setAdhocPhone("");
      setTonsInput("");
      setPaymentInput("0");
      await loadDriverData();
    } catch (err: any) {
      toast.error("Failed to log ad-hoc stop: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmittingCollection(false);
    }
  };

  // Reconcile and End Run (One-click drop at Godown)
  const handleEndRunAndDropAtGodown = async () => {
    if (!activeAssignment) return;
    const collectedTons = activeAssignment.collected_tons || activeAssignment.collectedTons || activeCollectionsTons;

    const ok = await confirm({
      title: "End Run & Drop at Godown?",
      message: `You have collected ${collectedTons.toFixed(1)} Tons of cullet on this run. Tapping confirm will drop all cullet into the Godown Unseparated Stock and complete your shift.`,
      confirmText: "Drop at Godown & Complete Shift",
      cancelText: "Continue Collecting"
    });

    if (ok) {
      try {
        const res = await completeGlassAssignment(activeAssignment.id);
        toast.success(res.message || "Shift completed and tons credited to Godown!");
        await loadDriverData();
      } catch (err: any) {
        toast.error("Failed to complete shift: " + (err.message || "Unknown error"));
      }
    }
  };

  const handleSignOut = () => {
    if (window.confirm("Are you sure you want to sign out of the Driver app?")) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("flyera_user");
      window.location.href = "/login";
    }
  };

  // Calculate live load on truck
  const activeCollectionsTons = useMemo(() => {
    return glassCollections
      .filter(c => c.status === "collected")
      .reduce((sum, c) => sum + (c.tonsCollected || (c as any).tons_collected || 0), 0);
  }, [glassCollections]);

  // Map of properties visited in this active run
  const completedPropertyIds = useMemo(() => {
    const map: Record<string, number> = {};
    glassCollections
      .filter(c => c.status === "collected" && (!activeAssignment || (c as any).assignment_id === activeAssignment.id || (c as any).assignmentId === activeAssignment.id))
      .forEach(c => {
        const pId = (c as any).property_id || (c as any).propertyId;
        if (pId) {
          map[pId] = c.tonsCollected || (c as any).tons_collected || 0;
        }
      });
    return map;
  }, [glassCollections, activeAssignment]);

  const targetCapacity = activeAssignment?.target_capacity_tons || activeAssignment?.targetCapacityTons || 4.5;
  const loadPercentage = Math.min(100, Math.round((activeCollectionsTons / targetCapacity) * 100));

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-900 pb-24 p-4 md:p-8 relative">
      {/* App Header */}
      <header className="glass-panel p-4 md:p-6 mb-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-4xl mx-auto rounded-3xl bg-white border border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Recycle className="w-6 h-6 text-emerald-600" /> Glass Co-Pilot
            </h1>
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
              Driver Intake Run
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">
              {activeAssignment?.vehicle_plate || activeAssignment?.vehiclePlate || "Collection Truck"}
            </span>
            <span>•</span>
            <span className="font-bold text-slate-800">{currentUser?.name || "Driver"}</span>
            {activeAssignment?.helper_name && (
              <>
                <span>•</span>
                <span className="text-slate-500">Helper: {activeAssignment.helper_name}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
          <button
            onClick={loadDriverData}
            title="Refresh status"
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <button
            onClick={handleSignOut}
            title="Sign Out"
            className="bg-white hover:bg-rose-50 border border-slate-200 text-slate-700 hover:text-rose-600 active:scale-95 px-3 py-2 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Active Route & Truck Load Card */}
        {activeAssignment ? (
          <div
            className="p-5 sm:p-6 rounded-3xl text-white shadow-xl border border-emerald-700/50 relative overflow-hidden bg-emerald-950"
            style={{
              background: "linear-gradient(135deg, #064e3b 0%, #065f46 45%, #042f2e 100%)",
              color: "#ffffff"
            }}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2.5 py-1 rounded-lg backdrop-blur-sm inline-block">
                  Assigned Route
                </span>
                <h2 className="text-xl sm:text-2xl font-black mt-1 text-white">
                  {activeAssignment.route_name || activeAssignment.routeName || "Collection Run"}
                </h2>
                {activeAssignment.route_area && (
                  <p className="text-xs text-emerald-200 font-semibold mt-0.5">Zone: {activeAssignment.route_area}</p>
                )}
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-emerald-200 font-bold block">In-Transit Truck Load</span>
                <span className="text-2xl sm:text-3xl font-black text-white">
                  {activeCollectionsTons.toFixed(1)} <span className="text-sm font-bold text-emerald-300">/ {targetCapacity.toFixed(1)} T</span>
                </span>
              </div>
            </div>

            {/* Load Meter Bar */}
            <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden mb-3 border border-white/10">
              <div
                className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full transition-all duration-500 rounded-full shadow-sm"
                style={{ width: `${loadPercentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-emerald-100 font-bold">
              <span>{Object.keys(completedPropertyIds).length} of {routeProperties.length} Assigned Stops Visited</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-md text-emerald-200">{loadPercentage}% Truck Full</span>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-6 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 shadow-xs flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-black text-amber-900">No Active Route Assigned Today</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Your dispatcher has not yet assigned a collection shift to your account. You can still log ad-hoc cullet collections below.
              </p>
            </div>
          </div>
        )}

        {/* Assigned Properties Route Stops Checklist */}
        {activeAssignment && routeProperties.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                Route Properties Checklist ({routeProperties.length} Stops)
              </h3>
              <span className="text-xs font-bold text-slate-400">Tap to record pickup</span>
            </div>

            <div className="space-y-2.5">
              {routeProperties.map((p, idx) => {
                const collectedTons = completedPropertyIds[p.id];
                const isDone = collectedTons !== undefined;

                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isDone
                        ? "bg-emerald-50/60 border-emerald-300/80 shadow-2xs"
                        : "bg-white border-slate-200/80 hover:border-emerald-400 shadow-xs"
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${
                        isDone
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-slate-800 line-clamp-1">
                            {p.name}
                          </h4>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {p.category || "Hotel"}
                          </span>
                          {isDone && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✓ {collectedTons.toFixed(1)} Tons Loaded
                            </span>
                          )}
                        </div>

                        {p.address && (
                          <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5 line-clamp-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{p.address}</span>
                          </p>
                        )}

                        {p.phone && (
                          <p className="text-xs font-medium text-emerald-700 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{p.phone}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0">
                      {p.latitude && p.longitude && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-sky-50 text-sky-700 text-xs font-bold transition-all flex items-center gap-1"
                          title="Open Google Maps Directions"
                        >
                          <Navigation className="w-3.5 h-3.5 text-sky-600" />
                          <span className="hidden sm:inline">Directions</span>
                        </a>
                      )}

                      <button
                        onClick={() => handleOpenPropertyModal(p)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 shadow-xs ${
                          isDone
                            ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                      >
                        <Recycle className="w-3.5 h-3.5" />
                        <span>{isDone ? "Update / Add More" : "Log Collection"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Big End of Run Reconcile Button */}
        {activeAssignment && (
          <div className="glass-panel p-6 rounded-3xl bg-white border border-emerald-200/80 shadow-sm text-center space-y-3">
            <h3 className="text-base font-black text-slate-800">
              Finished with today's collection run?
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Returning to godown will automatically drop all {activeCollectionsTons.toFixed(1)} Tons into Godown stock ready for segregation.
            </p>
            <button
              onClick={handleEndRunAndDropAtGodown}
              disabled={activeCollectionsTons <= 0}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-95 inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>End Run & Drop at Godown ({activeCollectionsTons.toFixed(1)} Tons)</span>
            </button>
          </div>
        )}

        {/* Ad-Hoc / Unscheduled Collection Trigger */}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => {
              setTonsInput("");
              setPaymentInput("0");
              startGpsAcquisition();
              setAdhocModalOpen(true);
            }}
            className="text-xs font-bold text-slate-500 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Log Unscheduled / Ad-Hoc Property</span>
          </button>
        </div>
      </div>

      {/* MODAL: Log Collection for Selected Property */}
      <Modal
        isOpen={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        title={`Log Cullet Collection - ${selectedProperty?.name || 'Property'}`}
      >
        <form onSubmit={handleSaveCollection} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <p className="font-bold text-slate-700">{selectedProperty?.name}</p>
            {selectedProperty?.address && (
              <p className="text-slate-500 mt-0.5">{selectedProperty.address}</p>
            )}
            {gpsLocation && (
              <p className="text-emerald-700 font-bold mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live GPS: {gpsLocation.lat.toFixed(5)}, {gpsLocation.lng.toFixed(5)} ({gpsStatus})
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Cullet Weight (Tons) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              autoFocus
              placeholder="e.g. 0.8"
              value={tonsInput}
              onChange={(e) => setTonsInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Payment to Property (₹)
            </label>
            <input
              type="number"
              step="1"
              placeholder="0 for free / commercial scrap"
              value={paymentInput}
              onChange={(e) => setPaymentInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">Leave as 0 if cullet was collected free of charge.</p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCollectionModalOpen(false)}
              className="text-xs font-bold px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingCollection}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl shadow-xs"
            >
              {isSubmittingCollection ? "Saving..." : "Save Cullet Collection"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Ad-Hoc Unscheduled Collection */}
      <Modal
        isOpen={adhocModalOpen}
        onClose={() => setAdhocModalOpen(false)}
        title="Log Unscheduled Property Collection"
      >
        <form onSubmit={handleSaveAdhoc} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Property / Hotel Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Fisherman's Cove Bar"
              value={adhocName}
              onChange={(e) => setAdhocName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Category
              </label>
              <select
                value={adhocCategory}
                onChange={(e) => setAdhocCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              >
                <option value="Hotel & Resort">Hotel & Resort</option>
                <option value="Bar & Pub">Bar & Pub</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Commercial Complex">Commercial Complex</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="e.g. 9822100000"
                value={adhocPhone}
                onChange={(e) => setAdhocPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Address / Landmark
            </label>
            <input
              type="text"
              placeholder="e.g. Candolim Main Road"
              value={adhocAddress}
              onChange={(e) => setAdhocAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Cullet Tons *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 0.5"
                value={tonsInput}
                onChange={(e) => setTonsInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Payment (₹)
              </label>
              <input
                type="number"
                step="1"
                placeholder="0"
                value={paymentInput}
                onChange={(e) => setPaymentInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdhocModalOpen(false)}
              className="text-xs font-bold px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingCollection}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl shadow-xs"
            >
              {isSubmittingCollection ? "Saving..." : "Save Ad-Hoc Collection"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
