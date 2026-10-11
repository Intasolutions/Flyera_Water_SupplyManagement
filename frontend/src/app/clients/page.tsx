"use client";

import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { 
  Users, 
  Search, 
  Filter, 
  Phone, 
  Award, 
  MapPin, 
  Plus, 
  Route as RouteIcon, 
  Sparkles,
  RefreshCw,
  Edit2,
  Trash2,
  UserCheck,
  Navigation,
  ExternalLink,
  CheckCircle2,
  Upload,
  HelpCircle,
  Link2
} from "lucide-react";
import { getClients, createClient, updateClient, deleteClient, Client, getRoutes, Route, getInventoryTypes, InventoryType } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRouteFilter, setSelectedRouteFilter] = useState("all");
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const confirm = useConfirm();

  // Form states
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTier, setNewTier] = useState("Standard");
  const [newOptIn, setNewOptIn] = useState(true);
  const [newRouteId, setNewRouteId] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newLatitude, setNewLatitude] = useState<number | null>(null);
  const [newLongitude, setNewLongitude] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [showGuidance, setShowGuidance] = useState(false);
  const [locationMethod, setLocationMethod] = useState<"link" | "gps" | "manual">("link");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientsData, routesData, invData] = await Promise.all([
        getClients(),
        getRoutes(),
        getInventoryTypes()
      ]);
      setClients(clientsData || []);
      setRoutes(routesData || []);
      setInventoryTypes(invData || []);
    } catch (error) {
      console.error("Failed to fetch clients, routes or inventory:", error);
      toast.error("Failed to load client directory");
    } finally {
      setLoading(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setNewLatitude(lat);
        setNewLongitude(lng);
        setIsLocating(false);
        toast.success(`GPS Location Captured: ${lat}, ${lng}`);
      },
      (err) => {
        setIsLocating(false);
        console.error("GPS error:", err);
        toast.error(err.message || "Failed to get GPS location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const parseLocationText = (text: string) => {
    if (!text || !text.trim()) {
      toast.error("Please paste a Google Maps link or coordinates");
      return;
    }

    const trimmed = text.trim();

    // Regex 1: Google Maps query format: q=19.076090,72.877390 or ll=... or daddr=...
    const urlQueryMatch = trimmed.match(/[?&](?:q|ll|destination|daddr)=(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);

    // Regex 2: Google Maps path format: @19.076090,72.877390
    const urlPathMatch = trimmed.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);

    // Regex 3: Direct coordinates: "19.076090, 72.877390" or "19.076090 72.877390"
    const coordMatch = trimmed.match(/(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);

    let lat: number | null = null;
    let lng: number | null = null;

    if (urlQueryMatch) {
      lat = parseFloat(urlQueryMatch[1]);
      lng = parseFloat(urlQueryMatch[2]);
    } else if (urlPathMatch) {
      lat = parseFloat(urlPathMatch[1]);
      lng = parseFloat(urlPathMatch[2]);
    } else if (coordMatch) {
      lat = parseFloat(coordMatch[1]);
      lng = parseFloat(coordMatch[2]);
    }

    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      setNewLatitude(parseFloat(lat.toFixed(6)));
      setNewLongitude(parseFloat(lng.toFixed(6)));
      toast.success(`Location pinned: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

      // Reverse geocode to resolve address if address is blank
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
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
              setNewAddress(prev => prev || resolved);
            }
          }
        })
        .catch(() => {});
    } else {
      toast.error("Could not find coordinates. Please paste standard coordinates or a Google Maps link.");
    }
  };

  const handleSaveClient = async () => {
    if (!newName.trim()) {
      toast.error("Please enter a client name");
      return;
    }

    try {
      const payload: Partial<Client> = {
        name: newName.trim(),
        phone: newPhone.trim() || null,
        address: newAddress.trim() || null,
        tier: newTier,
        opt_in_loyalty: newOptIn,
        route_id: newRouteId || null,
        latitude: newLatitude ?? undefined,
        longitude: newLongitude ?? undefined,
      };
      
      if (editId) {
        await updateClient(editId, payload);
        toast.success("Client updated successfully!");
      } else {
        await createClient(payload);
        toast.success("Client registered successfully!");
      }
      
      await fetchData();
      setModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Failed to save client:", error);
      toast.error(error.message || "Failed to save client");
    }
  };

  const resetForm = () => {
    setEditId(null);
    setNewName("");
    setNewPhone("");
    setNewAddress("");
    setNewTier("Standard");
    setNewOptIn(true);
    setNewRouteId("");
    setNewLatitude(null);
    setNewLongitude(null);
    setLocationInput("");
    setShowGuidance(false);
  };

  const handleEditClick = (c: Client) => {
    setEditId(c.id);
    setNewName(c.name);
    setNewPhone(c.phone || "");
    setNewAddress(c.address || "");
    setNewTier(c.tier || "Standard");
    setNewOptIn(c.opt_in_loyalty);
    setNewRouteId(c.route_id || "");
    setNewLatitude(c.latitude ?? null);
    setNewLongitude(c.longitude ?? null);
    setLocationInput(c.latitude && c.longitude ? `${c.latitude}, ${c.longitude}` : "");
    setModalOpen(true);
  };

  const handleAddClick = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleDeleteClient = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: "Delete Client",
      message: `Are you sure you want to remove "${name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    
    if (isConfirmed) {
      try {
        await deleteClient(id);
        await fetchData();
        toast.success("Client removed successfully");
      } catch (error: any) {
        console.error("Failed to delete client:", error);
        toast.error(error.message || "Failed to delete client");
      }
    }
  };

  // Filter clients dynamically
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = 
        (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.address || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRoute = 
        selectedRouteFilter === "all" || 
        (selectedRouteFilter === "unassigned" ? !c.route_id : c.route_id === selectedRouteFilter);

      return matchesSearch && matchesRoute;
    });
  }, [clients, searchQuery, selectedRouteFilter]);

  // Dynamic KPI Stats
  const totalClients = clients.length;
  const assignedCount = clients.filter(c => !!c.route_id).length;
  const unassignedCount = totalClients - assignedCount;
  const totalLoyaltyPoints = clients.reduce((acc, c) => acc + (c.loyalty_points || 0), 0);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-72 p-4 sm:p-6 md:p-10 lg:p-12 pt-20 md:pt-10 pb-24 md:pb-12 transition-all max-w-7xl">
        <PageHeader 
          title="Client Directory" 
          subtitle="Manage recurring customer locations, route assignments, and loyalty rewards."
          badge={`${totalClients} Registered`}
          badgeColor="blue"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchData()}
                title="Refresh clients"
                className="p-2.5 bg-white border border-gray-200 hover:border-primary rounded-xl shadow-sm text-text-muted hover:text-primary transition-all active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
              </button>
              <Button 
                onClick={handleAddClick} 
                icon={<Plus className="w-4 h-4" />}
                className="shadow-md"
              >
                Add New Client
              </Button>
            </div>
          }
        />

        {/* Top KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Total Clients" 
            value={totalClients} 
            trend="Active customer base"
            icon={<Users className="w-5 h-5 text-blue-600" />}
            badge="Directory"
            color="blue"
          />
          <StatCard 
            title="Assigned to Routes" 
            value={assignedCount} 
            trend="On active delivery paths"
            icon={<RouteIcon className="w-5 h-5 text-emerald-600" />}
            badge="Scheduled"
            color="emerald"
          />
          <StatCard 
            title="Unassigned Clients" 
            value={unassignedCount} 
            trend="Awaiting route linking"
            icon={<MapPin className="w-5 h-5 text-amber-600" />}
            badge="Needs Route"
            color="amber"
          />
          <StatCard 
            title="Loyalty Points" 
            value={totalLoyaltyPoints.toLocaleString()} 
            trend="Earned across accounts"
            icon={<Award className="w-5 h-5 text-purple-600" />}
            badge="Rewards"
            color="purple"
          />
        </div>

        {/* Filter and Search Bar Container */}
        <div className="glass-panel p-4 md:p-5 rounded-3xl mb-8 border border-black/5 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search by business name, address, or phone..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-gray-200 rounded-xl outline-none text-text text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
              />
            </div>

            {/* Route Filter Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-text-muted shrink-0 hidden sm:block" />
              <select
                value={selectedRouteFilter}
                onChange={e => setSelectedRouteFilter(e.target.value)}
                className="w-full md:w-auto py-2.5 px-4 bg-surface border border-gray-200 rounded-xl outline-none text-text text-xs font-bold focus:border-primary transition-all shadow-sm cursor-pointer"
              >
                <option value="all">All Routes ({clients.length})</option>
                <option value="unassigned">Unassigned Only ({unassignedCount})</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    Route: {r.name} ({r.area || "Zone"})
                  </option>
                ))}
              </select>

              {(searchQuery || selectedRouteFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedRouteFilter("all");
                  }}
                  className="text-xs font-bold text-primary hover:underline px-2 py-1 shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Client Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map(c => {
            const clientRoute = routes.find(r => r.id === c.route_id);
            return (
              <ClientCard 
                key={c.id} 
                client={c} 
                routeName={clientRoute?.name} 
                routeArea={clientRoute?.area}
                onEdit={() => handleEditClick(c)} 
                onDelete={() => handleDeleteClient(c.id, c.name)} 
              />
            );
          })}

          {filteredClients.length === 0 && !loading && (
            <div className="col-span-full p-12 text-center bg-surface/60 rounded-3xl border border-dashed border-gray-200">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-text">No clients found</h3>
              <p className="text-text-muted text-sm mt-1 max-w-sm mx-auto">
                {searchQuery || selectedRouteFilter !== "all" 
                  ? "Try adjusting your search criteria or resetting the route filter."
                  : "Get started by adding your first client location."}
              </p>
              <div className="mt-4">
                <Button onClick={handleAddClick} icon={<Plus className="w-4 h-4" />} size="sm">
                  Add Client
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Add / Edit Client */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editId ? "Update Client Details" : "Register New Client"}
          subtitle={editId ? "Modify customer location, phone, and route mapping." : "Add a new customer to receive scheduled water deliveries."}
          width="2xl"
          actions={
            <div className="flex gap-3 w-full">
              <Button variant="secondary" onClick={() => setModalOpen(false)} fullWidth>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveClient} fullWidth>
                {editId ? "Save Changes" : "Create Client"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                  Business / Client Name
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Royal Greens Hotel" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium" 
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                  Contact Phone
                </label>
                <input 
                  type="text" 
                  placeholder="+91 98765 43210" 
                  value={newPhone} 
                  onChange={e => setNewPhone(e.target.value)} 
                  className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium" 
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                Delivery Address & Landmark
              </label>
              <input 
                type="text" 
                placeholder="Shop No. 4, Beach Road, Kandivali West" 
                value={newAddress} 
                onChange={e => setNewAddress(e.target.value)} 
                className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium" 
              />
            </div>

            {/* Upload Client Location Feature with Guidance */}
            <div className="p-4 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 rounded-2xl border border-emerald-200/90 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-black text-slate-800 block">
                        Client Delivery Location
                      </label>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                        GPS & Maps
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Upload from WhatsApp/Google Maps or detect live GPS
                    </p>
                  </div>
                </div>

                {/* Method selector pills */}
                <div className="flex bg-white/80 p-1 rounded-xl border border-emerald-200/60 self-start sm:self-auto shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setLocationMethod("link")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      locationMethod === "link"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Paste Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationMethod("gps")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      locationMethod === "gps"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Live GPS
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationMethod("manual")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      locationMethod === "manual"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Coordinates
                  </button>
                </div>
              </div>

              {/* Guidance Toggle Button */}
              <div className="flex items-center justify-between text-xs bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                <span className="text-slate-700 font-bold flex items-center gap-1.5 text-[11px]">
                  <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Need customer&apos;s location from WhatsApp?
                </span>
                <button
                  type="button"
                  onClick={() => setShowGuidance(prev => !prev)}
                  className="text-[11px] font-black text-emerald-700 hover:text-emerald-800 underline flex items-center gap-1"
                >
                  {showGuidance ? "Hide Guidance" : "View Step-by-Step Guide"}
                </button>
              </div>

              {/* Step-by-Step Guidance Panel */}
              {showGuidance && (
                <div className="p-3.5 bg-white rounded-xl border border-emerald-200/80 shadow-xs space-y-2 text-xs text-slate-700 animate-fade-in">
                  <p className="font-black text-slate-800 flex items-center gap-1 text-[11px] uppercase tracking-wider text-emerald-700">
                    📖 Step-by-Step Guidance:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="font-black text-emerald-700 block mb-0.5">1. In WhatsApp:</span>
                      <span>Ask the customer to tap 📎 &gt; <b>Location</b> &gt; <b>Share current location</b>.</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="font-black text-emerald-700 block mb-0.5">2. Copy Pin Link:</span>
                      <span>Tap the shared pin to open in Google Maps, then tap <b>Share</b> &gt; <b>Copy link</b>.</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="font-black text-emerald-700 block mb-0.5">3. Paste & Upload:</span>
                      <span>Paste the link in the box below and tap <b>Upload & Pin</b>. Done!</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Method 1: Paste Google Maps / WhatsApp Location Link */}
              {locationMethod === "link" && (
                <div className="space-y-2 pt-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                    Paste Google Maps Link / WhatsApp Location / Coordinates
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={locationInput}
                      onChange={e => setLocationInput(e.target.value)}
                      placeholder="e.g. https://maps.app.goo.gl/... or 19.0760, 72.8774"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => parseLocationText(locationInput)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Pin</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Method 2: Detect Live GPS */}
              {locationMethod === "gps" && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200/80">
                    <div>
                      <p className="text-xs font-bold text-slate-800">On-Site GPS Detection</p>
                      <p className="text-[11px] text-slate-500">Detect device satellite coordinates</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={isLocating}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <MapPin className={`w-3.5 h-3.5 ${isLocating ? "animate-bounce" : ""}`} />
                      <span>{isLocating ? "Acquiring GPS..." : "📍 Detect GPS"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Method 3: Direct Coordinate Inputs */}
              {(locationMethod === "manual" || (newLatitude && newLongitude)) && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Latitude
                    </span>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 19.076090"
                      value={newLatitude ?? ""}
                      onChange={e => setNewLatitude(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 shadow-2xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Longitude
                    </span>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 72.877390"
                      value={newLongitude ?? ""}
                      onChange={e => setNewLongitude(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 shadow-2xs"
                    />
                  </div>
                </div>
              )}

              {/* Pin Status & Interactive Embedded Google Maps Preview */}
              {newLatitude && newLongitude ? (
                <div className="pt-2 border-t border-emerald-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-800 font-black flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Pinned: {newLatitude.toFixed(6)}, {newLongitude.toFixed(6)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewLatitude(null);
                          setNewLongitude(null);
                          setLocationInput("");
                        }}
                        className="text-[11px] font-bold text-rose-600 hover:underline"
                      >
                        Clear Pin
                      </button>
                      <a
                        href={`https://www.google.com/maps?q=${newLatitude},${newLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-black text-xs flex items-center gap-1"
                      >
                        Open Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Interactive Map Embed */}
                  <div className="rounded-xl overflow-hidden border border-emerald-200 shadow-2xs">
                    <iframe
                      title="Customer Location Pin"
                      width="100%"
                      height="160"
                      style={{ border: 0 }}
                      loading="lazy"
                      src={`https://maps.google.com/maps?q=${newLatitude},${newLongitude}&z=16&output=embed`}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                  Assigned Route
                </label>
                <select 
                  value={newRouteId} 
                  onChange={e => setNewRouteId(e.target.value)} 
                  className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium appearance-none cursor-pointer"
                >
                  <option value="">Unassigned (No Route)</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.area || "Zone"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                  Customer Pricing Tier
                </label>
                {(() => {
                  const mainBottle = inventoryTypes.find(i => i.name.toLowerCase().includes("20l")) || inventoryTypes[0];
                  return (
                    <>
                      <select 
                        value={newTier} 
                        onChange={e => setNewTier(e.target.value)} 
                        className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium appearance-none cursor-pointer"
                      >
                        <option value="Standard">
                          Standard Rate {mainBottle ? `(₹${mainBottle.price} on 20L)` : "(Retail)"}
                        </option>
                        <option value="Wholesale">
                          Wholesale Discount {mainBottle ? `(₹${mainBottle.wholesale_price} on 20L)` : "(Bulk)"}
                        </option>
                        <option value="Premium">
                          Premium VIP Contract {mainBottle ? `(₹${mainBottle.premium_price} on 20L)` : "(Special)"}
                        </option>
                      </select>
                      <p className="text-[11px] text-slate-400 mt-1 font-medium">
                        Applies tier rates across 20L bottles, 5L jars, and cups configured in Settings.
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-black/5 flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-text">Customer Loyalty Points</p>
                  <p className="text-xs text-text-muted">Earn redeemable rewards per bottle returned</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={newOptIn} 
                onChange={e => setNewOptIn(e.target.checked)} 
                className="w-5 h-5 rounded text-primary focus:ring-primary/20 cursor-pointer" 
              />
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}

function ClientCard({ 
  client, 
  routeName, 
  routeArea, 
  onEdit, 
  onDelete 
}: { 
  client: Client; 
  routeName?: string; 
  routeArea?: string | null; 
  onEdit: () => void; 
  onDelete: () => void; 
}) {
  return (
    <div className="glass-panel p-5 rounded-3xl hover:shadow-md transition-all border border-black/5 flex flex-col justify-between group relative overflow-hidden">
      <div>
        {/* Top Header */}
        <div className="flex justify-between items-start mb-3 gap-2">
          <div>
            <h3 className="font-black text-base sm:text-lg text-slate-900 tracking-tight group-hover:text-primary transition-colors">
              {client.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 font-semibold mt-1">
              <Phone className="w-4 h-4 text-slate-500" />
              <span>{client.phone || "No phone listed"}</span>
            </div>
          </div>

          <span className="text-xs uppercase tracking-wider font-black px-2.5 py-1 rounded-lg border bg-blue-50 border-blue-200 text-blue-800 shrink-0">
            {client.tier || "Standard"}
          </span>
        </div>

        {/* Route & Address Detail */}
        <div className="space-y-2 py-3 border-y border-black/5 my-3 text-xs sm:text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-black text-slate-900 text-sm truncate">
                {routeName ? `${routeName} (${routeArea || "Area"})` : "Unassigned to any route"}
              </p>
              <p className="text-slate-600 text-xs sm:text-sm font-semibold truncate mt-1">
                {client.address || "Address not specified"}
              </p>
            </div>
          </div>

          {/* GPS Map Link for Drivers */}
          {client.latitude && client.longitude ? (
            <div className="pt-1">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${client.latitude},${client.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-lg text-xs font-bold transition-all active:scale-95"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                <span>Navigate ({client.latitude.toFixed(4)}, {client.longitude.toFixed(4)})</span>
                <ExternalLink className="w-3 h-3 text-emerald-600" />
              </a>
            </div>
          ) : client.address ? (
            <div className="pt-1">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all active:scale-95"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>Maps Search</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>
          ) : null}

          {/* Loyalty Pill */}
          <div className="flex items-center justify-between pt-1">
            {client.opt_in_loyalty ? (
              <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
                <Award className="w-4 h-4 text-purple-600" />
                {client.loyalty_points || 0} Points
              </span>
            ) : (
              <span className="text-xs text-slate-600 font-bold bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                Loyalty Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex gap-2 pt-1">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={onEdit} 
          icon={<Edit2 className="w-3.5 h-3.5" />}
          className="flex-1"
        >
          Edit
        </Button>
        <Button 
          variant="danger" 
          size="sm" 
          onClick={onDelete} 
          icon={<Trash2 className="w-3.5 h-3.5" />}
          className="flex-1"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
