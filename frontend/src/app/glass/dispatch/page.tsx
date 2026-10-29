"use client";

import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  Truck,
  MapPin,
  Calendar,
  UserPlus,
  X,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Navigation,
  Zap,
  Trash2,
  Search,
  Filter,
  Recycle,
  IndianRupee,
  Clock,
  Sparkles,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  Edit2,
  Check,
  Building2,
  Map,
  Plus,
  Fuel,
  Users
} from "lucide-react";
import {
  getGlassAssignments,
  createGlassAssignment,
  updateGlassAssignment,
  completeGlassAssignment,
  reopenGlassAssignment,
  deleteGlassAssignment,
  GlassAssignment,
  getGlassRoutes,
  createGlassRoute,
  updateGlassRoute,
  deleteGlassRoute,
  assignPropertiesToGlassRoute,
  GlassRoute,
  getGlassProperties,
  GlassProperty,
  getVehicles,
  Vehicle,
  getUsers,
  User,
  createTripExpense
} from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function GlassDispatchPage() {
  const [activeTab, setActiveTab] = useState<"dispatch" | "routes">("dispatch");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Master data
  const [assignments, setAssignments] = useState<GlassAssignment[]>([]);
  const [routes, setRoutes] = useState<GlassRoute[]>([]);
  const [properties, setProperties] = useState<GlassProperty[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Dispatch Filters
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "ACTIVE" | "COMPLETED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Assign Run Modal States
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignDate, setAssignDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [assignDriver, setAssignDriver] = useState("");
  const [assignVehicle, setAssignVehicle] = useState("");
  const [assignRoute, setAssignRoute] = useState("");
  const [assignHelper, setAssignHelper] = useState("");
  const [assignTargetCapacity, setAssignTargetCapacity] = useState("4.0");
  const [assignStatus, setAssignStatus] = useState<"PENDING" | "ACTIVE">("ACTIVE");
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Route Management Modal States
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [editRouteId, setEditRouteId] = useState<string | null>(null);
  const [routeName, setRouteName] = useState("");
  const [routeArea, setRouteArea] = useState("");
  const [savingRoute, setSavingRoute] = useState(false);

  // Assign Properties to Route Modal
  const [assignPropsModalOpen, setAssignPropsModalOpen] = useState(false);
  const [activeRouteForProps, setActiveRouteForProps] = useState<GlassRoute | null>(null);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const [propSearchQuery, setPropSearchQuery] = useState("");
  const [savingPropsAssignment, setSavingPropsAssignment] = useState(false);

  // Trip Expense Modal
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseAssignmentId, setExpenseAssignmentId] = useState<string | null>(null);
  const [expenseCategory, setExpenseCategory] = useState<"FUEL" | "TOLL" | "MAINTENANCE" | "OTHER">("FUEL");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);

  const confirm = useConfirm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [aData, rData, pData, vData, uData] = await Promise.all([
        getGlassAssignments(),
        getGlassRoutes(),
        getGlassProperties(),
        getVehicles().catch(() => []),
        getUsers().catch(() => [])
      ]);
      setAssignments(aData || []);
      setRoutes(rData || []);
      setProperties(pData || []);
      setVehicles(vData || []);
      setUsers(uData || []);
    } catch (err) {
      console.error("Failed to load dispatch data:", err);
      toast.error("Failed to load dispatch data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignDriver || !assignVehicle || !assignRoute) {
      toast.error("Please select driver, vehicle, and collection route");
      return;
    }

    setSavingAssignment(true);
    try {
      await createGlassAssignment({
        date: new Date(assignDate).toISOString(),
        driver_id: assignDriver,
        vehicle_id: assignVehicle,
        route_id: assignRoute,
        helper_id: assignHelper || null,
        target_capacity_tons: parseFloat(assignTargetCapacity) || 0,
        status: assignStatus
      });

      toast.success("Glass collection run dispatched!");
      setAssignModalOpen(false);
      setAssignDriver("");
      setAssignVehicle("");
      setAssignRoute("");
      setAssignHelper("");
      await fetchData();
    } catch (err: any) {
      toast.error("Failed to assign run: " + (err.message || "Unknown error"));
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleCompleteRun = async (assignment: GlassAssignment) => {
    const isOk = await confirm({
      title: "End Run & Drop at Godown?",
      message: `Are you sure you want to complete this shift? All ${assignment.collected_tons || assignment.collectedTons || 0} Tons collected on this run will be credited automatically to Godown Unseparated Stock.`,
      confirmText: "Drop at Godown & Complete",
      cancelText: "Cancel"
    });

    if (isOk) {
      try {
        const res = await completeGlassAssignment(assignment.id);
        toast.success(res.message || "Shift completed & tons dropped at godown!");
        await fetchData();
      } catch (err: any) {
        toast.error("Failed to complete shift: " + (err.message || "Unknown error"));
      }
    }
  };

  const handleReopenRun = async (id: string) => {
    const isOk = await confirm({
      title: "Reopen Glass Shift?",
      message: "This will restore the shift to Active and revert the stock addition from Godown inventory.",
      confirmText: "Reopen Run",
      cancelText: "Cancel"
    });

    if (isOk) {
      try {
        await reopenGlassAssignment(id);
        toast.success("Shift reopened to Active status!");
        await fetchData();
      } catch (err: any) {
        toast.error("Failed to reopen shift: " + (err.message || "Unknown error"));
      }
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    const isOk = await confirm({
      title: "Delete Shift Assignment?",
      message: "Are you sure you want to delete this collection shift?",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    if (isOk) {
      try {
        await deleteGlassAssignment(id);
        toast.success("Shift deleted");
        await fetchData();
      } catch (err: any) {
        toast.error("Failed to delete: " + (err.message || "Unknown error"));
      }
    }
  };

  // Trip Expenses Handlers
  const handleOpenExpenseModal = (assignmentId: string) => {
    setExpenseAssignmentId(assignmentId);
    setExpenseCategory("FUEL");
    setExpenseAmount("");
    setExpenseDesc("");
    setExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAssignmentId) return;
    const amt = parseFloat(expenseAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid expense amount");
      return;
    }

    setSavingExpense(true);
    try {
      await createTripExpense({
        assignment_id: expenseAssignmentId,
        category: expenseCategory,
        amount: amt,
        description: expenseDesc.trim() || undefined
      });
      toast.success(`Expense of ₹${amt} logged for this collection run!`);
      setExpenseModalOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error("Failed to log expense: " + (err.message || "Unknown error"));
    } finally {
      setSavingExpense(false);
    }
  };

  // Route Management Handlers
  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeName.trim()) {
      toast.error("Please enter a route name");
      return;
    }

    setSavingRoute(true);
    try {
      if (editRouteId) {
        await updateGlassRoute(editRouteId, { name: routeName.trim(), area: routeArea.trim() || undefined });
        toast.success("Route updated!");
      } else {
        await createGlassRoute({ name: routeName.trim(), area: routeArea.trim() || undefined });
        toast.success("Glass collection route created!");
      }
      setRouteModalOpen(false);
      setRouteName("");
      setRouteArea("");
      setEditRouteId(null);
      await fetchData();
    } catch (err: any) {
      toast.error("Failed to save route: " + (err.message || "Unknown error"));
    } finally {
      setSavingRoute(false);
    }
  };

  const handleDeleteRoute = async (id: string, name: string) => {
    const isOk = await confirm({
      title: `Delete Route "${name}"?`,
      message: "Properties mapped to this route will become unassigned. Active runs are preserved.",
      confirmText: "Delete Route",
      cancelText: "Cancel"
    });
    if (isOk) {
      try {
        await deleteGlassRoute(id);
        toast.success("Route deleted");
        await fetchData();
      } catch (err: any) {
        toast.error("Failed to delete route: " + (err.message || "Unknown error"));
      }
    }
  };

  const handleOpenAssignPropsModal = (route: GlassRoute) => {
    setActiveRouteForProps(route);
    const assignedIds = new Set<string>();
    properties.forEach(p => {
      if ((p.route_id || p.routeId) === route.id) {
        assignedIds.add(p.id);
      }
    });
    setSelectedPropertyIds(assignedIds);
    setPropSearchQuery("");
    setAssignPropsModalOpen(true);
  };

  const handleSavePropsAssignment = async () => {
    if (!activeRouteForProps) return;
    setSavingPropsAssignment(true);
    try {
      await assignPropertiesToGlassRoute(activeRouteForProps.id, Array.from(selectedPropertyIds));
      toast.success("Properties mapped to route successfully!");
      setAssignPropsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error("Failed to assign properties: " + (err.message || "Unknown error"));
    } finally {
      setSavingPropsAssignment(false);
    }
  };

  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const routeName = (a.route_name || a.routeName || "").toLowerCase();
        const driverName = (a.driver_name || a.driverName || "").toLowerCase();
        const vehiclePlate = (a.vehicle_plate || a.vehiclePlate || "").toLowerCase();
        if (!routeName.includes(q) && !driverName.includes(q) && !vehiclePlate.includes(q)) return false;
      }
      return true;
    });
  }, [assignments, statusFilter, searchQuery]);

  const activeRunsCount = useMemo(() => {
    return assignments.filter(a => a.status === "ACTIVE").length;
  }, [assignments]);

  const todayTonsCollected = useMemo(() => {
    return assignments
      .filter(a => a.status === "COMPLETED" || a.status === "ACTIVE")
      .reduce((sum, a) => sum + (a.collected_tons || a.collectedTons || 0), 0);
  }, [assignments]);

  return (
    <div className="flex min-h-screen bg-[#FDFBF7]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 lg:p-10 pt-20 md:pt-8 pb-24 md:pb-12 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Truck className="w-7 h-7 text-emerald-600" /> Glass Route Dispatch & Fleet
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
                Logistics
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Assign drivers and trucks to collection routes, track real-time intake progress, and reconcile shifts.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={fetchData}
              title="Refresh live dispatch"
              className="p-2.5 bg-white border border-slate-200 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 rounded-xl shadow-xs transition-all active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            </button>
            {activeTab === "dispatch" ? (
              <Button
                variant="primary"
                onClick={() => setAssignModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4" /> Dispatch Collection Run
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => {
                  setEditRouteId(null);
                  setRouteName("");
                  setRouteArea("");
                  setRouteModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4" /> New Glass Route
              </Button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-200/60 p-1 rounded-2xl w-fit mb-6 border border-slate-300/40">
          <button
            onClick={() => setActiveTab("dispatch")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 ${
              activeTab === "dispatch"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>Daily Collection Runs</span>
            {activeRunsCount > 0 && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                {activeRunsCount} Active
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("routes")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 ${
              activeTab === "routes"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Map className="w-4 h-4 text-emerald-600" />
            <span>Manage Routes ({routes.length})</span>
          </button>
        </div>

        {/* TAB 1: FLEET DISPATCH */}
        {activeTab === "dispatch" && (
          <div>
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Shifts</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{assignments.length}</p>
                <p className="text-[11px] font-semibold text-slate-500 mt-1">Logged collection runs</p>
              </div>
              <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">On The Road</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{activeRunsCount}</p>
                <p className="text-[11px] font-semibold text-emerald-700 mt-1">Active collection trucks</p>
              </div>
              <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Tons Collected</p>
                <p className="text-2xl font-black text-sky-700 mt-1">{todayTonsCollected.toFixed(1)} T</p>
                <p className="text-[11px] font-semibold text-slate-500 mt-1">From completed & active runs</p>
              </div>
              <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Pending Shifts</p>
                <p className="text-2xl font-black text-amber-600 mt-1">
                  {assignments.filter(a => a.status === "PENDING").length}
                </p>
                <p className="text-[11px] font-semibold text-amber-700 mt-1">Awaiting driver departure</p>
              </div>
            </div>

            {/* Filters Toolbar */}
            <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs mb-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by route name, driver, vehicle plate..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {(["ALL", "ACTIVE", "PENDING", "COMPLETED"] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                      statusFilter === st
                        ? "bg-white text-slate-800 shadow-xs"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignment Cards List */}
            {loading ? (
              <div className="py-20 text-center text-slate-400 font-bold text-sm flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                Loading dispatch runs...
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-black text-slate-700 mb-1">No Collection Runs Found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
                  {statusFilter !== "ALL" || searchQuery
                    ? "No shifts match your search or filter."
                    : "No collection runs assigned yet. Dispatch a vehicle and driver to start collecting."}
                </p>
                <Button
                  variant="primary"
                  onClick={() => setAssignModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Dispatch First Collection Run
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredAssignments.map(a => {
                  const targetTons = a.target_capacity_tons || a.targetCapacityTons || 0;
                  const collectedTons = a.collected_tons || a.collectedTons || 0;
                  const totalStops = a.stops_total || a.stopsTotal || 0;
                  const completedStops = a.stops_completed || a.stopsCompleted || 0;
                  const tonsPercent = targetTons > 0 ? Math.min(100, Math.round((collectedTons / targetTons) * 100)) : 0;
                  const stopsPercent = totalStops > 0 ? Math.min(100, Math.round((completedStops / totalStops) * 100)) : 0;
                  const totalPaid = (a.total_paid || a.totalPaid || 0).toLocaleString();
                  const totalExpense = (a.total_expense || a.totalExpense || 0).toLocaleString();

                  return (
                    <div
                      key={a.id}
                      className="glass-panel p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Header Badge */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              a.status === "ACTIVE"
                                ? "bg-emerald-500 animate-pulse"
                                : a.status === "PENDING"
                                ? "bg-amber-400"
                                : "bg-slate-400"
                            }`} />
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              a.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : a.status === "PENDING"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-slate-100 text-slate-700"
                            }`}>
                              {a.status === "ACTIVE" ? "In Transit" : a.status}
                            </span>
                          </div>

                          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {a.date ? a.date.slice(0, 10) : "Today"}
                          </span>
                        </div>

                        {/* Route Name & Area */}
                        <h3 className="text-lg font-black text-slate-800 mb-1 flex items-center gap-2">
                          <Map className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{a.route_name || a.routeName || "Unassigned Route"}</span>
                        </h3>
                        {a.route_area && (
                          <p className="text-xs font-medium text-slate-500 mb-4 pl-6">
                            Zone: {a.route_area}
                          </p>
                        )}

                        {/* Driver & Truck Specs Grid */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100 mb-4 text-xs">
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Vehicle</span>
                            <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                              <Truck className="w-3.5 h-3.5 text-slate-500" />
                              {a.vehicle_plate || a.vehiclePlate || "Truck"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Lead Driver</span>
                            <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                              <Users className="w-3.5 h-3.5 text-slate-500" />
                              {a.driver_name || a.driverName || "Driver"}
                            </span>
                          </div>
                          {a.helper_name || a.helperName ? (
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase font-bold block">Route Helper</span>
                              <span className="font-bold text-slate-800 mt-0.5 block">
                                {a.helper_name || a.helperName}
                              </span>
                            </div>
                          ) : null}
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Fuel & Trip Exp</span>
                            <span className="font-bold text-rose-600 mt-0.5 block">
                              ₹{totalExpense}
                            </span>
                          </div>
                        </div>

                        {/* Live Load Meter (Tons) */}
                        <div className="space-y-1.5 mb-3">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Recycle className="w-3.5 h-3.5 text-emerald-600" /> Cullet Load:
                            </span>
                            <span className="text-emerald-700">
                              {collectedTons.toFixed(1)} / {targetTons > 0 ? `${targetTons.toFixed(1)} T` : "Target T"}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full transition-all rounded-full"
                              style={{ width: `${tonsPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Stops Progress */}
                        <div className="space-y-1.5 mb-4">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-sky-600" /> Stops Completed:
                            </span>
                            <span className="text-sky-700">
                              {completedStops} / {totalStops} Properties
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-sky-500 h-full transition-all rounded-full"
                              style={{ width: `${stopsPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {a.status === "ACTIVE" && (
                            <button
                              onClick={() => handleCompleteRun(a)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                              title="Drop collected load at godown and mark completed"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>End Run & Drop at Godown</span>
                            </button>
                          )}
                          {a.status === "PENDING" && (
                            <button
                              onClick={async () => {
                                await updateGlassAssignment(a.id, { status: "ACTIVE" });
                                toast.success("Truck dispatched to route!");
                                await fetchData();
                              }}
                              className="bg-sky-600 hover:bg-sky-700 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1"
                            >
                              <Zap className="w-3.5 h-3.5" /> Start Run
                            </button>
                          )}
                          {a.status === "COMPLETED" && (
                            <button
                              onClick={() => handleReopenRun(a.id)}
                              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Reopen
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenExpenseModal(a.id)}
                            className="bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-xs px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1"
                            title="Log fuel or trip expense"
                          >
                            <Fuel className="w-3.5 h-3.5 text-rose-500" /> Expense
                          </button>
                        </div>

                        <button
                          onClick={() => handleDeleteAssignment(a.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Shift"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANAGE ROUTES */}
        {activeTab === "routes" && (
          <div>
            {routes.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <Map className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-black text-slate-700 mb-1">No Glass Routes Defined</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
                  Create your first collection route (e.g. "North Goa Beach Hotels Belt") to organize properties for daily driver intake runs.
                </p>
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditRouteId(null);
                    setRouteName("");
                    setRouteArea("");
                    setRouteModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Create First Glass Route
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {routes.map(r => {
                  const propCount = r.properties_count || r.propertiesCount || 0;
                  return (
                    <div
                      key={r.id}
                      className="glass-panel p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Glass Intake Route
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            {r.area || "Zone"}
                          </span>
                        </div>

                        <h3 className="text-base font-black text-slate-800 mb-1 flex items-center gap-2">
                          <Map className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{r.name}</span>
                        </h3>

                        <p className="text-xs font-medium text-slate-500 mb-4 pl-6">
                          {propCount} {propCount === 1 ? "Property" : "Properties"} assigned to this run.
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <button
                          onClick={() => handleOpenAssignPropsModal(r)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
                        >
                          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Assign Properties</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditRouteId(r.id);
                              setRouteName(r.name);
                              setRouteArea(r.area || "");
                              setRouteModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit Route"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRoute(r.id, r.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Route"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODAL: Assign Collection Run */}
        <Modal
          isOpen={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          title="Dispatch Glass Collection Run"
        >
          <form onSubmit={handleCreateAssignment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Shift Date *
                </label>
                <input
                  type="date"
                  required
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Initial Status
                </label>
                <select
                  value={assignStatus}
                  onChange={(e) => setAssignStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  <option value="ACTIVE">ACTIVE (Dispatched Now)</option>
                  <option value="PENDING">PENDING (Scheduled)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Lead Driver *
                </label>
                <select
                  required
                  value={assignDriver}
                  onChange={(e) => setAssignDriver(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  <option value="">-- Select Driver --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Collection Vehicle *
                </label>
                <select
                  required
                  value={assignVehicle}
                  onChange={(e) => setAssignVehicle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  <option value="">-- Select Vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.plate_number} {v.model ? `(${v.model})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Collection Route *
                </label>
                <select
                  required
                  value={assignRoute}
                  onChange={(e) => setAssignRoute(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  <option value="">-- Select Route --</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.area || "Zone"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Route Helper (Optional)
                </label>
                <select
                  value={assignHelper}
                  onChange={(e) => setAssignHelper(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  <option value="">-- No Helper Assigned --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Target Truck Capacity (Tons)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 4.5"
                value={assignTargetCapacity}
                onChange={(e) => setAssignTargetCapacity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignModalOpen(false)}
                className="text-xs font-bold px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={savingAssignment}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl shadow-xs"
              >
                {savingAssignment ? "Dispatching..." : "Confirm & Dispatch"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: Create / Edit Route */}
        <Modal
          isOpen={routeModalOpen}
          onClose={() => setRouteModalOpen(false)}
          title={editRouteId ? "Edit Glass Route" : "Create New Glass Route"}
        >
          <form onSubmit={handleSaveRoute} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Route Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. North Goa Beach Belt, Panaji Bars & Clubs"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Zone / Area Description
              </label>
              <input
                type="text"
                placeholder="e.g. Calangute, Baga, Candolim coastal area"
                value={routeArea}
                onChange={(e) => setRouteArea(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRouteModalOpen(false)}
                className="text-xs font-bold px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={savingRoute}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl shadow-xs"
              >
                {savingRoute ? "Saving..." : editRouteId ? "Update Route" : "Create Route"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: Assign Properties to Route */}
        <Modal
          isOpen={assignPropsModalOpen}
          onClose={() => setAssignPropsModalOpen(false)}
          title={`Assign Properties to "${activeRouteForProps?.name || 'Route'}"`}
        >
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search properties to assign..."
                value={propSearchQuery}
                onChange={(e) => setPropSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {properties
                .filter(p => !propSearchQuery.trim() || p.name.toLowerCase().includes(propSearchQuery.toLowerCase()))
                .map(p => {
                  const isChecked = selectedPropertyIds.has(p.id);
                  const isCurrentRoute = (p.route_id || p.routeId) === activeRouteForProps?.id;
                  const otherRoute = !isCurrentRoute && (p.route_name || p.routeName);

                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-emerald-50/70 border-emerald-300 text-slate-900"
                          : "bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const next = new Set(selectedPropertyIds);
                            if (isChecked) next.delete(p.id);
                            else next.add(p.id);
                            setSelectedPropertyIds(next);
                          }}
                          className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
                        />
                        <div>
                          <p className="font-bold text-xs">{p.name}</p>
                          <p className="text-[11px] text-slate-400">{p.category} • {p.address || "No address"}</p>
                        </div>
                      </div>

                      {otherRoute && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                          Currently on: {otherRoute}
                        </span>
                      )}
                    </label>
                  );
                })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500">
                {selectedPropertyIds.size} Selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAssignPropsModalOpen(false)}
                  className="text-xs font-bold px-3 py-1.5"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSavePropsAssignment}
                  disabled={savingPropsAssignment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-1.5 rounded-xl shadow-xs"
                >
                  {savingPropsAssignment ? "Saving..." : "Save Route Mapping"}
                </Button>
              </div>
            </div>
          </div>
        </Modal>

        {/* MODAL: Log Trip Expense */}
        <Modal
          isOpen={expenseModalOpen}
          onClose={() => setExpenseModalOpen(false)}
          title="Log Truck Trip Expense"
        >
          <form onSubmit={handleSaveExpense} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Expense Category
              </label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              >
                <option value="FUEL">⛽ Fuel / Diesel</option>
                <option value="TOLL">🛣️ Highway Toll</option>
                <option value="MAINTENANCE">🔧 Vehicle Maintenance</option>
                <option value="OTHER">📦 Other Expense</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 1500"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Notes / Bill Reference (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. IOCL Pump receipt #1284"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExpenseModalOpen(false)}
                className="text-xs font-bold px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={savingExpense}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl shadow-xs"
              >
                {savingExpense ? "Saving..." : "Record Expense"}
              </Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}

