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
  Plus, 
  UserCheck, 
  ShieldAlert, 
  Truck, 
  UserPlus, 
  User as UserIcon,
  RefreshCw,
  Edit2,
  Trash2,
  Shield,
  Recycle,
  CheckCircle2,
  Eye,
  EyeOff
} from "lucide-react";
import { getUsers, createUser, updateUser, deleteUser, getVehicles, User, Vehicle } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function StaffPage() {
  const [staff, setStaff] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const confirm = useConfirm();

  // Form states
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("DRIVER");
  const [newAddress, setNewAddress] = useState("");
  const [newIdProofUrl, setNewIdProofUrl] = useState("");
  const [newAssignedVehicle, setNewAssignedVehicle] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchStaff();
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const data = await getVehicles();
      setVehicles(data || []);
    } catch (e) {
      console.error("Failed to load vehicles:", e);
    }
  };

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setStaff(data || []);
    } catch (error) {
      console.error("Failed to fetch staff:", error);
      toast.error("Failed to load staff roster");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStaff = async () => {
    if (!newName.trim()) {
      toast.error("Please enter a staff name");
      return;
    }

    if (!editId && !newPassword) {
      toast.error("Please provide a password for new account");
      return;
    }

    try {
      const payload: any = {
        name: newName.trim(),
        role: newRole,
        phone: newPhone.trim() || null,
        username: newUsername.trim() || null,
        address: newAddress.trim() || null,
        id_proof_url: newIdProofUrl || null,
        assigned_vehicle_id: newRole === "GLASS_DRIVER" || newRole === "DRIVER" ? (newAssignedVehicle || null) : null,
      };
      
      if (editId) {
        await updateUser(editId, payload);
        toast.success("Staff profile updated!");
      } else {
        payload.password = newPassword;
        await createUser(payload);
        toast.success("New staff member registered!");
      }
      
      await fetchStaff();
      setModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Failed to save staff:", error);
      toast.error(error.message || "Failed to save staff member");
    }
  };

  const resetForm = () => {
    setEditId(null);
    setNewName("");
    setNewUsername("");
    setNewPassword("");
    setNewPhone("");
    setNewRole("DRIVER");
    setNewAddress("");
    setNewIdProofUrl("");
    setNewAssignedVehicle("");
  };

  const handleEditClick = (s: User) => {
    setEditId(s.id);
    setNewName(s.name);
    setNewUsername(s.username || "");
    setNewPassword("");
    setNewPhone(s.phone || "");
    setNewRole(s.role);
    setNewAddress(s.address || "");
    setNewIdProofUrl(s.id_proof_url || "");
    setNewAssignedVehicle(s.assigned_vehicle_id || "");
    setModalOpen(true);
  };

  const handleAddClick = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: "Remove Staff Member",
      message: `Are you sure you want to remove "${name}" from the roster? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    
    if (isConfirmed) {
      try {
        await deleteUser(id);
        await fetchStaff();
        toast.success("Staff member removed.");
      } catch (error: any) {
        console.error("Failed to delete staff:", error);
        toast.error(error.message || "Failed to delete staff member");
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("/api/users/upload-id", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setNewIdProofUrl(data.url);
      toast.success("ID proof uploaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload ID proof.");
    } finally {
      setUploading(false);
    }
  };

  // Filter dynamically
  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const matchesSearch = 
        (s.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.username || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = 
        roleFilter === "all" || s.role.toUpperCase() === roleFilter.toUpperCase();

      return matchesSearch && matchesRole;
    });
  }, [staff, searchQuery, roleFilter]);

  const totalHeadcount = staff.length;
  const totalWaterStaff = staff.filter(s => s.role.toUpperCase() === "WATER_STAFF").length;
  const totalDrivers = staff.filter(s => s.role.toUpperCase() === "DRIVER").length;
  const totalHelpers = staff.filter(s => s.role.toUpperCase() === "HELPER").length;
  const totalGlass = staff.filter(s => s.role.toUpperCase().includes("GLASS")).length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-72 p-4 sm:p-6 md:p-10 lg:p-12 pt-20 md:pt-10 pb-24 md:pb-12 transition-all max-w-7xl">
        <PageHeader 
          title="Staff & Personnel" 
          subtitle="Manage delivery drivers, route helpers, warehouse operators, and credentials."
          badge={`${totalHeadcount} Active Personnel`}
          badgeColor="blue"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchStaff()}
                title="Refresh staff"
                className="p-2.5 bg-white border border-gray-200 hover:border-primary rounded-xl shadow-sm text-text-muted hover:text-primary transition-all active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
              </button>
              <Button 
                onClick={handleAddClick} 
                icon={<Plus className="w-4 h-4" />}
                className="shadow-md"
              >
                Add Staff Member
              </Button>
            </div>
          }
        />

        {/* Top KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard 
            title="Total Team" 
            value={totalHeadcount} 
            trend="Active accounts"
            icon={<Users className="w-5 h-5 text-blue-600" />}
            badge="Team"
            color="blue"
          />
          <StatCard 
            title="Water Staff" 
            value={totalWaterStaff} 
            trend="Desk & operations"
            icon={<Users className="w-5 h-5 text-sky-600" />}
            badge="Operations"
            color="blue"
          />
          <StatCard 
            title="Water Drivers" 
            value={totalDrivers} 
            trend="Assigned to delivery routes"
            icon={<Truck className="w-5 h-5 text-emerald-600" />}
            badge="Drivers"
            color="emerald"
          />
          <StatCard 
            title="Route Helpers" 
            value={totalHelpers} 
            trend="Assisting delivery crews"
            icon={<UserCheck className="w-5 h-5 text-cyan-600" />}
            badge="Helpers"
            color="cyan"
          />
          <StatCard 
            title="Glass Personnel" 
            value={totalGlass} 
            trend="Collections & godown"
            icon={<Recycle className="w-5 h-5 text-purple-600" />}
            badge="Recycling"
            color="purple"
          />
        </div>

        {/* Search & Filter Toolbar */}
        <div className="glass-panel p-4 md:p-5 rounded-3xl mb-8 border border-black/5 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search staff by name, phone, or username..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-gray-200 rounded-xl outline-none text-text text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <div className="flex bg-surface border border-gray-200 rounded-xl p-1 shadow-sm text-xs font-bold flex-wrap">
                <button
                  onClick={() => setRoleFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    roleFilter === "all" ? "bg-white shadow text-primary font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  All ({totalHeadcount})
                </button>
                <button
                  onClick={() => setRoleFilter("WATER_STAFF")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    roleFilter === "WATER_STAFF" ? "bg-white shadow text-sky-600 font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  Water Staff ({totalWaterStaff})
                </button>
                <button
                  onClick={() => setRoleFilter("DRIVER")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    roleFilter === "DRIVER" ? "bg-white shadow text-blue-600 font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  Drivers ({totalDrivers})
                </button>
                <button
                  onClick={() => setRoleFilter("HELPER")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    roleFilter === "HELPER" ? "bg-white shadow text-cyan-600 font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  Helpers ({totalHelpers})
                </button>
                <button
                  onClick={() => setRoleFilter("GLASS_DRIVER")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    roleFilter === "GLASS_DRIVER" ? "bg-white shadow text-purple-600 font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  Glass ({totalGlass})
                </button>
                <button
                  onClick={() => setRoleFilter("ADMIN")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    roleFilter === "ADMIN" ? "bg-white shadow text-amber-600 font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  Admin
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

        {/* Staff Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map(s => {
            const assignedVeh = vehicles.find(v => v.id === s.assigned_vehicle_id);
            return (
              <StaffCard 
                key={s.id} 
                staff={s} 
                assignedVehiclePlate={assignedVeh?.plate_number}
                onEdit={() => handleEditClick(s)} 
                onDelete={() => handleDeleteStaff(s.id, s.name)} 
              />
            );
          })}

          {filteredStaff.length === 0 && !loading && (
            <div className="col-span-full p-12 text-center bg-surface/60 rounded-3xl border border-dashed border-gray-200">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-text">No staff members found</h3>
              <p className="text-text-muted text-sm mt-1 max-w-sm mx-auto">
                {searchQuery || roleFilter !== "all"
                  ? "No staff match your current filter criteria."
                  : "Start onboarding drivers and helpers to assign deliveries."}
              </p>
              <div className="mt-4">
                <Button onClick={handleAddClick} icon={<Plus className="w-4 h-4" />} size="sm">
                  Add Staff Member
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Add / Edit Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editId ? "Update Staff Profile" : "Register Staff Member"}
          subtitle={editId ? "Modify roles, contact number, or vehicle link." : "Create credentials and roles for fleet operators."}
          width="2xl"
          actions={
            <div className="flex gap-3 w-full">
              <Button variant="secondary" onClick={() => setModalOpen(false)} fullWidth>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveStaff} fullWidth>
                {editId ? "Save Profile" : "Create Account"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                  Full Name
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Ramesh Kumar" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium" 
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                  Role
                </label>
                <select 
                  value={newRole} 
                  onChange={e => setNewRole(e.target.value)} 
                  className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium appearance-none cursor-pointer"
                >
                  <option value="WATER_STAFF">Water Staff (Operations / Desk)</option>
                  <option value="DRIVER">Delivery Driver (Water)</option>
                  <option value="HELPER">Route Helper (Water)</option>
                  <option value="GLASS_DRIVER">Collection Driver (Glass)</option>
                  <option value="GLASS_STAFF">Godown Worker (Glass)</option>
                  <option value="ADMIN">Administrator (Owner)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                  Login Username
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. ramesh_driver" 
                  value={newUsername} 
                  onChange={e => setNewUsername(e.target.value)} 
                  className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium" 
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                  Password {editId ? "(Leave blank to keep unchanged)" : ""}
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder={editId ? "••••••••" : "Choose password"} 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    className="w-full bg-surface border border-gray-200 rounded-xl pl-4 pr-11 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-muted hover:text-text transition-colors focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                  Phone Number
                </label>
                <input 
                  type="text" 
                  placeholder="+91 98765 43210" 
                  value={newPhone} 
                  onChange={e => setNewPhone(e.target.value)} 
                  className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium" 
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                  Assign Vehicle (For Drivers)
                </label>
                <select 
                  value={newAssignedVehicle} 
                  onChange={e => setNewAssignedVehicle(e.target.value)} 
                  className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium appearance-none cursor-pointer"
                >
                  <option value="">No Vehicle Assigned</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.plate_number} ({v.model || "Truck"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                Residential Address
              </label>
              <input 
                type="text" 
                placeholder="Full residential address" 
                value={newAddress} 
                onChange={e => setNewAddress(e.target.value)} 
                className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" 
              />
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}

function StaffCard({ 
  staff, 
  assignedVehiclePlate, 
  onEdit, 
  onDelete 
}: { 
  staff: User; 
  assignedVehiclePlate?: string; 
  onEdit: () => void; 
  onDelete: () => void; 
}) {
  const roleConfig = {
    WATER_STAFF: { label: "Water Staff", bg: "bg-sky-50 text-sky-700 border-sky-100", icon: Users },
    DRIVER: { label: "Water Driver", bg: "bg-blue-50 text-blue-700 border-blue-100", icon: Truck },
    HELPER: { label: "Route Helper", bg: "bg-cyan-50 text-cyan-700 border-cyan-100", icon: UserCheck },
    GLASS_DRIVER: { label: "Glass Driver", bg: "bg-purple-50 text-purple-700 border-purple-100", icon: Recycle },
    GLASS_STAFF: { label: "Godown Worker", bg: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: Recycle },
    ADMIN: { label: "Administrator", bg: "bg-amber-50 text-amber-700 border-amber-100", icon: Shield }
  }[staff.role.toUpperCase()] || { label: staff.role, bg: "bg-gray-50 text-gray-700 border-gray-100", icon: UserIcon };

  const RoleIconComponent = roleConfig.icon;

  const initials = staff.name
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="glass-panel p-5 rounded-3xl hover:shadow-md transition-all border border-black/5 flex flex-col justify-between group relative overflow-hidden">
      <div>
        <div className="flex justify-between items-start mb-3 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 text-white font-black text-sm flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              {initials}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-text tracking-tight group-hover:text-primary transition-colors">
                {staff.name}
              </h3>
              <p className="text-xs text-text-muted font-medium mt-0.5">
                @{staff.username || "no-login"}
              </p>
            </div>
          </div>

          <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-md border ${roleConfig.bg}`}>
            {roleConfig.label}
          </span>
        </div>

        <div className="space-y-2 py-3 border-y border-black/5 my-3 text-xs">
          <div className="flex items-center gap-2 text-text-muted">
            <Phone className="w-3.5 h-3.5 text-text-muted" />
            <span className="font-semibold text-text">{staff.phone || "No phone listed"}</span>
          </div>

          {assignedVehiclePlate ? (
            <div className="flex items-center gap-2 pt-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-lg">
                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                Vehicle: {assignedVehiclePlate}
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-text-muted italic">
              No vehicle dedicated
            </p>
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
