"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Map, Search, Filter, Plus, MapPin, Users } from "lucide-react";
import { getRoutes, createRoute, updateRoute, deleteRoute, Route, getClients, Client } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewClientsModal, setViewClientsModal] = useState<{route: Route, clients: Client[]} | null>(null);
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
      setRoutes(routesData);
      setClients(clientsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoute = async () => {
    if (newRouteName && newRouteArea) {
      try {
        const payload = {
          name: newRouteName,
          area: newRouteArea,
        };
        
        if (editId) {
          await updateRoute(editId, payload);
        } else {
          await createRoute(payload);
        }
        
        await fetchData();
        setModalOpen(false);
        setEditId(null);
        setNewRouteArea("");
        toast.success(editId ? "Route updated successfully!" : "Route created successfully!");
      } catch (error: any) {
        console.error("Failed to save route:", error);
        toast.error("Failed to save route: " + error.message);
      }
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
      message: "Are you sure you want to delete this route? This will affect deliveries.",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    if (isConfirmed) {
      try {
        await deleteRoute(id);
        await fetchData();
        toast.success("Route deleted successfully.");
      } catch (error: any) {
        toast.error("Failed to delete route: " + error.message);
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8 transition-all relative">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text mb-1">Delivery Routes</h1>
            <p className="text-text-muted">Manage active delivery areas and paths.</p>
          </div>
          <Button 
            onClick={() => { setEditId(null); setNewRouteName(""); setNewRouteArea(""); setModalOpen(true); }} 
            icon={<Plus className="w-5 h-5" />}
          >
            Add Route
          </Button>
        </header>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-black/5 flex flex-col md:flex-row justify-between gap-4">
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="w-5 h-5 absolute left-3 top-2.5 text-text-muted" />
                <input 
                  type="text" 
                  placeholder="Search routes..." 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-text font-medium"
                />
              </div>
              <Button variant="outline" className="px-3" icon={<Filter className="w-5 h-5" />} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {routes.length === 0 && !loading && (
              <div className="col-span-full py-12 text-center text-text-muted bg-white border border-gray-100 rounded-2xl shadow-sm">
                No routes found.
              </div>
            )}
            {routes.map(r => {
              const routeClients = clients.filter(c => c.route_id === r.id);
              return (
                <RouteCard 
                  key={r.id} 
                  route={r} 
                  clients={routeClients}
                  onEdit={() => handleEditClick(r)}
                  onDelete={() => handleDeleteClick(r.id)}
                  onViewMore={() => setViewClientsModal({route: r, clients: routeClients})}
                />
              );
            })}
          </div>

        {/* Add/Edit Route Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editId ? "Edit Route" : "Add Delivery Route"}
          width="md"
          actions={
            <div className="flex gap-4 w-full">
              <Button variant="secondary" onClick={() => setModalOpen(false)} fullWidth>Cancel</Button>
              <Button variant="primary" onClick={handleSaveRoute} fullWidth>
                {editId ? "Update Route" : "Save Route"}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Route Name</label>
              <input type="text" placeholder="e.g. Hinjewadi Phase 3" value={newRouteName} onChange={e => setNewRouteName(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Area / Zone</label>
              <input type="text" placeholder="e.g. West Pune" value={newRouteArea} onChange={e => setNewRouteArea(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
          </div>
        </Modal>

        {/* View Clients Modal */}
        <Modal
          isOpen={!!viewClientsModal}
          onClose={() => setViewClientsModal(null)}
          title={`Clients on ${viewClientsModal?.route?.name || ''}`}
          width="md"
          actions={
            <Button variant="secondary" onClick={() => setViewClientsModal(null)} fullWidth>
              Close
            </Button>
          }
        >
          {viewClientsModal && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {viewClientsModal.clients.map(c => (
                <div key={c.id} className="p-4 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800">{c.name}</h4>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {c.address || 'No address'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-500 block mb-1">Tier</span>
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-bold">
                      {c.tier}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
}

function RouteCard({ route, clients, onEdit, onDelete, onViewMore }: { route: Route, clients: Client[], onEdit: () => void, onDelete: () => void, onViewMore: () => void }) {
  const displayClients = clients.slice(0, 5);
  const hasMore = clients.length > 5;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col h-full relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100/50">
          <Map className="w-6 h-6 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-800 tracking-tight leading-tight">{route.name}</h3>
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" /> {route.area || "No area specified"}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col mb-4">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active Clients ({clients.length})</div>
        {clients.length === 0 ? (
          <div className="text-slate-400 text-sm italic font-medium bg-slate-50 rounded-xl p-3 border border-slate-100 border-dashed">No active clients assigned</div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {displayClients.map(c => (
              <span key={c.id} className="bg-blue-50 text-blue-700 border border-blue-100/50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm whitespace-nowrap">
                {c.name}
              </span>
            ))}
            {hasMore && (
              <button onClick={onViewMore} className="bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors shadow-sm whitespace-nowrap active:scale-95">
                +{clients.length - 5} More
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-4 border-t border-slate-100 mt-auto">
        <Button variant="secondary" size="sm" onClick={onEdit} className="flex-1">Edit</Button>
        <Button variant="danger" size="sm" onClick={onDelete} className="flex-1">Delete</Button>
      </div>
    </div>
  );
}
