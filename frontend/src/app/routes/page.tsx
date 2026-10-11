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
  ExternalLink
} from "lucide-react";
import { getRoutes, createRoute, updateRoute, deleteRoute, Route, getClients, Client } from "@/lib/api";
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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

        {/* View Route Clients Modal */}
        <Modal
          isOpen={!!viewClientsModal}
          onClose={() => setViewClientsModal(null)}
          title={`Clients on ${viewClientsModal?.route?.name || ""}`}
          subtitle={`${viewClientsModal?.clients.length || 0} registered delivery locations in this route`}
          width="lg"
          actions={
            <Button variant="secondary" onClick={() => setViewClientsModal(null)} fullWidth>
              Close
            </Button>
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
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                        Subscription
                      </span>
                      <span className="bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-1 rounded-lg text-xs font-black">
                        {c.tier}
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
  onEdit,
  onDelete,
  onViewMore,
}: {
  route: Route;
  clients: Client[];
  onEdit: () => void;
  onDelete: () => void;
  onViewMore: () => void;
}) {
  const displayClients = clients.slice(0, 4);
  const hasMore = clients.length > 4;

  return (
    <div className="glass-card p-6 flex flex-col justify-between h-full relative group transition-all duration-300 hover:shadow-md border-slate-100">
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
                  className="bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100 px-2.5 py-1 rounded-xl text-xs font-black transition-all shadow-xs active:scale-95"
                >
                  +{clients.length - 4} More
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Actions */}
      <div className="flex gap-2 pt-4 border-t border-slate-100">
        <Button variant="secondary" size="sm" onClick={onEdit} className="flex-1" icon={<Edit2 className="w-3.5 h-3.5" />}>
          Edit
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete} className="flex-1" icon={<Trash2 className="w-3.5 h-3.5" />}>
          Delete
        </Button>
      </div>
    </div>
  );
}
