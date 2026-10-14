"use client";

import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { 
  Truck, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Edit2,
  Trash2,
  ShieldCheck,
  Zap
} from "lucide-react";
import { getVehicles, createVehicle, updateVehicle, deleteVehicle, Vehicle } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const confirm = useConfirm();

  // Form states
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
      setVehicles(data || []);
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
      toast.error("Failed to load vehicle fleet");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (!newPlateNumber.trim()) {
      toast.error("Please enter a plate number");
      return;
    }

    try {
      const payload = {
        plate_number: newPlateNumber.trim().toUpperCase(),
        model: newModel.trim() || null,
        is_active: newIsActive,
      };
      
      if (editId) {
        await updateVehicle(editId, payload);
        toast.success("Vehicle updated successfully!");
      } else {
        await createVehicle(payload);
        toast.success("Vehicle registered to fleet!");
      }
      
      await fetchVehicles();
      setModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Failed to save vehicle:", error);
      toast.error(error.message || "Failed to save vehicle");
    }
  };

  const resetForm = () => {
    setEditId(null);
    setNewPlateNumber("");
    setNewModel("");
    setNewIsActive(true);
  };

  const handleEditClick = (v: Vehicle) => {
    setEditId(v.id);
    setNewPlateNumber(v.plate_number);
    setNewModel(v.model || "");
    setNewIsActive(v.is_active);
    setModalOpen(true);
  };

  const handleAddClick = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleDeleteVehicle = async (id: string, plate: string) => {
    const isConfirmed = await confirm({
      title: "Remove Vehicle",
      message: `Are you sure you want to remove vehicle "${plate}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    
    if (isConfirmed) {
      try {
        await deleteVehicle(id);
        await fetchVehicles();
        toast.success("Vehicle removed from fleet.");
      } catch (error: any) {
        console.error("Failed to delete vehicle:", error);
        toast.error(error.message || "Failed to delete vehicle");
      }
    }
  };

  // Filter dynamically
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchesSearch = 
        (v.plate_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.model || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = 
        statusFilter === "all" || 
        (statusFilter === "active" ? v.is_active : !v.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [vehicles, searchQuery, statusFilter]);

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter(v => v.is_active).length;
  const inactiveVehicles = totalVehicles - activeVehicles;
  const fleetReadiness = totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 100;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-72 p-4 sm:p-6 md:p-10 lg:p-12 pt-20 md:pt-10 pb-24 md:pb-12 transition-all max-w-7xl">
        <PageHeader 
          title="Vehicle Fleet" 
          subtitle="Manage delivery trucks, registration numbers, and maintenance readiness."
          badge={`${activeVehicles} Active Fleet`}
          badgeColor="emerald"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchVehicles()}
                title="Refresh fleet"
                className="p-2.5 bg-white border border-gray-200 hover:border-primary rounded-xl shadow-sm text-text-muted hover:text-primary transition-all active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
              </button>
              <Button 
                onClick={handleAddClick} 
                icon={<Plus className="w-4 h-4" />}
                className="shadow-md"
              >
                Add Vehicle
              </Button>
            </div>
          }
        />

        {/* Top KPI Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 md:mb-8">
          <StatCard 
            title="Total Fleet" 
            value={totalVehicles} 
            trend="Registered vehicles"
            icon={<Truck className="w-5 h-5 text-blue-600" />}
            badge="Vehicles"
            color="blue"
          />
          <StatCard 
            title="Active on Duty" 
            value={activeVehicles} 
            trend="Ready for route dispatch"
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            badge="Operational"
            color="emerald"
          />
          <StatCard 
            title="Maintenance / Idle" 
            value={inactiveVehicles} 
            trend="Temporarily offline"
            icon={<AlertCircle className="w-5 h-5 text-rose-600" />}
            badge="Standby"
            color="rose"
          />
          <StatCard 
            title="Fleet Readiness" 
            value={`${fleetReadiness}%`} 
            trend="Overall availability rate"
            icon={<Zap className="w-5 h-5 text-amber-600" />}
            badge="Capacity"
            color="amber"
          />
        </div>

        {/* Search & Filter Toolbar */}
        <div className="glass-panel p-4 md:p-5 rounded-3xl mb-8 border border-black/5 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search by plate number or vehicle model..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-gray-200 rounded-xl outline-none text-text text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex bg-surface border border-gray-200 rounded-xl p-1 shadow-sm text-xs font-bold">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === "all" ? "bg-white shadow text-primary font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  All ({totalVehicles})
                </button>
                <button
                  onClick={() => setStatusFilter("active")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === "active" ? "bg-white shadow text-emerald-600 font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  Active ({activeVehicles})
                </button>
                <button
                  onClick={() => setStatusFilter("inactive")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === "inactive" ? "bg-white shadow text-rose-600 font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  Standby ({inactiveVehicles})
                </button>
              </div>

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs font-bold text-primary hover:underline px-2 py-1 shrink-0"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Vehicles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map(v => (
            <VehicleCard 
              key={v.id} 
              vehicle={v} 
              onEdit={() => handleEditClick(v)} 
              onDelete={() => handleDeleteVehicle(v.id, v.plate_number)} 
            />
          ))}

          {filteredVehicles.length === 0 && !loading && (
            <div className="col-span-full p-12 text-center bg-surface/60 rounded-3xl border border-dashed border-gray-200">
              <Truck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-text">No vehicles found</h3>
              <p className="text-text-muted text-sm mt-1 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "No vehicles matched your filter. Try clearing filters."
                  : "Start registering your delivery trucks to assign drivers."}
              </p>
              <div className="mt-4">
                <Button onClick={handleAddClick} icon={<Plus className="w-4 h-4" />} size="sm">
                  Add Vehicle
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Add / Edit Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editId ? "Update Vehicle Information" : "Register New Vehicle"}
          subtitle={editId ? "Modify plate number and operational status." : "Add a delivery vehicle to your distribution fleet."}
          width="md"
          actions={
            <div className="flex gap-3 w-full">
              <Button variant="secondary" onClick={() => setModalOpen(false)} fullWidth>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveVehicle} fullWidth>
                {editId ? "Save Changes" : "Register Vehicle"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                License Plate Number
              </label>
              <input 
                type="text" 
                placeholder="e.g. MH 12 AB 1234" 
                value={newPlateNumber} 
                onChange={e => setNewPlateNumber(e.target.value)} 
                className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text font-mono font-bold tracking-wider uppercase focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" 
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                Model / Vehicle Spec (Optional)
              </label>
              <input 
                type="text" 
                placeholder="e.g. Tata Ace Gold (1.5 Ton)" 
                value={newModel} 
                onChange={e => setNewModel(e.target.value)} 
                className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" 
              />
            </div>

            <div className="p-4 bg-surface rounded-xl border border-black/5 flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-text">Operational Status</p>
                  <p className="text-xs text-text-muted">Vehicle is active and available for route assignment</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={newIsActive} 
                onChange={e => setNewIsActive(e.target.checked)} 
                className="w-5 h-5 rounded text-primary focus:ring-primary/20 cursor-pointer" 
              />
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}

function VehicleCard({ 
  vehicle, 
  onEdit, 
  onDelete 
}: { 
  vehicle: Vehicle; 
  onEdit: () => void; 
  onDelete: () => void; 
}) {
  return (
    <div className="glass-panel p-5 rounded-3xl hover:shadow-md transition-all border border-black/5 flex flex-col justify-between group relative overflow-hidden">
      <div>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border border-black/5 shadow-sm group-hover:scale-110 transition-transform ${
              vehicle.is_active ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            }`}>
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-xl text-text font-mono tracking-wider group-hover:text-primary transition-colors">
                {vehicle.plate_number}
              </h3>
              <p className="text-xs text-text-muted font-medium mt-0.5">
                {vehicle.model || "Standard Delivery Truck"}
              </p>
            </div>
          </div>
        </div>

        <div className="py-3 border-y border-black/5 my-3 flex items-center justify-between">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
            Status
          </span>
          {vehicle.is_active ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-lg shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active on Duty
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg shadow-sm">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Maintenance Standby
            </span>
          )}
        </div>
      </div>

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
