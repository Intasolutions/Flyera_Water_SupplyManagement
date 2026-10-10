"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Car, Plus, Search, Filter, CheckCircle, XCircle } from "lucide-react";
import { getVehicles, createVehicle, updateVehicle, deleteVehicle, Vehicle } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const confirm = useConfirm();

  // New vehicle state
  const [newPlateNumber, setNewPlateNumber] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const data = await getVehicles();
      setVehicles(data);
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (newPlateNumber) {
      try {
        const payload = {
          plate_number: newPlateNumber,
          model: newModel || null,
          is_active: newIsActive,
        };
        
        if (editId) {
          await updateVehicle(editId, payload);
        } else {
          await createVehicle(payload);
        }
        
        await fetchVehicles();
        setModalOpen(false);
        setEditId(null);
        setNewPlateNumber("");
        setNewModel("");
        setNewIsActive(true);
        toast.success(editId ? "Vehicle updated successfully!" : "Vehicle created successfully!");
      } catch (error: any) {
        console.error("Failed to save vehicle:", error);
        toast.error(error.message || "Failed to save vehicle.");
      }
    }
  };

  const handleEditClick = (v: Vehicle) => {
    setEditId(v.id);
    setNewPlateNumber(v.plate_number);
    setNewModel(v.model || "");
    setNewIsActive(v.is_active);
    setModalOpen(true);
  };

  const handleAddClick = () => {
    setEditId(null);
    setNewPlateNumber("");
    setNewModel("");
    setNewIsActive(true);
    setModalOpen(true);
  };

  const handleDeleteVehicle = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Delete Vehicle",
      message: "Are you sure you want to delete this vehicle? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    
    if (isConfirmed) {
      try {
        await deleteVehicle(id);
        await fetchVehicles();
        toast.success("Vehicle deleted successfully.");
      } catch (error: any) {
        console.error("Failed to delete vehicle:", error);
        toast.error(error.message || "Failed to delete vehicle.");
      }
    }
  };

  const activeVehicles = vehicles.filter(v => v.is_active).length;
  const totalVehicles = vehicles.length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8 transition-all relative">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text mb-1">Vehicle Fleet</h1>
            <p className="text-text-muted">Manage your delivery vehicles and their statuses.</p>
          </div>
          <Button onClick={handleAddClick} icon={<Plus className="w-5 h-5" />}>
            Add Vehicle
          </Button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-text-muted font-medium mb-1">Active Vehicles</h3>
              <p className="text-3xl font-bold text-text">{activeVehicles} <span className="text-sm font-medium text-text-muted">/ {totalVehicles}</span></p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <XCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-text-muted font-medium mb-1">Inactive / Maintenance</h3>
              <p className="text-3xl font-bold text-text">{totalVehicles - activeVehicles}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-black/5 flex flex-col md:flex-row justify-between gap-4">
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="w-5 h-5 absolute left-3 top-2.5 text-text-muted" />
                <input 
                  type="text" 
                  placeholder="Search by plate number..." 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-text font-medium"
                />
              </div>
              <Button variant="outline" className="px-3" icon={<Filter className="w-5 h-5" />} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {vehicles.length === 0 && !loading && (
              <div className="col-span-full py-12 text-center text-text-muted bg-white border border-gray-100 rounded-2xl shadow-sm">
                No vehicles found. Click "Add Vehicle" to create one.
              </div>
            )}
            {vehicles.map(v => (
              <VehicleCard 
                key={v.id} 
                {...v} 
                onEdit={() => handleEditClick(v)} 
                onDelete={() => handleDeleteVehicle(v.id)} 
              />
            ))}
          </div>
        </div>

        {/* Add/Edit Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editId ? "Edit Vehicle" : "Add Vehicle"}
          width="md"
          actions={
            <div className="flex gap-4 w-full">
              <Button variant="secondary" onClick={() => setModalOpen(false)} fullWidth>Cancel</Button>
              <Button variant="primary" onClick={handleSaveVehicle} fullWidth>
                {editId ? "Update Vehicle" : "Save Vehicle"}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Plate Number</label>
              <input type="text" placeholder="e.g. MH12 AB1234" value={newPlateNumber} onChange={e => setNewPlateNumber(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Model Description (Optional)</label>
              <input type="text" placeholder="e.g. Tata Ace Gold" value={newModel} onChange={e => setNewModel(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <input type="checkbox" checked={newIsActive} onChange={e => setNewIsActive(e.target.checked)} className="w-5 h-5 rounded text-primary focus:ring-primary/20 cursor-pointer" />
              <span className="font-bold text-slate-700 select-none">Vehicle is Active and ready for deliveries</span>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}

function VehicleCard({ plate_number, model, is_active, onEdit, onDelete }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col h-full relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r ${is_active ? 'from-emerald-400 to-emerald-600' : 'from-red-400 to-red-600'}`}></div>
      
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <Car className="w-6 h-6 text-slate-500" />
          </div>
          <div>
            <h3 className="font-black text-xl text-slate-800 tracking-wider font-mono">{plate_number}</h3>
            <div className="text-slate-500 text-sm font-medium">{model || "No model specified"}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col mb-4">
        <div className="mt-2">
          {is_active ? (
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-center gap-2 w-fit text-sm font-bold shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active Vehicle
            </span>
          ) : (
            <span className="px-3 py-1.5 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-2 w-fit text-sm font-bold shadow-sm">
              <div className="w-2 h-2 rounded-full bg-red-500" /> Inactive
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-slate-100 mt-auto">
        <Button variant="secondary" size="sm" onClick={onEdit} className="flex-1">Edit</Button>
        <Button variant="danger" size="sm" onClick={onDelete} className="flex-1">Delete</Button>
      </div>
    </div>
  );
}
