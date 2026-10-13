"use client";

import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { 
  Map, 
  Search, 
  Filter, 
  Plus, 
  MapPin, 
  Users, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  Compass, 
  Layers, 
  X,
  ExternalLink,
  UserPlus,
  Phone,
  Check,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { 
  getRoutes, 
  createRoute, 
  updateRoute, 
  deleteRoute, 
  Route, 
  getClients, 
  updateClient, 
  Client 
} from "@/lib/api";
import { formatPhoneDisplay } from "@/lib/validation";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewClientsModal, setViewClientsModal] = useState<{ route: Route; clients: Client[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAreaFilter, setSelectedAreaFilter] = useState("all");
  const confirm = useConfirm();

  // Assign Clients Modal States
  const [assignRoute, setAssignRoute] = useState<Route | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientFilterTab, setClientFilterTab] = useState<"all" | "assigned" | "unassigned">("all");
  const [savingAssignments, setSavingAssignments] = useState(false);

  // New route state
  const [newRouteName, setNewRouteName] = useState("");
  const [newRouteArea, setNewRouteArea] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [routesData, clientsData] = await Promise.all([
        getRoutes(),
        getClients()
      ]);
      setRoutes(routesData || []);
      setClients(clientsData || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoute = async () => {
    if (!newRouteName.trim() || !newRouteArea.trim()) {
      toast.error("Please provide both a route name and area/zone.");
      return;
    }

    try {
      const payload = {
        name: newRouteName.trim(),
        area: newRouteArea.trim(),
      };

      if (editId) {
        await updateRoute(editId, payload);
      } else {
        await createRoute(payload);
      }

      await fetchData();
      setModalOpen(false);
      setEditId(null);
      setNewRouteName("");
      setNewRouteArea("");
      toast.success(editId ? "Route updated successfully!" : "Route created successfully!");
    } catch (error: any) {
      console.error("Failed to save route:", error);
      toast.error("Failed to save route: " + (error.message || "Unknown error"));
    }
  };

  const handleEditClick = (r: Route) => {
    setEditId(r.id);
    setNewRouteName(r.name);
    setNewRouteArea(r.area || "");
    setModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Delete Route",
      message: "Are you sure you want to delete this route? Clients assigned to this route will lose their route mapping.",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    if (isConfirmed) {
      try {
        await deleteRoute(id);
        await fetchData();
        toast.success("Route deleted successfully.");
      } catch (error: any) {
        toast.error("Failed to delete route: " + (error.message || "Unknown error"));
      }
    }
  };

  // Open Assign Clients Modal
  const handleOpenAssignModal = (r: Route) => {
    setAssignRoute(r);
    const assignedIds = new Set<string>();
    clients.forEach(c => {
      if (c.route_id === r.id) {
        assignedIds.add(c.id);
      }
    });
    setSelectedClientIds(assignedIds);
    setClientSearchQuery("");
    setClientFilterTab("all");
  };

  const handleToggleClient = (clientId: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const handleSelectAllShown = (clientsToShow: Client[]) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      clientsToShow.forEach(c => next.add(c.id));
      return next;
    });
  };

  const handleDeselectAllShown = (clientsToShow: Client[]) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      clientsToShow.forEach(c => next.delete(c.id));
      return next;
    });
  };

  const handleSaveAssignments = async () => {
    if (!assignRoute) return;
    try {
      setSavingAssignments(true);

      const updates: Promise<any>[] = [];

      clients.forEach(c => {
        const wasAssigned = c.route_id === assignRoute.id;
        const isNowSelected = selectedClientIds.has(c.id);

        if (!wasAssigned && isNowSelected) {
          updates.push(updateClient(c.id, { route_id: assignRoute.id }));
        } else if (wasAssigned && !isNowSelected) {
          updates.push(updateClient(c.id, { route_id: null }));
        }
      });

      if (updates.length > 0) {
        await Promise.all(updates);
        toast.success(`Updated clients for ${assignRoute.name}!`);
        await fetchData();
      } else {
        toast("No changes to client assignments");
      }

      setAssignRoute(null);
    } catch (err: any) {
      console.error("Failed to update route assignments:", err);
      toast.error(err.message || "Failed to save client assignments");
    } finally {
      setSavingAssignments(false);
    }
  };

  // Distinct Areas
  const uniqueAreas = useMemo(() => {
    const areas = new Set<string>();
    routes.forEach(r => {
      if (r.area) areas.add(r.area);
    });
    return Array.from(areas);
  }, [routes]);

  // Filtered Routes
  const filteredRoutes = useMemo(() => {
    return routes.filter(r => {
      if (selectedAreaFilter !== "all" && r.area !== selectedAreaFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return r.name.toLowerCase().includes(query) || (r.area && r.area.toLowerCase().includes(query));
      }
      return true;
    });
  }, [routes, selectedAreaFilter, searchQuery]);

  // Aggregate Metrics
  const totalRoutesCount = routes.length;
  const totalCoveredClients = clients.filter(c => !!c.route_id).length;
  const avgClientsPerRoute = totalRoutesCount > 0 ? (totalCoveredClients / totalRoutesCount).toFixed(1) : "0";

  // Filtered clients for assign modal
  const filteredModalClients = useMemo(() => {
    if (!assignRoute) return [];
    const q = clientSearchQuery.trim().toLowerCase();

    return clients.filter(c => {
      const isAssignedToThis = c.route_id === assignRoute.id;
      if (clientFilterTab === "assigned" && !isAssignedToThis) return false;
      if (clientFilterTab === "unassigned" && !!c.route_id) return false;

      if (q) {
        const matchesName = (c.name || "").toLowerCase().includes(q);
        const matchesPhone = (c.phone || "").toLowerCase().includes(q);
        const matchesAddress = (c.address || "").toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesAddress;
      }
      return true;
    });
  }, [clients, assignRoute, clientSearchQuery, clientFilterTab]);

  return (
    <div className="flex min-h-screen bg-[#FDFBF7]">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-72 p-4 sm:p-6 md:p-10 lg:p-12 pt-20 md:pt-10 pb-24 md:pb-12 transition-all relative">
        {/* Page Header */}
        <PageHeader
          title="Delivery Routes"
          subtitle="Manage geographic clusters, delivery pathways & allocated customer distribution"
          badgeText="Route Directory"
          actionSlot={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                icon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : "text-slate-500"}`} />}
              >
                Refresh
              </Button>
              <Button
                onClick={() => {
                  setEditId(null);
                  setNewRouteName("");
                  setNewRouteArea("");
                  setModalOpen(true);
                }}
                icon={<Plus className="w-5 h-5" />}
              >
                Add Route
              </Button>
            </div>
          }
        />

        {/* Top KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <StatCard
            label="Total Routes"
            value={totalRoutesCount}
            subtext="Active distribution corridors"
            icon={<Map className="w-6 h-6" />}
            color="emerald"
            category="Corridors"
          />
          <StatCard
            label="Routed Customers"
            value={totalCoveredClients}
            subtext="Assigned across routes"
            icon={<Users className="w-6 h-6" />}
            color="blue"
            category="Customers"
          />
          <StatCard
            label="Route Density"
            value={`${avgClientsPerRoute} avg`}
            subtext="Clients per route corridor"
            icon={<Compass className="w-6 h-6" />}
            color="purple"
            category="Efficiency"
          />
          <StatCard
            label="Coverage Zones"
            value={uniqueAreas.length}
            subtext="Geographic sectors"
            icon={<Layers className="w-6 h-6" />}
            color="amber"
            category="Coverage"
          />
        </div>

        {/* Filter Toolbar */}
        <div className="glass-panel p-4 md:p-5 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search route name or area..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Zone Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 shrink-0">
                Zone:
              </span>
              <select
                value={selectedAreaFilter}
                onChange={e => setSelectedAreaFilter(e.target.value)}
                className="bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 cursor-pointer shadow-xs"
              >
                <option value="all">All Zones ({routes.length})</option>
                {uniqueAreas.map(area => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Routes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredRoutes.length === 0 && !loading ? (
            <div className="col-span-full py-16 text-center glass-panel">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary">
                <Map className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">No Delivery Routes Found</h3>
              <p className="text-slate-500 font-medium text-sm max-w-md mx-auto mb-5">
                {searchQuery || selectedAreaFilter !== "all"
                  ? "No routes match your current search or zone filter."
                  : "Start structuring your logistics by creating your first delivery route."}
              </p>
              <Button
                onClick={() => {
                  setEditId(null);
                  setNewRouteName("");
                  setNewRouteArea("");
                  setModalOpen(true);
                }}
                icon={<Plus className="w-4 h-4" />}
              >
                Create Delivery Route
              </Button>
            </div>
          ) : (
            filteredRoutes.map(r => {
              const routeClients = clients.filter(c => c.route_id === r.id);
              return (
                <RouteCard
                  key={r.id}
                  route={r}
                  clients={routeClients}
                  onAssignClients={() => handleOpenAssignModal(r)}
                  onEdit={() => handleEditClick(r)}
                  onDelete={() => handleDeleteClick(r.id)}
                  onViewMore={() => setViewClientsModal({ route: r, clients: routeClients })}
                />
              );
            })
          )}
        </div>

        {/* Add/Edit Route Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editId ? "Edit Delivery Route" : "Add Delivery Route"}
          subtitle="Configure route name and geographic zone for dispatching"
          width="md"
          actions={
            <div className="flex gap-4 w-full">
              <Button variant="secondary" onClick={() => setModalOpen(false)} fullWidth>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveRoute} fullWidth>
                {editId ? "Update Route" : "Save Route"}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                Route Corridor Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Hinjewadi Phase 3 Hub"
                value={newRouteName}
                onChange={e => setNewRouteName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3.5 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                Geographic Zone / Area *
              </label>
              <input
                type="text"
                placeholder="e.g. West Pune Zone B"
                value={newRouteArea}
                onChange={e => setNewRouteArea(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3.5 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm"
              />
            </div>
          </div>
        </Modal>

        {/* Assign Clients to Route Modal */}
        <Modal
          isOpen={!!assignRoute}
          onClose={() => setAssignRoute(null)}
          title={`Assign Clients to ${assignRoute?.name || "Route"}`}
          subtitle={`Select which clients should receive deliveries on this route (${assignRoute?.area || "General Zone"}).`}
          width="2xl"
          actions={
            <div className="flex gap-3 w-full">
              <Button 
                variant="secondary" 
                onClick={() => setAssignRoute(null)} 
                fullWidth
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleSaveAssignments} 
                disabled={savingAssignments}
                fullWidth
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                {savingAssignments 
                  ? "Saving Assignments..." 
                  : `Save Assignments (${selectedClientIds.size} Clients)`}
              </Button>
            </div>
          }
        >
          {assignRoute && (() => {
            const assignedCount = clients.filter(c => c.route_id === assignRoute.id).length;
            const unassignedCount = clients.filter(c => !c.route_id).length;

            return (
              <div className="space-y-4">
                {/* Search & Tabs Toolbar */}
                <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search clients by name, phone, or address..."
                      value={clientSearchQuery}
                      onChange={e => setClientSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                    {clientSearchQuery && (
                      <button
                        onClick={() => setClientSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <button
                        onClick={() => setClientFilterTab("all")}
                        className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          clientFilterTab === "all"
                            ? "bg-white shadow-xs text-primary font-black border border-slate-200"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        All ({clients.length})
                      </button>
                      <button
                        onClick={() => setClientFilterTab("assigned")}
                        className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          clientFilterTab === "assigned"
                            ? "bg-white shadow-xs text-emerald-700 font-black border border-slate-200"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        This Route ({assignedCount})
                      </button>
                      <button
                        onClick={() => setClientFilterTab("unassigned")}
                        className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          clientFilterTab === "unassigned"
                            ? "bg-white shadow-xs text-amber-700 font-black border border-slate-200"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Unassigned ({unassignedCount})
                      </button>
                    </div>

                    {/* Quick Selection Helpers */}
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <button
                        onClick={() => handleSelectAllShown(filteredModalClients)}
                        className="text-primary hover:underline cursor-pointer"
                      >
                        Select All Shown
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => handleDeselectAllShown(filteredModalClients)}
                        className="text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                </div>

                {/* Clients Selection List */}
                <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                  {filteredModalClients.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 font-medium text-xs sm:text-sm">
                      No clients found matching your filter criteria.
                    </div>
                  ) : (
                    filteredModalClients.map(c => {
                      const isSelected = selectedClientIds.has(c.id);
                      const isAssignedToThis = c.route_id === assignRoute.id;
                      const otherRoute = c.route_id && !isAssignedToThis ? routes.find(r => r.id === c.route_id) : null;

                      return (
                        <div
                          key={c.id}
                          onClick={() => handleToggleClient(c.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-sky-50/70 border-sky-300 shadow-xs"
                              : "bg-white border-slate-200/80 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Checkbox */}
                            <div className="pt-0.5 shrink-0">
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                                isSelected 
                                  ? "bg-primary border-primary text-white" 
                                  : "border-slate-300 bg-white"
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </div>

                            {/* Client Info */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-slate-800 text-sm truncate">
                                  {c.name}
                                </h4>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {c.tier || "Standard"}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                                {c.phone && (
                                  <span className="flex items-center gap-1 font-mono font-medium text-slate-700">
                                    <Phone className="w-3 h-3 text-sky-600" />
                                    {formatPhoneDisplay(c.phone)}
                                  </span>
                                )}
                                {c.address && (
                                  <span className="flex items-center gap-1 truncate max-w-xs text-slate-600">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{c.address}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Route Status Badge */}
                          <div className="shrink-0 text-right">
                            {isAssignedToThis ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3" />
                                On This Route
                              </span>
                            ) : otherRoute ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 max-w-[120px] truncate" title={`Currently on ${otherRoute.name}`}>
                                <span>Route: {otherRoute.name}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500">
                                Unassigned
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>

        {/* View Route Clients Modal */}
        <Modal
          isOpen={!!viewClientsModal}
          onClose={() => setViewClientsModal(null)}
          title={`Clients on ${viewClientsModal?.route?.name || ""}`}
          subtitle={`${viewClientsModal?.clients.length || 0} registered delivery locations in this route`}
          width="lg"
          actions={
            <div className="flex gap-3 w-full">
              <Button variant="secondary" onClick={() => setViewClientsModal(null)} fullWidth>
                Close
              </Button>
              {viewClientsModal && (
                <Button 
                  variant="primary" 
                  onClick={() => {
                    const r = viewClientsModal.route;
                    setViewClientsModal(null);
                    handleOpenAssignModal(r);
                  }}
                  icon={<UserPlus className="w-4 h-4" />}
                  fullWidth
                >
                  Manage / Assign Clients
                </Button>
              )}
            </div>
          }
        >
          {viewClientsModal && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {viewClientsModal.clients.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-medium text-sm">
                  No clients currently assigned to this route corridor.
                </div>
              ) : (
                viewClientsModal.clients.map(c => (
                  <div
                    key={c.id}
                    className="p-4 bg-slate-50/70 border border-slate-200/60 rounded-2xl flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">{c.name}</h4>
                      <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {c.address || "No address provided"}
                      </p>
                      {c.phone && (
                        <p className="text-xs text-slate-600 font-mono font-medium flex items-center gap-1.5 mt-1">
                          <Phone className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          {formatPhoneDisplay(c.phone)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                        Tier
                      </span>
                      <span className="bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-1 rounded-lg text-xs font-black">
                        {c.tier || "Standard"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
}

function RouteCard({
  route,
  clients,
  onAssignClients,
  onEdit,
  onDelete,
  onViewMore,
}: {
  route: Route;
  clients: Client[];
  onAssignClients: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewMore: () => void;
}) {
  const displayClients = clients.slice(0, 4);
  const hasMore = clients.length > 4;

  return (
    <div className="glass-card p-6 flex flex-col justify-between h-full relative group transition-all duration-300 hover:shadow-md border-slate-100 bg-white rounded-3xl">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center shrink-0 text-emerald-600">
              <Map className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800 tracking-tight leading-tight">
                {route.name}
              </h3>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 mt-1">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>{route.area || "General Zone"}</span>
              </div>
            </div>
          </div>

          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shrink-0">
            {clients.length} Clients
          </span>
        </div>

        {/* Assigned Clients Preview */}
        <div className="mb-6">
          <div className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2.5">
            Active Stops ({clients.length})
          </div>

          {clients.length === 0 ? (
            <div className="text-slate-400 text-xs italic font-medium bg-slate-50/70 rounded-2xl p-4 border border-dashed border-slate-200 text-center">
              No clients assigned yet
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 items-center">
              {displayClients.map(c => (
                <span
                  key={c.id}
                  className="bg-white text-slate-700 border border-slate-200/80 px-2.5 py-1 rounded-xl text-xs font-bold shadow-xs whitespace-nowrap"
                >
                  {c.name}
                </span>
              ))}
              {hasMore && (
                <button
                  onClick={onViewMore}
                  className="bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100 px-2.5 py-1 rounded-xl text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  +{clients.length - 4} More
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Actions: Assign Client button + Edit/Delete */}
      <div className="space-y-2 pt-4 border-t border-slate-100">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={onAssignClients} 
          className="w-full font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 shadow-2xs py-2.5"
          icon={<UserPlus className="w-4 h-4 text-sky-600" />}
        >
          Assign Clients ({clients.length})
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit} className="flex-1 font-bold text-xs" icon={<Edit2 className="w-3.5 h-3.5" />}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete} className="flex-1 font-bold text-xs" icon={<Trash2 className="w-3.5 h-3.5" />}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
