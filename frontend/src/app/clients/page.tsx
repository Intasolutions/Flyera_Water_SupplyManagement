"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Users, Search, Filter, Phone, Award, MapPin } from "lucide-react";
import { getClients, createClient, updateClient, deleteClient, Client, getRoutes, Route } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const confirm = useConfirm();

  // New client state
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTier, setNewTier] = useState("Standard"); // Note: backend doesn't have tier yet, we can add it or just ignore
  const [newOptIn, setNewOptIn] = useState(true);
  const [newRouteId, setNewRouteId] = useState("");
  const [newAddress, setNewAddress] = useState("");

  useEffect(() => {
    fetchClients();
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const data = await getRoutes();
      setRoutes(data);
    } catch (error) {
      console.error("Failed to fetch routes:", error);
    }
  };

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await getClients();
      setClients(data);
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClient = async () => {
    if (newName) {
      try {
        const payload = {
          name: newName,
          phone: newPhone || null,
          address: newAddress || null,
          opt_in_loyalty: newOptIn,
          route_id: newRouteId || null,
        };
        
        if (editId) {
          await updateClient(editId, payload);
        } else {
          await createClient(payload);
        }
        
        await fetchClients();
        setModalOpen(false);
        setEditId(null);
        setNewName("");
        setNewPhone("");
        setNewAddress("");
        setNewTier("Standard");
        setNewOptIn(true);
        setNewRouteId("");
        toast.success(editId ? "Client updated successfully!" : "Client created successfully!");
      } catch (error: any) {
        console.error("Failed to save client:", error);
        toast.error(error.message || "Failed to save client.");
      }
    }
  };

  const handleEditClick = (c: Client) => {
    setEditId(c.id);
    setNewName(c.name);
    setNewPhone(c.phone || "");
    setNewAddress(c.address || "");
    setNewOptIn(c.opt_in_loyalty);
    setNewRouteId(c.route_id || "");
    setModalOpen(true);
  };

  const handleAddClick = () => {
    setEditId(null);
    setNewName("");
    setNewPhone("");
    setNewAddress("");
    setNewTier("Standard");
    setNewOptIn(true);
    setNewRouteId("");
    setModalOpen(true);
  };

  const handleDeleteClient = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Delete Client",
      message: "Are you sure you want to delete this client? They will be removed from all routes.",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    
    if (isConfirmed) {
      try {
        await deleteClient(id);
        await fetchClients();
        toast.success("Client deleted successfully.");
      } catch (error: any) {
        console.error("Failed to delete client:", error);
        toast.error(error.message || "Failed to delete client.");
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8 transition-all relative">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text mb-1">Client Management</h1>
            <p className="text-text-muted">Manage your clients, pricing, and loyalty points.</p>
          </div>
          <Button onClick={handleAddClick} icon={<Users className="w-5 h-5" />}>
            Add Client
          </Button>
        </header>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-black/5 flex flex-col md:flex-row justify-between gap-4">
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="w-5 h-5 absolute left-3 top-2.5 text-text-muted" />
                <input 
                  type="text" 
                  placeholder="Search clients by name or phone..." 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-text font-medium"
                />
              </div>
              <Button variant="outline" className="px-3" icon={<Filter className="w-5 h-5" />} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {clients.map(c => {
              const clientRoute = routes.find(r => r.id === c.route_id);
              return (
                <ClientCard key={c.id} {...c} routeName={clientRoute?.name} onEdit={() => handleEditClick(c)} onDelete={() => handleDeleteClient(c.id)} />
              );
            })}
            {clients.length === 0 && !loading && (
              <div className="col-span-full py-12 text-center text-text-muted bg-white border border-gray-100 rounded-2xl shadow-sm">
                No clients found.
              </div>
            )}
          </div>
        </div>

        {/* Add Client Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editId ? "Edit Client" : "New Client"}
          width="2xl"
          actions={
            <div className="flex gap-4 w-full">
              <Button variant="secondary" onClick={() => setModalOpen(false)} fullWidth>Cancel</Button>
              <Button variant="primary" onClick={handleSaveClient} fullWidth>
                {editId ? "Update Client" : "Save Client"}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Business/Client Name</label>
                <input type="text" placeholder="e.g. Fresh Bites Cafe" value={newName} onChange={e => setNewName(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Phone Number</label>
                <input type="text" placeholder="+91 XXXXX XXXXX" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Address</label>
              <input type="text" placeholder="Full Address" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Assign Route</label>
                <select value={newRouteId} onChange={e => setNewRouteId(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                  <option value="">Unassigned (No Route)</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.area})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Pricing Tier</label>
                <select value={newTier} onChange={e => setNewTier(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                  <option value="Standard">Standard (₹80/20L)</option>
                  <option value="Wholesale">Wholesale (₹65/20L)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <input type="checkbox" checked={newOptIn} onChange={e => setNewOptIn(e.target.checked)} className="w-5 h-5 rounded text-primary focus:ring-primary/20 cursor-pointer" />
              <span className="font-bold text-slate-700 select-none">Opt-in to Loyalty Program</span>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}

function ClientCard({ name, phone, address, routeName, loyalty_points, opt_in_loyalty, onEdit, onDelete }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col h-full relative overflow-hidden group">
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-lg text-slate-800 tracking-tight leading-tight mb-1">{name}</h3>
          <div className="flex items-center text-slate-500 text-sm font-medium gap-1.5">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            {phone || "No phone"}
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-600 rounded-lg">Standard</span>
      </div>

      <div className="space-y-3 flex-1">
        <div className="flex items-start gap-2 text-sm">
          <div className="mt-0.5"><MapPin className="w-4 h-4 text-primary" /></div>
          <div>
            <div className="font-semibold text-slate-700">{routeName || "Unassigned Route"}</div>
            <div className="text-slate-500 text-xs mt-0.5">{address || "No address provided"}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
          {opt_in_loyalty ? (
            <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100/50">
              <Award className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-amber-700 text-sm">{loyalty_points || 0} pts</span>
            </div>
          ) : (
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl uppercase tracking-wider">Opted Out</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
        <Button variant="secondary" size="sm" onClick={onEdit} className="flex-1">Edit</Button>
        <Button variant="danger" size="sm" onClick={onDelete} className="flex-1">Delete</Button>
      </div>
    </div>
  );
}
