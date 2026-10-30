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
  EyeOff,
  Copy,
  Check,
  CreditCard,
  MapPin,
  Calendar,
  AlertCircle,
  ExternalLink,
  FileText
} from "lucide-react";
import { getUsers, createUser, updateUser, deleteUser, getVehicles, User, Vehicle } from "@/lib/api";
import { sanitizePhone, isValidPhone, isValidDrivingLicense, formatPhoneDisplay } from "@/lib/validation";
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
  
  // View Modal State
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  
  const confirm = useConfirm();

  // Form states
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("HELPER");
  const [newAddress, setNewAddress] = useState("");
  const [newIdProofUrl, setNewIdProofUrl] = useState("");
  const [newDrivingLicense, setNewDrivingLicense] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [dlTouched, setDlTouched] = useState(false);
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

  // Mobile number input sanitization (10 digits only, auto-strips leading 0 and country code)
  const handlePhoneChange = (val: string) => {
    setPhoneTouched(true);
    const cleaned = sanitizePhone(val);
    setNewPhone(cleaned);
  };

  // Driving license input handler (uppercase, alphanumeric, max 18 chars)
  const handleDlChange = (val: string) => {
    setDlTouched(true);
    setNewDrivingLicense(val.toUpperCase().slice(0, 18));
  };

  // Validation feedback
  const phoneError = useMemo(() => {
    if (!phoneTouched) return "";
    if (!newPhone.trim()) return "Mobile number is required.";
    if (newPhone.trim().length < 10) {
      return `Must be exactly 10 digits (${newPhone.trim().length}/10 entered).`;
    }
    return "";
  }, [newPhone, phoneTouched]);

  const dlError = useMemo(() => {
    if (!dlTouched || !newDrivingLicense.trim()) return "";
    if (!isValidDrivingLicense(newDrivingLicense)) {
      return "Invalid DL format (e.g. MH1420110012345 or DL-0420110012345).";
    }
    return "";
  }, [newDrivingLicense, dlTouched]);

  const handleSaveStaff = async () => {
    setPhoneTouched(true);
    setDlTouched(true);

    if (!newName.trim()) {
      toast.error("Please enter a staff name");
      return;
    }

    if (!editId && !newPassword) {
      toast.error("Please provide a password for new account");
      return;
    }

    const cleanPhone = sanitizePhone(newPhone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    if (newDrivingLicense.trim() && !isValidDrivingLicense(newDrivingLicense)) {
      toast.error("Please enter a valid Driving License number or leave it blank");
      return;
    }

    try {
      const payload: any = {
        name: newName.trim(),
        role: newRole,
        phone: cleanPhone,
        username: newUsername.trim() || null,
        address: newAddress.trim() || null,
        id_proof_url: newIdProofUrl || null,
        driving_license: newDrivingLicense.trim() ? newDrivingLicense.trim().replace(/\s+/g, '') : null,
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

      setSearchQuery("");
      setRoleFilter("all");
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
    setShowPassword(false);
    setNewPhone("");
    setNewRole("HELPER");
    setNewAddress("");
    setNewIdProofUrl("");
    setNewDrivingLicense("");
    setPhoneTouched(false);
    setDlTouched(false);
  };

  const handleEditClick = (s: User) => {
    setEditId(s.id);
    setNewName(s.name);
    setNewUsername(s.username || "");
    setNewPassword("");
    setShowPassword(false);
    setNewPhone(s.phone ? sanitizePhone(s.phone) : "");
    const normalizedRole = (() => {
      const r = (s.role || "").toUpperCase();
      if (r === "ADMIN") return "ADMIN";
      if (r.includes("GLASS")) return "GLASS_DRIVER";
      return "HELPER";
    })();
    setNewRole(normalizedRole);
    setNewAddress(s.address || "");
    setNewIdProofUrl(s.id_proof_url || "");
    setNewDrivingLicense(s.driving_license || "");
    setPhoneTouched(false);
    setDlTouched(false);
    setModalOpen(true);
  };

  const handleViewClick = (s: User) => {
    setSelectedStaff(s);
    setViewModalOpen(true);
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
        setSearchQuery("");
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

  // Filter dynamically - smart phone matching strips leading 0s and formatting
  const filteredStaff = useMemo(() => {
    const rawQuery = searchQuery.trim().toLowerCase();
    const queryDigits = searchQuery.replace(/\D/g, "").replace(/^0+/, "");

    return staff.filter(s => {
      const nameMatch = (s.name || "").toLowerCase().includes(rawQuery);
      const usernameMatch = (s.username || "").toLowerCase().includes(rawQuery);
      const dlMatch = (s.driving_license || "").toLowerCase().includes(rawQuery);
      const rawPhoneMatch = (s.phone || "").toLowerCase().includes(rawQuery);

      const staffDigits = (s.phone || "").replace(/\D/g, "").replace(/^0+/, "");
      const phoneDigitsMatch = queryDigits.length >= 3 && (
        staffDigits.includes(queryDigits) ||
        queryDigits.includes(staffDigits)
      );

      const matchesSearch = !rawQuery || nameMatch || usernameMatch || dlMatch || rawPhoneMatch || phoneDigitsMatch;
      
      const matchesRole = (() => {
        if (roleFilter === "all") return true;
        const r = (s.role || "").toUpperCase();
        if (roleFilter === "ADMIN") return r === "ADMIN";
        if (roleFilter === "HELPER") return r !== "ADMIN" && !r.includes("GLASS");
        if (roleFilter === "GLASS_DRIVER") return r.includes("GLASS");
        return true;
      })();

      return matchesSearch && matchesRole;
    });
  }, [staff, searchQuery, roleFilter]);

  const totalHeadcount = staff.length;
  const totalAdmins = staff.filter(s => s.role.toUpperCase() === "ADMIN").length;
  const totalCoworkers = staff.filter(s => {
    const r = s.role.toUpperCase();
    return r !== "ADMIN" && !r.includes("GLASS");
  }).length;
  const totalGlassCoworkers = staff.filter(s => s.role.toUpperCase().includes("GLASS")).length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 lg:p-10 pt-20 md:pt-8 pb-24 md:pb-12 transition-all max-w-7xl">
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
                className="p-2.5 bg-white border border-gray-200 hover:border-primary rounded-xl shadow-sm text-text-muted hover:text-primary transition-all active:scale-95 cursor-pointer"
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 md:mb-8">
          <StatCard 
            title="Total Team" 
            value={totalHeadcount} 
            trend="Active accounts"
            icon={<Users className="w-5 h-5 text-blue-600" />}
            badge="Team"
            color="blue"
          />
          <StatCard 
            title="Admins" 
            value={totalAdmins} 
            trend="Full system access"
            icon={<Shield className="w-5 h-5 text-amber-600" />}
            badge="Admin"
            color="amber"
          />
          <StatCard 
            title="Water Co-Workers" 
            value={totalCoworkers} 
            trend="Water delivery co-pilots"
            icon={<UserCheck className="w-5 h-5 text-cyan-600" />}
            badge="Water"
            color="cyan"
          />
          <StatCard 
            title="Glass Co-Workers" 
            value={totalGlassCoworkers} 
            trend="Glass intake & collections"
            icon={<Recycle className="w-5 h-5 text-purple-600" />}
            badge="Glass"
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
                placeholder="Search staff by name, phone, or DL..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoComplete="off"
                name="staff_search_bar"
                id="staff_search_bar"
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-gray-200 rounded-xl outline-none text-text text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <div className="flex bg-surface border border-gray-200 rounded-xl p-1 shadow-sm text-xs font-bold flex-wrap">
                <button
                  onClick={() => setRoleFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === "all" ? "bg-white shadow text-primary font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  All ({totalHeadcount})
                </button>
                <button
                  onClick={() => setRoleFilter("ADMIN")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === "ADMIN" ? "bg-white shadow text-amber-600 font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  Admin ({totalAdmins})
                </button>
                <button
                  onClick={() => setRoleFilter("HELPER")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === "HELPER" ? "bg-white shadow text-cyan-600 font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  Co-Workers ({totalCoworkers})
                </button>
                <button
                  onClick={() => setRoleFilter("GLASS_DRIVER")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === "GLASS_DRIVER" ? "bg-white shadow text-purple-600 font-black" : "text-text-muted hover:text-text"
                  }`}
                >
                  Glass Co-Workers ({totalGlassCoworkers})
                </button>
              </div>

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs font-bold text-primary hover:underline px-2 py-1 shrink-0 cursor-pointer"
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
                onView={() => handleViewClick(s)}
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
              <div className="mt-4 flex justify-center gap-2">
                {searchQuery && (
                  <Button variant="secondary" onClick={() => setSearchQuery("")} size="sm">
                    Clear Search
                  </Button>
                )}
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
          subtitle={editId ? "Modify roles, contact number, or driving credentials." : "Create credentials and roles for fleet operators."}
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
                  Full Name <span className="text-rose-500">*</span>
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
                  Role <span className="text-rose-500">*</span>
                </label>
                <select 
                  value={newRole} 
                  onChange={e => setNewRole(e.target.value)} 
                  className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium appearance-none cursor-pointer"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="HELPER">Co-Worker (Water)</option>
                  <option value="GLASS_DRIVER">Glass Co-Worker</option>
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
                  Password {editId ? "(Leave blank to keep unchanged)" : <span className="text-rose-500">*</span>}
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
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-muted hover:text-text transition-colors focus:outline-none cursor-pointer"
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

            {/* Mobile Number & Driving License (Assign Vehicle removed per instructions) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Mobile Number Field with 10-digit validation */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                    newPhone.length === 10
                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                      : newPhone.length > 0
                      ? "text-amber-700 bg-amber-50 border border-amber-200"
                      : "text-slate-400"
                  }`}>
                    {newPhone.length}/10 digits
                  </span>
                </div>
                
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center gap-1.5 text-xs font-bold text-slate-500 select-none border-r border-slate-200 pr-2.5 z-10 pointer-events-none">
                    <span>+91</span>
                  </div>
                  <input 
                    type="tel" 
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98765 43210" 
                    value={newPhone} 
                    onChange={e => handlePhoneChange(e.target.value)} 
                    onBlur={() => setPhoneTouched(true)}
                    className={`w-full bg-surface border rounded-xl pl-16 pr-10 py-3 outline-none text-text font-mono font-medium tracking-wide transition-all ${
                      phoneError
                        ? "border-rose-400 ring-4 ring-rose-400/10 focus:border-rose-500"
                        : newPhone.length === 10
                        ? "border-emerald-400 ring-4 ring-emerald-400/10 focus:border-emerald-500"
                        : "border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10"
                    }`} 
                  />
                  {newPhone.length === 10 && (
                    <div className="absolute right-3 text-emerald-500" title="Valid 10-digit number">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Professional UI Error / Info Message */}
                {phoneError ? (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1.5 flex items-center gap-1 animate-in fade-in duration-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {phoneError}
                  </p>
                ) : newPhone.length === 10 ? (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    Valid 10-digit mobile number
                  </p>
                ) : (
                  <p className="text-[11px] text-text-muted mt-1.5">
                    Enter 10-digit mobile number (digits only)
                  </p>
                )}
              </div>

              {/* Driving License Field (Optional) with Validation */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Driving License (DL)
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 rounded">
                    Optional
                  </span>
                </div>

                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    placeholder="e.g. MH1420110012345" 
                    value={newDrivingLicense} 
                    onChange={e => handleDlChange(e.target.value)} 
                    onBlur={() => setDlTouched(true)}
                    maxLength={18}
                    className={`w-full bg-surface border rounded-xl px-4 py-3 outline-none text-text font-mono font-medium uppercase tracking-wider transition-all ${
                      dlError
                        ? "border-rose-400 ring-4 ring-rose-400/10 focus:border-rose-500"
                        : newDrivingLicense && !dlError
                        ? "border-blue-400 ring-4 ring-blue-400/10 focus:border-blue-500"
                        : "border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10"
                    }`} 
                  />
                  {newDrivingLicense && !dlError && (
                    <div className="absolute right-3 text-blue-500" title="Valid Driving License">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Professional UI Error / Info Message */}
                {dlError ? (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1.5 flex items-center gap-1 animate-in fade-in duration-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {dlError}
                  </p>
                ) : newDrivingLicense && !dlError ? (
                  <p className="text-[11px] text-blue-600 font-semibold mt-1.5 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    Valid Driving License format
                  </p>
                ) : (
                  <p className="text-[11px] text-text-muted mt-1.5">
                    State code + RTO + number (e.g. MH1420110012345)
                  </p>
                )}
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

        {/* View Staff Details Modal */}
        <Modal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title="Staff Personnel Profile"
          subtitle={selectedStaff ? `Comprehensive profile & credentials for ${selectedStaff.name}.` : "Staff overview"}
          width="2xl"
          actions={
            <div className="flex gap-3 w-full">
              <Button 
                variant="secondary" 
                onClick={() => setViewModalOpen(false)} 
                className="flex-1 font-bold"
              >
                Close
              </Button>
              <Button 
                variant="primary" 
                onClick={() => {
                  if (selectedStaff) {
                    setViewModalOpen(false);
                    handleEditClick(selectedStaff);
                  }
                }} 
                icon={<Edit2 className="w-4 h-4" />}
                className="flex-1 font-bold"
              >
                Edit Profile
              </Button>
            </div>
          }
        >
          {selectedStaff && (() => {
            const assignedVeh = vehicles.find(v => v.id === selectedStaff.assigned_vehicle_id);
            const roleInfo = (() => {
              const r = (selectedStaff.role || "").toUpperCase();
              if (r === "ADMIN") {
                return { label: "Admin (Owner / Full Access)", badge: "bg-amber-50 text-amber-700 border-amber-200" };
              }
              if (r === "DRIVER") {
                return { label: "Driver (Water Delivery)", badge: "bg-blue-50 text-blue-700 border-blue-200" };
              }
              if (r === "HELPER" || r === "CO_WORKER" || r === "WATER_COWORKER" || r === "WATER_STAFF") {
                return { label: "Co-Worker (Water Logistics)", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" };
              }
              if (r.includes("GLASS")) {
                return { label: "Glass Co-Worker (Collections & Intake)", badge: "bg-purple-50 text-purple-700 border-purple-200" };
              }
              return { label: selectedStaff.role, badge: "bg-gray-50 text-gray-700 border-gray-200" };
            })();

            const initials = selectedStaff.name
              .split(" ")
              .map(p => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <div className="space-y-5 py-1">
                {/* Hero Header Card */}
                <div className="p-5 bg-gradient-to-br from-slate-50 via-sky-50/40 to-blue-50/30 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 text-white font-black text-xl flex items-center justify-center shadow-md shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        {selectedStaff.name}
                      </h2>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active Account
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">
                      @{selectedStaff.username || "no-login-handle"}
                    </p>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg border ${roleInfo.badge}`}>
                        {roleInfo.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grid of Key Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Mobile Number Card */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-sky-300 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-sky-600" />
                        Mobile Number
                      </span>
                      {selectedStaff.phone && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          10-Digit Verified
                        </span>
                      )}
                    </div>
                    {selectedStaff.phone ? (
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="font-mono font-bold text-base text-slate-800">
                          {formatPhoneDisplay(selectedStaff.phone)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedStaff.phone || "");
                              toast.success("Phone number copied!");
                            }}
                            title="Copy number"
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <a
                            href={`tel:+91${selectedStaff.phone}`}
                            title="Call staff"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No mobile number listed</p>
                    )}
                  </div>

                  {/* Driving License Card */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-sky-300 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                        Driving License
                      </span>
                      {selectedStaff.driving_license ? (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          Recorded
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                          Optional / None
                        </span>
                      )}
                    </div>
                    {selectedStaff.driving_license ? (
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="font-mono font-extrabold text-base tracking-wider text-slate-800">
                          {selectedStaff.driving_license}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedStaff.driving_license || "");
                            toast.success("DL number copied!");
                          }}
                          title="Copy DL"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Not provided</p>
                    )}
                  </div>

                  {/* Residential Address Card */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs sm:col-span-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      Residential Address
                    </span>
                    <p className="text-sm font-medium text-slate-700">
                      {selectedStaff.address || (
                        <span className="text-slate-400 italic">No residential address recorded on file</span>
                      )}
                    </p>
                  </div>

                  {/* Assigned Vehicle (If present in database) */}
                  {assignedVeh && (
                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 shadow-xs sm:col-span-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 block">
                            Assigned Delivery Vehicle
                          </span>
                          <span className="font-mono font-bold text-sm text-slate-800">
                            {assignedVeh.plate_number} ({assignedVeh.model || "Truck"})
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-white px-3 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                        Fleet Vehicle
                      </span>
                    </div>
                  )}

                  {/* ID Proof Document if uploaded */}
                  {selectedStaff.id_proof_url && (
                    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs sm:col-span-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            Identity Document
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Uploaded credential attachment
                          </span>
                        </div>
                      </div>
                      <a
                        href={selectedStaff.id_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline px-3 py-1.5 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors"
                      >
                        <span>View Document</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  {/* System Meta */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60 sm:col-span-2 flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Registered: {selectedStaff.created_at ? new Date(selectedStaff.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Active"}
                    </span>
                    <span className="text-slate-400">
                      ID: <span className="font-mono text-slate-600">{selectedStaff.id}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      </main>
    </div>
  );
}

function StaffCard({ 
  staff, 
  assignedVehiclePlate, 
  onView,
  onEdit, 
  onDelete 
}: { 
  staff: User; 
  assignedVehiclePlate?: string; 
  onView: () => void;
  onEdit: () => void; 
  onDelete: () => void; 
}) {
  const roleConfig = (() => {
    const r = (staff.role || "").toUpperCase();
    if (r === "ADMIN") {
      return { label: "Admin", bg: "bg-amber-50 text-amber-700 border-amber-200", icon: Shield };
    }
    if (r === "DRIVER") {
      return { label: "Driver", bg: "bg-blue-50 text-blue-700 border-blue-200", icon: Truck };
    }
    if (r === "HELPER" || r === "CO_WORKER" || r === "WATER_COWORKER" || r === "WATER_STAFF") {
      return { label: "Co-Worker", bg: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: UserCheck };
    }
    if (r.includes("GLASS")) {
      return { label: "Glass Co-Worker", bg: "bg-purple-50 text-purple-700 border-purple-200", icon: Recycle };
    }
    return { label: staff.role, bg: "bg-gray-50 text-gray-700 border-gray-200", icon: UserIcon };
  })();

  const RoleIconComponent = roleConfig.icon;

  const initials = staff.name
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="glass-panel p-5 rounded-3xl hover:shadow-md transition-all border border-black/5 flex flex-col justify-between group relative overflow-hidden bg-white">
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
          <div className="flex items-center justify-between text-text-muted">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-sky-600" />
              <span className="font-semibold text-text font-mono">
                {formatPhoneDisplay(staff.phone)}
              </span>
            </div>
            {staff.phone && staff.phone.replace(/\D/g, "").length === 10 && (
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                10-digit
              </span>
            )}
          </div>

          {staff.driving_license && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg font-mono">
                <CreditCard className="w-3 h-3 text-blue-600" />
                DL: {staff.driving_license}
              </span>
            </div>
          )}

          {assignedVehiclePlate ? (
            <div className="flex items-center gap-2 pt-0.5">
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

      {/* Action Buttons: View, Edit, Delete */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/5 mt-2">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={onView} 
          icon={<Eye className="w-3.5 h-3.5 text-sky-600" />}
          className="hover:border-sky-300 hover:bg-sky-50/60 hover:text-sky-700 font-bold text-xs"
        >
          View
        </Button>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={onEdit} 
          icon={<Edit2 className="w-3.5 h-3.5 text-blue-600" />}
          className="hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700 font-bold text-xs"
        >
          Edit
        </Button>
        <Button 
          variant="danger" 
          size="sm" 
          onClick={onDelete} 
          icon={<Trash2 className="w-3.5 h-3.5" />}
          className="font-bold text-xs"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
