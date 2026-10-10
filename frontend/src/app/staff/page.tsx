"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Users, Search, Filter, Phone, Plus, UserCheck, ShieldAlert, Truck, UserPlus, User as UserIcon } from "lucide-react";
import { getUsers, createUser, updateUser, deleteUser, getVehicles, User, Vehicle } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function StaffPage() {
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const confirm = useConfirm();

  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("DRIVER"); // "ADMIN", "DRIVER", "HELPER"
  const [newAddress, setNewAddress] = useState("");
  const [newIdProofUrl, setNewIdProofUrl] = useState("");
  const [newAssignedVehicle, setNewAssignedVehicle] = useState("");
  const [uploading, setUploading] = useState(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    fetchStaff();
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const data = await getVehicles();
      setVehicles(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setStaff(data);
    } catch (error) {
      console.error("Failed to fetch staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStaff = async () => {
    if (newName && newRole && (editId || newPassword)) {
      try {
        const payload: any = {
          name: newName,
          role: newRole,
          phone: newPhone || null,
          username: newUsername || null,
          address: newAddress || null,
          id_proof_url: newIdProofUrl || null,
          assigned_vehicle_id: newRole === "GLASS_DRIVER" ? (newAssignedVehicle || null) : null,
        };
        
        if (editId) {
          await updateUser(editId, payload);
        } else {
          payload.password = newPassword;
          await createUser(payload);
        }
        
        await fetchStaff();
        setModalOpen(false);
        setEditId(null);
        setNewName("");
        setNewUsername("");
        setNewPassword("");
        setNewPhone("");
        setNewRole("DRIVER");
        setNewAddress("");
        setNewIdProofUrl("");
        setNewAssignedVehicle("");
        toast.success(editId ? "Staff member updated successfully!" : "Staff member created successfully!");
      } catch (error: any) {
        console.error("Failed to save staff:", error);
        toast.error(error.message || "Failed to save staff member.");
      }
    } else {
      toast.error("Please fill required fields (Name, Role, Password for new staff)");
    }
  };

  const handleDeleteStaff = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Delete Staff",
      message: "Are you sure you want to delete this staff member? This will remove their access.",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    
    if (isConfirmed) {
      try {
        await deleteUser(id);
        await fetchStaff();
        toast.success("Staff member deleted successfully.");
      } catch (error: any) {
        console.error("Failed to delete staff:", error);
        toast.error(error.message || "Failed to delete staff member.");
      }
    }
  };

  const handleEditClick = (s: User) => {
    setEditId(s.id);
    setNewName(s.name);
    setNewUsername(s.username || "");
    setNewPhone(s.phone || "");
    setNewRole(s.role);
    setNewAddress(s.address || "");
    setNewIdProofUrl(s.id_proof_url || "");
    setNewAssignedVehicle(s.assigned_vehicle_id || "");
    setModalOpen(true);
  };

  const handleAddClick = () => {
    setEditId(null);
    setNewName("");
    setNewUsername("");
    setNewPassword("");
    setNewPhone("");
    setNewRole("DRIVER");
    setNewAddress("");
    setNewIdProofUrl("");
    setNewAssignedVehicle("");
    setModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/users/upload-id", {
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

  const totalDrivers = staff.filter(s => s.role === "DRIVER").length;
  const totalHelpers = staff.filter(s => s.role === "HELPER").length;
  const onLeave = 0; // Placeholder until attendance is implemented

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8 transition-all relative">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text mb-1">Staff Management</h1>
            <p className="text-text-muted">Manage your drivers, helpers, and warehouse team.</p>
          </div>
          <Button onClick={handleAddClick} icon={<Plus className="w-5 h-5" />}>
            Add Staff
          </Button>
        </header>

        {/* Global Staff Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
              <Users className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h3 className="text-text-muted font-medium">Total Drivers</h3>
              <p className="text-3xl font-bold text-text">{totalDrivers}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
              <UserCheck className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-text-muted font-medium">Total Helpers</h3>
              <p className="text-3xl font-bold text-text">{totalHelpers}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h3 className="text-text-muted font-medium">On Leave Today</h3>
              <p className="text-3xl font-bold text-text">{onLeave}</p>
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
                  placeholder="Search staff..." 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-text font-medium"
                />
              </div>
              <Button variant="outline" className="px-3" icon={<Filter className="w-5 h-5" />} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {staff.map(s => (
              <StaffCard key={s.id} {...s} onEdit={() => handleEditClick(s)} onDelete={() => handleDeleteStaff(s.id)} />
            ))}
            {staff.length === 0 && (
              <div className="col-span-full py-12 text-center text-text-muted bg-white border border-gray-100 rounded-2xl shadow-sm">
                No staff members found.
              </div>
            )}
          </div>
        </div>

        {/* Add Staff Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editId ? "Edit Staff Member" : "Add Staff Member"}
          width="2xl"
          actions={
            <div className="flex gap-4 w-full">
              <Button variant="secondary" onClick={() => setModalOpen(false)} fullWidth>Cancel</Button>
              <Button variant="primary" onClick={handleSaveStaff} fullWidth>
                {editId ? "Update Staff" : "Save Staff"}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name *</label>
              <input type="text" placeholder="e.g. Ramesh Kumar" value={newName} onChange={e => setNewName(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Username</label>
                <input type="text" placeholder="e.g. ramesh.kumar" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
              </div>
              {!editId && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Password *</label>
                  <input type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Phone Number</label>
                <input type="text" placeholder="+91 XXXXX XXXXX" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Role *</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                  <option value="DRIVER">Water Driver</option>
                  <option value="HELPER">Water Helper</option>
                  <option value="WATER_STAFF">Water Supply Admin</option>
                  <option value="GLASS_DRIVER">Glass Driver</option>
                  <option value="GLASS_STAFF">Glass Admin</option>
                  <option value="ADMIN">Master Admin</option>
                </select>
              </div>
            </div>
            
            {newRole === "GLASS_DRIVER" && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Assigned Vehicle *</label>
                <select value={newAssignedVehicle} onChange={e => setNewAssignedVehicle(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                  <option value="">-- Select Vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">This vehicle will be permanently linked to this Glass Driver for all collections.</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Address</label>
              <textarea rows={2} placeholder="Full address" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none"></textarea>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">ID Proof (Aadhar / PAN)</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-2.5 px-5 rounded-xl border border-gray-200 transition-colors shadow-sm flex-shrink-0">
                  {uploading ? "Uploading..." : "Upload Document"}
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
                {newIdProofUrl && (
                  <a href={`http://127.0.0.1:8000${newIdProofUrl}`} target="_blank" rel="noreferrer" className="text-primary hover:text-blue-700 text-sm font-bold bg-primary/5 px-4 py-2.5 rounded-xl border border-primary/10 transition-colors">
                    View Uploaded Document
                  </a>
                )}
              </div>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}

function StaffCard({ name, phone, role, status = "Available", assignment = "-", onEdit, onDelete }: any) {
  const getStatusStyle = (s: string) => {
    if (s === "On Route") return "bg-blue-50 text-blue-700 border-blue-100 flex items-center gap-1.5";
    if (s === "Available" || s === "On Duty") return "bg-emerald-50 text-emerald-700 border-emerald-100 flex items-center gap-1.5";
    return "bg-slate-100 text-slate-600 border-slate-200 flex items-center gap-1.5";
  };

  const getStatusIndicator = (s: string) => {
    if (s === "On Route") return <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />;
    if (s === "Available" || s === "On Duty") return <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />;
    return <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />;
  };

  const getRoleIcon = (r: string) => {
    if (r.includes("DRIVER")) return <Truck className="w-5 h-5 text-indigo-500" />;
    if (r.includes("HELPER")) return <UserPlus className="w-5 h-5 text-indigo-500" />;
    if (r.includes("STAFF")) return <UserCheck className="w-5 h-5 text-indigo-500" />;
    return <UserIcon className="w-5 h-5 text-indigo-500" />;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col h-full relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center shrink-0">
            {getRoleIcon(role)}
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-800 tracking-tight leading-tight mb-1">{name}</h3>
            <div className="flex items-center text-slate-500 text-sm font-medium gap-1.5">
              <Phone className="w-3 h-3 text-slate-400" />
              {phone || "No phone"}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 flex-1 mb-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 rounded-xl p-2 border border-slate-100/50">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Role</span>
            <span className="text-sm font-bold text-slate-700">{role.replace(/_/g, ' ')}</span>
          </div>
          <div className="bg-slate-50 rounded-xl p-2 border border-slate-100/50 flex flex-col justify-center">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Status</span>
            <span className={`px-2 py-0.5 rounded-lg border text-xs font-bold w-fit ${getStatusStyle(status)}`}>
              {getStatusIndicator(status)} {status}
            </span>
          </div>
        </div>
        
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100/50">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Current Assignment</span>
          <span className="text-sm font-medium text-slate-600 line-clamp-1">{assignment}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-slate-100 mt-auto">
        <Button variant="secondary" size="sm" onClick={onEdit} className="flex-1">Edit</Button>
        <Button variant="danger" size="sm" onClick={onDelete} className="flex-1">Delete</Button>
      </div>
    </div>
  );
}
