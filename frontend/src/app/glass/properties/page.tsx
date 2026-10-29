"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { 
  Building2, 
  MapPin, 
  Phone, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  ExternalLink, 
  Crosshair, 
  CheckCircle2, 
  Recycle, 
  Map, 
  Calendar,
  Sparkles,
  User,
  Compass
} from "lucide-react";
import { 
  getGlassProperties, 
  createGlassProperty, 
  updateGlassProperty, 
  deleteGlassProperty, 
  GlassProperty, 
  getGlassRoutes, 
  GlassRoute 
} from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function GlassPropertiesPage() {
  const [properties, setProperties] = useState<GlassProperty[]>([]);
  const [routes, setRoutes] = useState<GlassRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRouteFilter, setSelectedRouteFilter] = useState("all");
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Hotel & Resort");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [routeId, setRouteId] = useState("");
  const [pickupFrequency, setPickupFrequency] = useState("Daily");
  const [notes, setNotes] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // GPS State
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const confirm = useConfirm();

  const categories = [
    "Hotel & Resort",
    "Bar & Pub",
    "Restaurant",
    "Commercial Complex",
    "Other"
  ];

  const frequencies = ["Daily", "Weekly", "Bi-Weekly", "On-Demand"];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [propsData, routesData] = await Promise.all([
        getGlassProperties(),
        getGlassRoutes()
      ]);
      setProperties(propsData || []);
      setRoutes(routesData || []);
    } catch (err) {
      console.error("Failed to load properties:", err);
      toast.error("Failed to load glass properties");
    } finally {
      setLoading(false);
    }
  };

  const startGpsAcquisition = () => {
    if (!("geolocation" in navigator)) {
      toast.error("GPS geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    setGpsStatus("Locking high-precision GPS...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setLatitude(lat);
        setLongitude(lng);
        setIsLocating(false);
        setGpsStatus(`GPS Locked (±${Math.round(accuracy)}m)`);
        toast.success(`Coordinates captured: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);

        // Reverse geocode street address if empty
        if (!address) {
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.display_name) {
                setAddress(data.display_name);
              }
            })
            .catch(() => {});
        }
      },
      (err) => {
        setIsLocating(false);
        setGpsStatus("Failed to acquire GPS");
        toast.error("GPS error: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleOpenAdd = () => {
    setEditId(null);
    setName("");
    setCategory("Hotel & Resort");
    setContactPerson("");
    setPhone("");
    setAddress("");
    setRouteId("");
    setPickupFrequency("Daily");
    setNotes("");
    setLatitude(null);
    setLongitude(null);
    setGpsStatus(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: GlassProperty) => {
    setEditId(p.id);
    setName(p.name);
    setCategory(p.category || "Hotel & Resort");
    setContactPerson(p.contact_person || p.contactPerson || "");
    setPhone(p.phone || "");
    setAddress(p.address || "");
    setRouteId(p.route_id || p.routeId || "");
    setPickupFrequency(p.pickup_frequency || p.pickupFrequency || "Daily");
    setNotes(p.notes || "");
    setLatitude(p.latitude || null);
    setLongitude(p.longitude || null);
    setGpsStatus(p.latitude && p.longitude ? `Saved: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}` : null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a property name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        route_id: routeId ? routeId : null,
        pickup_frequency: pickupFrequency,
        notes: notes.trim() || undefined,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
      };

      if (editId) {
        await updateGlassProperty(editId, payload);
        toast.success("Property updated successfully!");
      } else {
        await createGlassProperty(payload);
        toast.success("Property registered successfully!");
      }

      await fetchData();
      setModalOpen(false);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Failed to save: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, propName: string) => {
    const ok = await confirm({
      title: `Delete "${propName}"?`,
      message: "Are you sure you want to remove this property? Historical collections will still be preserved.",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    if (ok) {
      try {
        await deleteGlassProperty(id);
        toast.success("Property deleted");
        await fetchData();
      } catch (err: any) {
        toast.error("Delete failed: " + (err.message || "Unknown error"));
      }
    }
  };

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      if (selectedCategory !== "all" && p.category !== selectedCategory) return false;
      if (selectedRouteFilter !== "all") {
        if (selectedRouteFilter === "unassigned") {
          if (p.route_id || p.routeId) return false;
        } else {
          if ((p.route_id || p.routeId) !== selectedRouteFilter) return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesAddress = p.address?.toLowerCase().includes(q);
        const matchesPhone = p.phone?.toLowerCase().includes(q);
        const matchesContact = (p.contact_person || p.contactPerson || "").toLowerCase().includes(q);
        if (!matchesName && !matchesAddress && !matchesPhone && !matchesContact) return false;
      }
      return true;
    });
  }, [properties, selectedCategory, selectedRouteFilter, searchQuery]);

  const totalTonsCollectedAll = useMemo(() => {
    return properties.reduce((sum, p) => sum + (p.total_tons_collected || p.totalTonsCollected || 0), 0);
  }, [properties]);

  const assignedCount = useMemo(() => {
    return properties.filter(p => p.route_id || p.routeId).length;
  }, [properties]);

  return (
    <div className="flex min-h-screen bg-[#FDFBF7]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 lg:p-10 pt-20 md:pt-8 pb-24 md:pb-12 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Building2 className="w-7 h-7 text-emerald-600" /> Glass Cullet Properties
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
                Directory
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Manage hotels, resorts, bars & restaurants enrolled for glass cullet pickup runs.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={fetchData}
              title="Refresh list"
              className="p-2.5 bg-white border border-slate-200 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 rounded-xl shadow-xs transition-all active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            </button>
            <Button
              variant="primary"
              onClick={handleOpenAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" /> Add Property
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Properties</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{properties.length}</p>
            <p className="text-[11px] font-semibold text-emerald-600 mt-1">Enrolled Sources</p>
          </div>
          <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Lifetime Intake</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{totalTonsCollectedAll.toFixed(1)} T</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Cullet collected</p>
          </div>
          <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Route Assigned</p>
            <p className="text-2xl font-black text-sky-700 mt-1">{assignedCount}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">On active delivery routes</p>
          </div>
          <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Unassigned</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{properties.length - assignedCount}</p>
            <p className="text-[11px] font-semibold text-amber-700 mt-1">Awaiting route mapping</p>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs mb-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by hotel, contact name, address, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent font-black outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Route Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
              <Map className="w-3.5 h-3.5 text-slate-400" />
              <span>Route:</span>
              <select
                value={selectedRouteFilter}
                onChange={(e) => setSelectedRouteFilter(e.target.value)}
                className="bg-transparent font-black outline-none cursor-pointer"
              >
                <option value="all">All Routes</option>
                <option value="unassigned">Unassigned Only</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Properties Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 font-bold text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            Loading properties...
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-3xl bg-white border border-slate-200/80 shadow-xs">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-black text-slate-700 mb-1">No Properties Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
              {searchQuery || selectedCategory !== "all" || selectedRouteFilter !== "all"
                ? "No properties match your current search or filters."
                : "No properties registered yet. Add your first hotel, resort, or bar to get started."}
            </p>
            <Button variant="primary" onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl">
              <Plus className="w-4 h-4 mr-1.5" /> Add First Property
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProperties.map(p => {
              const routeName = p.route_name || p.routeName;
              const totalTons = (p.total_tons_collected || p.totalTonsCollected || 0).toFixed(1);

              return (
                <div
                  key={p.id}
                  className="glass-panel p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-400 transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Top badging */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {p.category || "Hotel & Resort"}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {p.pickup_frequency || p.pickupFrequency || "Daily"}
                      </span>
                    </div>

                    {/* Name */}
                    <h3 className="text-base font-black text-slate-800 group-hover:text-emerald-700 transition-colors mb-1 line-clamp-1">
                      {p.name}
                    </h3>

                    {/* Route Assignment Badge */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <Map className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {routeName ? (
                        <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100 line-clamp-1">
                          Route: {routeName}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                          No Route Assigned
                        </span>
                      )}
                    </div>

                    {/* Address & GPS */}
                    {p.address && (
                      <p className="text-xs font-medium text-slate-500 mb-2 line-clamp-2 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{p.address}</span>
                      </p>
                    )}

                    {/* Contact & Phone */}
                    <div className="space-y-1 text-xs font-medium text-slate-600 mb-3 pt-2 border-t border-slate-100">
                      {(p.contact_person || p.contactPerson) && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{p.contact_person || p.contactPerson}</span>
                        </div>
                      )}
                      {p.phone && (
                        <div className="flex items-center justify-between">
                          <a
                            href={`tel:${p.phone}`}
                            className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{p.phone}</span>
                          </a>
                          {p.latitude && p.longitude && (
                            <a
                              href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-0.5 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" /> Map
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Intake & Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs">
                      <Recycle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-slate-400 font-semibold">Tonnage:</span>
                      <span className="font-black text-slate-800">{totalTons} T</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit Property"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Property"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add / Edit Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editId ? "Edit Glass Property" : "Register Glass Property"}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Property / Client Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Taj Holiday Village, SinQ Nightclub..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Assigned Route
                </label>
                <select
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  <option value="">-- No Route (Unassigned) --</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.area || "Zone"})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Contact Person
                </label>
                <input
                  type="text"
                  placeholder="Manager / Chef / In-charge"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9822100000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Address & Live GPS */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Street Address & Location
                </label>
                <button
                  type="button"
                  onClick={startGpsAcquisition}
                  disabled={isLocating}
                  className="text-[11px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Crosshair className={`w-3.5 h-3.5 ${isLocating ? "animate-spin text-emerald-600" : ""}`} />
                  <span>{isLocating ? "Detecting GPS..." : "Auto-Locate GPS"}</span>
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. Near Beach Road, Candolim, Goa"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {gpsStatus && (
                <p className="text-[11px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {gpsStatus}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Pickup Frequency
                </label>
                <select
                  value={pickupFrequency}
                  onChange={(e) => setPickupFrequency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  {frequencies.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Internal Notes
                </label>
                <input
                  type="text"
                  placeholder="Gate code, best pickup time..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="text-xs font-bold px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl shadow-xs"
              >
                {saving ? "Saving..." : editId ? "Update Property" : "Save Property"}
              </Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}

