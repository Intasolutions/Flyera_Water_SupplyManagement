"use client";

import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/StoreContext";
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
  User as UserIcon,
  Search,
  Filter,
  Package,
  IndianRupee,
  Clock,
  Sparkles,
  ChevronRight,
  RefreshCw,
  RotateCcw
} from "lucide-react";
import { 
  getUsers, 
  User, 
  getRoutes, 
  Route, 
  getClients, 
  Client, 
  getVehicles, 
  Vehicle, 
  getAssignments, 
  Assignment as ApiAssignment, 
  createAssignment, 
  updateAssignment, 
  getInventoryTypes, 
  deleteAssignment as apiDeleteAssignment, 
  completeAssignment as apiCompleteAssignment,
  reopenAssignment 
} from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function DeliveriesPage() {
  const { completeDelivery } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState<string | null>(null);
  const [reconOpen, setReconOpen] = useState<string | null>(null);
  const [dispatchConfirmOpen, setDispatchConfirmOpen] = useState<ApiAssignment | null>(null);
  const confirm = useConfirm();

  const handleReopenAssignment = async (assignmentId: string) => {
    const isConfirmed = await confirm({
      title: "Reopen Route",
      message: "Are you sure you want to undo this closure and reopen the route? This will restore the shift to Active and adjust returned inventory back to the van.",
      confirmText: "Reopen Route",
      cancelText: "Cancel"
    });
    if (isConfirmed) {
      try {
        await reopenAssignment(assignmentId);
        const refreshed = await getAssignments();
        setRealAssignments(refreshed);
        toast.success("Route reopened successfully! Status restored to Active.");
      } catch (e: any) {
        console.error("Failed to reopen route", e);
        toast.error(e.message || "Failed to reopen route.");
      }
    }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "ACTIVE" | "COMPLETED">("ALL");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real data from backend
  const [realStaff, setRealStaff] = useState<User[]>([]);
  const [realRoutes, setRealRoutes] = useState<Route[]>([]);
  const [realClients, setRealClients] = useState<Client[]>([]);
  const [realVehicles, setRealVehicles] = useState<Vehicle[]>([]);
  const [realAssignments, setRealAssignments] = useState<ApiAssignment[]>([]);
  const [inventoryTypes, setInventoryTypes] = useState<any[]>([]);

  useEffect(() => {
    fetchRealData();
    // Poll for real-time updates every 3 seconds
    const interval = setInterval(() => {
      getAssignments().then(setRealAssignments).catch(console.error);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchRealData = async () => {
    try {
      setIsRefreshing(true);
      const [staffData, routesData, clientsData, vehiclesData, assignmentsData, invData] = await Promise.all([
        getUsers(),
        getRoutes(),
        getClients(),
        getVehicles(),
        getAssignments(),
        getInventoryTypes()
      ]);
      setRealStaff(staffData || []);
      setRealRoutes(routesData || []);
      setRealClients(clientsData || []);
      setRealVehicles(vehiclesData || []);
      setRealAssignments(assignmentsData || []);
      setInventoryTypes(invData || []);
    } catch (error) {
      console.error("Failed to fetch real data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Assign modal state
  const [assignDriver, setAssignDriver] = useState("");
  const [assignHelper, setAssignHelper] = useState("");
  const [assignRoute, setAssignRoute] = useState("");
  const [assignVehicle, setAssignVehicle] = useState("");
  const [assignStock, setAssignStock] = useState<Record<string, number>>({});

  const handleSaveAssignment = async () => {
    if (!assignDriver || !assignRoute || !assignVehicle) {
      toast.error("Please select a driver, route, and vehicle.");
      return;
    }

    const allocations = Object.entries(assignStock)
      .filter(([_, count]) => count > 0)
      .map(([invId, count]) => ({
        inventory_type_id: invId,
        allocated_count: count
      }));

    try {
      await createAssignment({
        date: new Date().toISOString(),
        vehicle_id: assignVehicle,
        driver_id: assignDriver,
        helper_id: assignHelper || null,
        route_id: assignRoute,
        status: "PENDING",
        allocations
      });
      setModalOpen(false);
      setAssignDriver("");
      setAssignHelper("");
      setAssignRoute("");
      setAssignVehicle("");
      setAssignStock({});
      // Instant refresh
      const refreshed = await getAssignments();
      setRealAssignments(refreshed);
      toast.success("Assignment created successfully!");
    } catch (e) {
      toast.error("Failed to create assignment.");
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    const isConfirmed = await confirm({
      title: "Delete Assignment",
      message: "Are you sure you want to delete this assignment? The allocated stock will be returned to the warehouse inventory.",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    if (isConfirmed) {
      try {
        await apiDeleteAssignment(assignmentId);
        const refreshed = await getAssignments();
        setRealAssignments(refreshed);
        toast.success("Assignment deleted.");
      } catch (e) {
        toast.error("Failed to delete assignment.");
        console.error(e);
      }
    }
  };

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return realAssignments.filter(a => {
      const aDate = new Date(a.date).toISOString().split("T")[0];
      const matchesDate = aDate >= startDate && aDate <= endDate;
      if (!matchesDate) return false;

      if (statusFilter !== "ALL" && a.status.toUpperCase() !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const vehicle = realVehicles.find(v => v.id === a.vehicle_id)?.plate_number.toLowerCase() || "";
        const driver = realStaff.find(u => u.id === a.driver_id)?.name.toLowerCase() || "";
        const helper = a.helper_id ? (realStaff.find(u => u.id === a.helper_id)?.name.toLowerCase() || "") : "";
        const route = realRoutes.find(r => r.id === a.route_id)?.name.toLowerCase() || "";
        return vehicle.includes(query) || driver.includes(query) || helper.includes(query) || route.includes(query);
      }

      return true;
    });
  }, [realAssignments, startDate, endDate, statusFilter, searchQuery, realVehicles, realStaff, realRoutes]);

  // Aggregate Metrics
  const activeRoutesCount = useMemo(() => {
    return realAssignments.filter(a => a.status === "ACTIVE").length;
  }, [realAssignments]);

  const pendingCount = useMemo(() => {
    return realAssignments.filter(a => a.status === "PENDING").length;
  }, [realAssignments]);

  const completedTodayCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return realAssignments.filter(a => {
      const aDate = new Date(a.date).toISOString().split("T")[0];
      return a.status === "COMPLETED" && aDate === today;
    }).length;
  }, [realAssignments]);

  const totalRevenueCollected = useMemo(() => {
    let sum = 0;
    realAssignments.forEach(a => {
      (a as any).deliveries?.forEach((d: any) => {
        sum += d.total_amount || 0;
      });
    });
    return sum;
  }, [realAssignments]);

  return (
    <div className="flex min-h-screen bg-[#FDFBF7]">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-72 p-4 sm:p-6 md:p-10 lg:p-12 pt-20 md:pt-10 pb-24 md:pb-12 transition-all relative">
        {/* Standardized Frosted Page Header */}
        <PageHeader
          title="Deliveries & Dispatch"
          subtitle="Real-time route assignments, fleet vehicle dispatch & end-of-day revenue reconciliation"
          badgeText="Dispatch Center Live"
          actionSlot={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRealData}
                disabled={isRefreshing}
                icon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : "text-slate-500"}`} />}
              >
                Refresh
              </Button>
              <Button
                onClick={() => setModalOpen(true)}
                icon={<UserPlus className="w-5 h-5" />}
              >
                Assign Route
              </Button>
            </div>
          }
        />

        {/* Top KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <StatCard
            label="Active On-Road"
            value={activeRoutesCount}
            subtext="Live delivery routes"
            icon={<Truck className="w-6 h-6" />}
            color="emerald"
            category="Live Fleet"
          />
          <StatCard
            label="Pending Dispatch"
            value={pendingCount}
            subtext="Awaiting morning gate-out"
            icon={<Clock className="w-6 h-6" />}
            color="amber"
            category="In Staging"
          />
          <StatCard
            label="Completed Today"
            value={completedTodayCount}
            subtext="Reconciled & closed"
            icon={<CheckCircle2 className="w-6 h-6" />}
            color="purple"
            category="Closed Routes"
          />
          <StatCard
            label="Collected Cash"
            value={`₹${totalRevenueCollected.toLocaleString()}`}
            subtext="From completed drops"
            icon={<IndianRupee className="w-6 h-6" />}
            color="blue"
            category="Revenue"
          />
        </div>

        {/* Filter & Date Toolbar */}
        <div className="glass-panel p-4 md:p-5 mb-8 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            {/* Search and Status Pills */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by vehicle, driver, route or helper..."
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

              {/* Status Segmented Control */}
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 self-start sm:self-auto overflow-x-auto max-w-full">
                {(["ALL", "PENDING", "ACTIVE", "COMPLETED"] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                      statusFilter === status
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {status === "ALL" ? "All Status" : status}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range Selector */}
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <div className="flex items-center gap-2 bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 shadow-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="outline-none text-xs font-bold text-slate-700 bg-transparent cursor-pointer"
                />
                <span className="text-slate-300 font-bold text-xs">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="outline-none text-xs font-bold text-slate-700 bg-transparent cursor-pointer"
                />
              </div>

              <button
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setStartDate(today);
                  setEndDate(today);
                }}
                className="px-3 py-2 bg-white/80 hover:bg-white text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 shadow-sm transition-all active:scale-95"
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {/* Assignments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAssignments.length === 0 ? (
            <div className="col-span-full py-16 text-center glass-panel">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary">
                <Truck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">No Delivery Routes Found</h3>
              <p className="text-slate-500 font-medium text-sm max-w-md mx-auto mb-5">
                {searchQuery || statusFilter !== "ALL"
                  ? "Try loosening your filters or resetting search to see more assignments."
                  : "No vehicles are currently assigned for this date range. Click 'Assign Route' to dispatch one."}
              </p>
              <Button onClick={() => setModalOpen(true)} icon={<UserPlus className="w-4 h-4" />}>
                Assign New Route
              </Button>
            </div>
          ) : (
            filteredAssignments.map(a => {
              const vehicle = realVehicles.find(v => v.id === a.vehicle_id)?.plate_number || "Unknown Vehicle";
              const driver = realStaff.find(u => u.id === a.driver_id)?.name || "Unknown Driver";
              const helper = a.helper_id ? realStaff.find(u => u.id === a.helper_id)?.name : undefined;
              const route = realRoutes.find(r => r.id === a.route_id)?.name || "Unknown Route";
              const routeArea = realRoutes.find(r => r.id === a.route_id)?.area;
              
              const stockDisplay = a.allocations && a.allocations.length > 0
                ? a.allocations.map(al => {
                    const invName = inventoryTypes.find(i => i.id === al.inventory_type_id)?.name || "Item";
                    return `${al.allocated_count}x ${invName}`;
                  }).join(", ")
                : "No stock";

              const routeClientsCount = realClients.filter(c => c.route_id === a.route_id).length || 10;
              let progress = a.status === "COMPLETED" 
                ? 100 
                : (a.status === "ACTIVE" 
                    ? Math.min(100, Math.round(((a as any).deliveries_count || 0) / routeClientsCount * 100)) 
                    : 0);

              return (
                <AssignmentCard
                  key={a.id}
                  id={a.id}
                  vehicle={vehicle}
                  driver={driver}
                  helper={helper}
                  route={route}
                  routeArea={routeArea}
                  stock={stockDisplay}
                  status={a.status.toLowerCase()}
                  progress={progress}
                  date={a.date}
                  onAssign={() => setDispatchConfirmOpen(a)}
                  onTrack={() => setTrackOpen(vehicle)}
                  onRecon={() => setReconOpen(vehicle)}
                  onDelete={() => handleDeleteAssignment(a.id)}
                  onReopen={() => handleReopenAssignment(a.id)}
                />
              );
            })
          )}
        </div>

        {/* Assign Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Assign Vehicle & Route"
          subtitle="Configure crew members, delivery path, and morning loaded stock"
          width="2xl"
          actions={
            <div className="flex gap-4 w-full">
              <Button variant="secondary" onClick={() => setModalOpen(false)} fullWidth>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveAssignment} fullWidth>
                Save Assignment
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Select Driver *
                </label>
                <select
                  value={assignDriver}
                  onChange={e => setAssignDriver(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>Choose Driver</option>
                  {realStaff.filter(s => s.role.toUpperCase() === "DRIVER").map(d => {
                    const isAssigned = realAssignments.some(a => (a.driver_id === d.id || a.helper_id === d.id) && a.status !== "COMPLETED");
                    return (
                      <option key={d.id} value={d.id} disabled={isAssigned}>
                        {d.name} {isAssigned ? "(Already on route)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Select Helper (Optional)
                </label>
                <select
                  value={assignHelper}
                  onChange={e => setAssignHelper(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="">No Helper Assigned</option>
                  {realStaff.filter(s => s.role.toUpperCase() === "HELPER").map(d => {
                    const isAssigned = realAssignments.some(a => (a.driver_id === d.id || a.helper_id === d.id) && a.status !== "COMPLETED");
                    return (
                      <option key={d.id} value={d.id} disabled={isAssigned}>
                        {d.name} {isAssigned ? "(Already assigned)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Select Vehicle *
                </label>
                <select
                  value={assignVehicle}
                  onChange={e => setAssignVehicle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>Choose Vehicle</option>
                  {realVehicles.map(v => {
                    const isAssigned = realAssignments.some(a => a.vehicle_id === v.id && a.status !== "COMPLETED");
                    return (
                      <option key={v.id} value={v.id} disabled={isAssigned}>
                        {v.plate_number} {isAssigned ? "(Already in use)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Select Delivery Route *
                </label>
                <select
                  value={assignRoute}
                  onChange={e => setAssignRoute(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>Choose Route</option>
                  {realRoutes.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.area || "General Area"})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Allocate Stock to Vehicle
                </label>
                <span className="text-[11px] font-bold text-slate-400">Bottles / Crates loaded</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/60">
                {inventoryTypes.length === 0 ? (
                  <p className="text-sm text-slate-500 font-medium">No inventory types configured. Add them in Inventory.</p>
                ) : (
                  inventoryTypes.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs">
                      <div>
                        <span className="font-bold text-slate-800 text-sm block">{inv.name}</span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Warehouse stock</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={assignStock[inv.id] || ""}
                          onChange={e => setAssignStock(prev => ({ ...prev, [inv.id]: parseInt(e.target.value) || 0 }))}
                          className="w-24 border border-slate-200 rounded-lg p-2 text-center text-slate-800 font-black outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Modal>

        {/* Live Track Modal */}
        <Modal
          isOpen={!!trackOpen}
          onClose={() => setTrackOpen(null)}
          title={`Vehicle: ${trackOpen}`}
          subtitle={
            (() => {
              const activeAssignment = realAssignments.find(a => realVehicles.find(v => v.id === a.vehicle_id)?.plate_number === trackOpen);
              const driverName = realStaff.find(s => s.id === activeAssignment?.driver_id)?.name || "Unknown";
              return (
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 p-1 rounded-md text-primary">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Assigned Driver:</span>
                  <span className="font-black text-slate-800 text-sm">{driverName}</span>
                </div>
              );
            })()
          }
          width="4xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {(() => {
              const activeAssignment = realAssignments.find(a => realVehicles.find(v => v.id === a.vehicle_id)?.plate_number === trackOpen);
              const assignedRoute = realRoutes.find(r => r.id === activeAssignment?.route_id);
              const routeClients = assignedRoute ? realClients.filter(c => c.route_id === assignedRoute.id) : [];
              const deliveredClientIds = (activeAssignment as any)?.deliveries?.map((d: any) => d.client_id) || [];
              const deliveredCount = routeClients.filter(c => deliveredClientIds.includes(c.id)).length;
              const totalClients = routeClients.length || 1;
              const progressPercent = Math.round((deliveredCount / totalClients) * 100);
              const nextClient = routeClients.find(c => !deliveredClientIds.includes(c.id));
              const isCompleted = deliveredCount === totalClients && totalClients > 0;

              const deliveries = (activeAssignment as any)?.deliveries || [];
              const totalEarned = deliveries.reduce((sum: number, d: any) => sum + (d.total_amount || 0), 0);
              const deliveredBottles = deliveries.reduce((sum: number, d: any) => sum + (d.items?.reduce((itemSum: number, item: any) => itemSum + (item.delivered_full || 0), 0) || 0), 0);
              const totalAllocated = (activeAssignment as any)?.allocations?.reduce((sum: number, a: any) => sum + (a.allocated_count || 0), 0) || 0;
              const bottlesLeft = Math.max(0, totalAllocated - deliveredBottles);

              return (
                <div className="glass-panel p-6 rounded-3xl flex flex-col justify-between">
                  <div>
                    <div className="mb-6">
                      <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-2 inline-block">
                        Active Telemetry
                      </span>
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">Delivery Progress</h3>
                      <p className="text-slate-500 font-medium text-xs">Live tracking for {assignedRoute?.name}</p>
                    </div>

                    <div className="mb-8">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-4xl font-black text-primary">{progressPercent}%</span>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-200/60 px-3 py-1 rounded-lg">
                          {deliveredCount} / {totalClients} Completed
                        </span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-primary rounded-full transition-all duration-1000 ease-out relative"
                          style={{ width: `${progressPercent}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs text-center">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Delivered</p>
                        <p className="text-xl font-black text-slate-800">{deliveredBottles}</p>
                      </div>
                      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs text-center">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">In Van</p>
                        <p className="text-xl font-black text-amber-600">{bottlesLeft}</p>
                      </div>
                      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs text-center">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Earned</p>
                        <p className="text-xl font-black text-emerald-600">₹{totalEarned}</p>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
                      <div className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-50 shadow-xs flex items-center justify-center"></div>
                        <h4 className="font-black text-slate-800 text-sm">Gate-Out Dispatched</h4>
                        <p className="text-slate-400 text-xs font-medium">Van departed distribution hub</p>
                      </div>

                      {!isCompleted && nextClient ? (
                        <div className="relative pl-6">
                          <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-primary ring-4 ring-primary/20 animate-pulse"></div>
                          <h4 className="font-black text-primary text-sm">Next Stop: {nextClient.name}</h4>
                          <p className="text-slate-500 text-xs font-medium">{nextClient.address || "Address on route"}</p>
                        </div>
                      ) : null}

                      <div className={`relative pl-6 ${isCompleted ? "" : "opacity-40"}`}>
                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ${isCompleted ? "bg-emerald-500 ring-4 ring-emerald-50" : "bg-slate-300"}`}></div>
                        <h4 className="font-black text-slate-800 text-sm">Route Reconciled</h4>
                        <p className="text-slate-400 text-xs font-medium">All assigned stops cleared</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-200/60 mt-6">
                    <Button
                      variant="primary"
                      className="w-full"
                      icon={<Phone className="w-4 h-4" />}
                      onClick={() => {
                        const driver = realStaff.find(s => s.id === activeAssignment?.driver_id);
                        if (driver?.phone) {
                          window.location.href = `tel:${driver.phone}`;
                        } else {
                          toast.error("No phone number registered for this driver.");
                        }
                      }}
                    >
                      Call Driver on Road
                    </Button>
                  </div>
                </div>
              );
            })()}

            {/* Itinerary Column */}
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 block">
                Assigned Route Stops
              </span>
              <div className="glass-panel p-4 rounded-3xl flex-1 overflow-y-auto max-h-[460px] space-y-3">
                {(() => {
                  const activeAssignment = realAssignments.find(a => realVehicles.find(v => v.id === a.vehicle_id)?.plate_number === trackOpen);
                  const assignedRoute = realRoutes.find(r => r.id === activeAssignment?.route_id);
                  const routeClients = assignedRoute ? realClients.filter(c => c.route_id === assignedRoute.id) : [];

                  if (routeClients.length === 0) {
                    return <p className="text-sm font-medium text-slate-400 p-4 text-center">No clients configured on this route.</p>;
                  }

                  return routeClients.map((client, idx) => {
                    const deliveredClientIds = (activeAssignment as any)?.deliveries?.map((d: any) => d.client_id) || [];
                    const isDelivered = deliveredClientIds.includes(client.id);
                    const isNext = !isDelivered && (idx === 0 || deliveredClientIds.includes(routeClients[idx - 1]?.id));

                    return (
                      <div
                        key={client.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                          isDelivered
                            ? "bg-emerald-50/40 border-emerald-100"
                            : isNext
                            ? "bg-white border-primary shadow-xs"
                            : "bg-white/60 border-slate-100 opacity-60"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className={`font-black text-sm truncate ${isDelivered ? "text-slate-500 line-through" : "text-slate-800"}`}>
                            {client.name}
                          </p>
                          <p className="text-xs text-slate-400 font-medium truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {client.address || "Local address"}
                          </p>
                        </div>

                        {isDelivered && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md shrink-0">
                            Delivered
                          </span>
                        )}
                        {isNext && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0 animate-pulse">
                            En Route
                          </span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </Modal>

        {/* End of Day Reconciliation Modal */}
        <Modal
          isOpen={!!reconOpen}
          onClose={() => setReconOpen(null)}
          title="End of Day Reconciliation"
          subtitle={`Reconcile returns, empties & cash for ${reconOpen}`}
          width="lg"
          actions={(() => {
            const assignmentObj = realAssignments.find(a => realVehicles.find(v => v.id === a.vehicle_id)?.plate_number === reconOpen);
            const isAlreadyCompleted = assignmentObj?.status === "COMPLETED";

            if (isAlreadyCompleted) {
              return (
                <div className="flex gap-3 w-full">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setReconOpen(null)}
                  >
                    Close Window
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-amber-300 text-amber-800 hover:bg-amber-50"
                    icon={<RotateCcw className="w-4 h-4 text-amber-600" />}
                    onClick={async () => {
                      const isConfirmed = await confirm({
                        title: "Reopen Route",
                        message: "Are you sure you want to undo this closure and reopen the route? This will restore the shift to Active and adjust returned inventory back to the van.",
                        confirmText: "Reopen Route",
                        cancelText: "Cancel"
                      });
                      if (isConfirmed && assignmentObj) {
                        try {
                          await reopenAssignment(assignmentObj.id);
                          const refreshed = await getAssignments();
                          setRealAssignments(refreshed);
                          toast.success("Route reopened successfully! Status restored to Active.");
                          setReconOpen(null);
                        } catch (e: any) {
                          console.error("Failed to reopen assignment", e);
                          toast.error(e.message || "Failed to reopen route.");
                        }
                      }
                    }}
                  >
                    Undo Closure &amp; Reopen
                  </Button>
                </div>
              );
            }

            return (
              <Button
                variant="primary"
                onClick={async () => {
                  if (assignmentObj) {
                    try {
                      const returned_stock = assignmentObj.allocations.map(alloc => {
                        const invId = alloc.inventory_type_id;
                        let total_delivered = 0;
                        let total_empty = 0;
                        (assignmentObj as any).deliveries?.forEach((d: any) => {
                          d.items?.forEach((item: any) => {
                            if (item.inventory_type_id === invId) {
                              total_delivered += item.delivered_full || 0;
                              total_empty += item.collected_empty || 0;
                            }
                          });
                        });
                        return {
                          inventory_type_id: invId,
                          allocated_count: alloc.allocated_count,
                          returned_full: Math.max(0, alloc.allocated_count - total_delivered),
                          returned_empty: total_empty
                        };
                      });
                      await apiCompleteAssignment(assignmentObj.id, returned_stock);
                      const refreshed = await getAssignments();
                      setRealAssignments(refreshed);
                      toast.success("Route reconciled and closed!");
                    } catch (e) {
                      console.error("Failed to complete assignment", e);
                      toast.error("Failed to close route.");
                    }
                  }
                  setReconOpen(null);
                }}
                fullWidth
              >
                Confirm &amp; Return Stock to Warehouse
              </Button>
            );
          })()}
        >
          <div>
            {(() => {
              const assignmentObj = realAssignments.find(a => realVehicles.find(v => v.id === a.vehicle_id)?.plate_number === reconOpen);
              if (!assignmentObj) return null;

              const stats = assignmentObj.allocations.map(alloc => {
                const inv = inventoryTypes.find(i => i.id === alloc.inventory_type_id);
                let total_delivered = 0;
                let total_empty = 0;
                (assignmentObj as any).deliveries?.forEach((d: any) => {
                  d.items?.forEach((item: any) => {
                    if (item.inventory_type_id === alloc.inventory_type_id) {
                      total_delivered += item.delivered_full || 0;
                      total_empty += item.collected_empty || 0;
                    }
                  });
                });
                return {
                  name: inv?.name || "Item",
                  allocated: alloc.allocated_count,
                  delivered: total_delivered,
                  empty: total_empty,
                  returned: Math.max(0, alloc.allocated_count - total_delivered)
                };
              });

              let totalCash = 0;
              let totalUpi = 0;
              let totalPendingSlip = 0;
              (assignmentObj as any).deliveries?.forEach((d: any) => {
                if (d.payment_method === "Cash") {
                  totalCash += d.total_amount || 0;
                } else if (d.payment_method === "Pay Later (Slip QR)" || d.status === "PENDING_PAYMENT") {
                  totalPendingSlip += d.total_amount || 0;
                } else {
                  totalUpi += d.total_amount || 0;
                }
              });

              return (
                <div className="space-y-5">
                  {stats.map((stat, idx) => (
                    <div key={idx} className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200/70">
                        <span className="font-black text-slate-800 text-sm">Dispatched: {stat.name}</span>
                        <span className="font-black text-primary text-base">{stat.allocated} Loaded</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">Delivered Full</span>
                          <span className="font-black text-slate-800 text-lg">{stat.delivered}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">Empty Cullet</span>
                          <span className="font-black text-slate-800 text-lg">{stat.empty}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 block">Unsold Return</span>
                          <span className="font-black text-slate-800 text-lg">{stat.returned}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 shadow-xs">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">Cash Handover</span>
                      <span className="text-2xl font-black text-emerald-950">₹{totalCash.toLocaleString()}</span>
                      <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Physical cash from driver</span>
                    </div>

                    <div className="p-4 bg-sky-50/80 rounded-2xl border border-sky-200/80 shadow-xs">
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 block">Direct UPI QR</span>
                      <span className="text-2xl font-black text-sky-950">₹{totalUpi.toLocaleString()}</span>
                      <span className="text-[10px] text-sky-600 font-bold block mt-0.5">Direct to bank account</span>
                    </div>

                    <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200/80 shadow-xs">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">Pending Slip QR</span>
                      <span className="text-2xl font-black text-amber-950">₹{totalPendingSlip.toLocaleString()}</span>
                      <span className="text-[10px] text-amber-600 font-bold block mt-0.5">Left at door / Pay later</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>

        {/* Dispatch Confirm Modal */}
        <Modal
          isOpen={!!dispatchConfirmOpen}
          onClose={() => setDispatchConfirmOpen(null)}
          title="Dispatch Route"
          subtitle="Authorize vehicle departure and activate mobile navigation"
          width="sm"
          actions={
            <div className="flex gap-4 w-full">
              <Button variant="secondary" onClick={() => setDispatchConfirmOpen(null)} fullWidth>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (dispatchConfirmOpen) {
                    try {
                      await updateAssignment(dispatchConfirmOpen.id, { status: "ACTIVE" });
                      const refreshed = await getAssignments();
                      setRealAssignments(refreshed);
                      toast.success("Route dispatched to driver app!");
                    } catch (e) {
                      console.error("Failed to dispatch", e);
                      toast.error("Failed to dispatch.");
                    }
                    setDispatchConfirmOpen(null);
                  }
                }}
                fullWidth
              >
                Confirm Dispatch
              </Button>
            </div>
          }
        >
          <div className="text-center py-2">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Gate-Out Route Departure</h3>
            <p className="text-slate-500 font-medium text-xs leading-relaxed max-w-xs mx-auto">
              Are you sure you want to dispatch this route? The assigned driver will receive live turn-by-turn customer stops on their device.
            </p>
          </div>
        </Modal>
      </main>
    </div>
  );
}

function AssignmentCard({
  id,
  vehicle,
  driver,
  helper,
  route,
  routeArea,
  stock,
  status,
  progress,
  date,
  onAssign,
  onTrack,
  onRecon,
  onDelete,
  onReopen
}: any) {
  const isCompleted = status === "completed";
  const isPending = status === "pending";
  const isActive = status === "active";

  return (
    <div
      className={`glass-card p-6 flex flex-col justify-between relative group transition-all duration-300 hover:shadow-md ${
        isCompleted
          ? "border-emerald-200/60 bg-emerald-50/15"
          : isActive
          ? "border-sky-200/80 bg-white/95"
          : "border-slate-100"
      }`}
    >
      {/* Top Bar with Vehicle Plate & Status Badge */}
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${
                isActive
                  ? "bg-sky-50 border-sky-100 text-sky-600"
                  : isCompleted
                  ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                  : "bg-slate-100 border-slate-200/60 text-slate-500"
              }`}
            >
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-slate-800 tracking-tight leading-none">{vehicle}</h3>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isActive ? "bg-sky-500 animate-pulse" : isCompleted ? "bg-emerald-500" : "bg-amber-400"
                  }`}
                />
                <span
                  className={`text-xs font-black uppercase tracking-wider ${
                    isActive ? "text-sky-700" : isCompleted ? "text-emerald-800" : "text-amber-800"
                  }`}
                >
                  {status}
                </span>
              </div>
            </div>
          </div>

          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
              title="Delete Assignment"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Crew & Route Details */}
        <div className="space-y-3.5 mb-6 text-sm">
          <div className="flex justify-between items-center bg-slate-50/90 p-3.5 rounded-2xl border border-slate-100">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-0.5">Crew</span>
              <span className="font-black text-slate-900 text-sm">{driver}</span>
            </div>
            {helper && (
              <div className="text-right">
                <span className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-0.5">Helper</span>
                <span className="font-bold text-slate-700 text-sm">{helper}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-xs sm:text-sm">
            <span className="text-slate-600 font-bold flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-500" /> Route
            </span>
            <span className="font-black text-slate-900 text-right">
              {route} {routeArea ? <span className="text-slate-500 font-semibold">({routeArea})</span> : null}
            </span>
          </div>

          {date && (
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-slate-600 font-bold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500" /> Date
              </span>
              <span className="font-bold text-slate-700">
                {new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>
          )}

          {/* Stock Badges */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-2">
              Allocated Cargo
            </span>
            <div className="flex flex-wrap gap-1.5">
              {stock !== "No stock" ? (
                stock.split(", ").map((s: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 text-xs font-black border border-sky-200"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs font-bold text-slate-500 italic">No inventory allocated</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress & Bottom Actions */}
      <div>
        {!isPending && (
          <div className="mb-5">
            <div className="flex justify-between text-xs sm:text-sm mb-1.5 font-bold">
              <span className="text-slate-600 text-xs font-black uppercase tracking-wider">Route Progress</span>
              <span className={isCompleted ? "text-emerald-700 font-black" : "text-sky-700 font-black"}>{progress}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isCompleted ? "bg-emerald-500" : "bg-gradient-to-r from-sky-400 to-primary"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {isPending ? (
          <Button variant="primary" fullWidth onClick={onAssign} icon={<Zap className="w-4 h-4" />}>
            Dispatch Route
          </Button>
        ) : isCompleted ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-[1.4]" onClick={onRecon} icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}>
              Reconciliation
            </Button>
            {onReopen && (
              <Button
                variant="secondary"
                className="flex-1 border-amber-200 text-amber-800 hover:bg-amber-100"
                onClick={onReopen}
                icon={<RotateCcw className="w-3.5 h-3.5 text-amber-600" />}
              >
                Reopen
              </Button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onTrack} icon={<Navigation className="w-4 h-4" />}>
              Track Live
            </Button>
            <Button variant="outline" className="flex-1" onClick={onRecon}>
              Close Route
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
