"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/StoreContext";
import { Truck, MapPin, Calendar, UserPlus, X, AlertTriangle, CheckCircle2, Phone, Navigation, Zap, Trash2, User as UserIcon } from "lucide-react";
import { getUsers, User, getRoutes, Route, getClients, Client, getVehicles, Vehicle, getAssignments, Assignment as ApiAssignment, createAssignment, updateAssignment, getInventoryTypes, deleteAssignment as apiDeleteAssignment, completeAssignment as apiCompleteAssignment } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function DeliveriesPage() {
  const { completeDelivery } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState<string | null>(null);
  const [reconOpen, setReconOpen] = useState<string | null>(null);
  const [dispatchConfirmOpen, setDispatchConfirmOpen] = useState<ApiAssignment | null>(null);
  const confirm = useConfirm();

  // Track delivered clients locally for the live UI
  const [deliveredClients, setDeliveredClients] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

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
      const [staffData, routesData, clientsData, vehiclesData, assignmentsData, invData] = await Promise.all([
        getUsers(),
        getRoutes(),
        getClients(),
        getVehicles(),
        getAssignments(),
        getInventoryTypes()
      ]);
      setRealStaff(staffData);
      setRealRoutes(routesData);
      setRealClients(clientsData);
      setRealVehicles(vehiclesData);
      setRealAssignments(assignmentsData);
      setInventoryTypes(invData);
    } catch (error) {
      console.error("Failed to fetch real data:", error);
    }
  };

  // Assign modal state
  const [assignDriver, setAssignDriver] = useState("");
  const [assignHelper, setAssignHelper] = useState("");
  const [assignRoute, setAssignRoute] = useState("");
  const [assignVehicle, setAssignVehicle] = useState("");
  const [assignStock, setAssignStock] = useState<Record<string, number>>({});

  const handleSaveAssignment = async () => {
    if (assignDriver && assignRoute && assignVehicle) {
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
        getAssignments().then(setRealAssignments).catch(console.error);
        toast.success("Assignment created successfully!");
      } catch (e) {
        toast.error("Failed to create assignment.");
      }
    }
  };
  const handleDeliver = (assignmentId: string, clientId: string) => {
    // We assume an average of 2 bottles delivered per client for this mock
    const bottlesDelivered = 2;
    const pointsEarned = 10;
    completeDelivery(assignmentId, clientId, bottlesDelivered, pointsEarned, "Cash");

    // Add to local state so UI updates
    setDeliveredClients(prev => [...prev, clientId]);
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    const isConfirmed = await confirm({
      title: "Delete Assignment",
      message: "Are you sure you want to delete this assignment? The stock will be returned to the warehouse.",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    if (isConfirmed) {
      try {
        await apiDeleteAssignment(assignmentId);
        getAssignments().then(setRealAssignments).catch(console.error);
        toast.success("Assignment deleted.");
      } catch (e) {
        toast.error("Failed to delete assignment.");
        console.error(e);
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8 transition-all relative">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text mb-1">Deliveries & Assignments</h1>
            <p className="text-text-muted">Manage daily routes and allocate stock to vehicles.</p>
          </div>
          <div className="flex w-full md:w-auto gap-3 flex-col md:flex-row">
            <Button onClick={() => setModalOpen(true)} icon={<UserPlus className="w-5 h-5" />}>
              Assign Route
            </Button>
          </div>
        </header>

        {/* Date Selector */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
            <Calendar className="w-5 h-5 text-text-muted ml-1" />
            <input 
              type="date" 
              className="outline-none text-sm font-medium text-slate-700 bg-transparent"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-slate-400 font-medium text-sm">to</span>
            <input 
              type="date" 
              className="outline-none text-sm font-medium text-slate-700 bg-transparent mr-1"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Assignments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {realAssignments.filter(a => {
            const aDate = new Date(a.date).toISOString().split('T')[0];
            return aDate >= startDate && aDate <= endDate;
          }).map(a => {
            const vehicle = realVehicles.find(v => v.id === a.vehicle_id)?.plate_number || "Unknown Vehicle";
            const driver = realStaff.find(u => u.id === a.driver_id)?.name || "Unknown Driver";
            const helper = a.helper_id ? realStaff.find(u => u.id === a.helper_id)?.name : undefined;
            const route = realRoutes.find(r => r.id === a.route_id)?.name || "Unknown Route";
            const stockDisplay = a.allocations && a.allocations.length > 0 
              ? a.allocations.map(al => {
                  const invName = inventoryTypes.find(i => i.id === al.inventory_type_id)?.name || "Item";
                  return `${al.allocated_count}x ${invName}`;
                }).join(', ')
              : 'No stock';
            // Assuming average 10 clients per route for progress bar demo, or fallback to status
            const routeClientsCount = realClients.filter(c => c.route_id === a.route_id).length || 10;
            let progress = a.status === "COMPLETED" ? 100 : (a.status === "ACTIVE" ? Math.min(100, Math.round(((a as any).deliveries_count || 0) / routeClientsCount * 100)) : 0);

            return (
              <AssignmentCard
                key={a.id}
                id={a.id}
                vehicle={vehicle}
                driver={driver}
                helper={helper}
                route={route}
                stock={stockDisplay}
                status={a.status.toLowerCase()}
                progress={progress}
                date={a.date}
                onAssign={() => setDispatchConfirmOpen(a)}
                onTrack={() => setTrackOpen(vehicle)}
                onRecon={() => setReconOpen(vehicle)}
                onDelete={() => handleDeleteAssignment(a.id)}
              />
            );
          })}
        </div>

        {/* Assign Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Assign Vehicle"
          width="2xl"
          actions={
            <div className="flex gap-4 w-full">
              <Button variant="secondary" onClick={() => setModalOpen(false)} fullWidth>Cancel</Button>
              <Button variant="primary" onClick={handleSaveAssignment} fullWidth>
                Save Assignment
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Select Driver</label>
                <select value={assignDriver} onChange={e => setAssignDriver(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                  <option value="" disabled>Choose Driver</option>
                  {realStaff.filter(s => s.role.toUpperCase() === "DRIVER").map(d => {
                    const isAssigned = realAssignments.some(a => (a.driver_id === d.id || a.helper_id === d.id) && a.status !== "COMPLETED");
                    return (
                      <option key={d.id} value={d.id} disabled={isAssigned}>
                        {d.name} {isAssigned ? "(Already assigned)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Select Helper (Optional)</label>
                <select value={assignHelper} onChange={e => setAssignHelper(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                  <option value="">No Helper</option>
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
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Select Vehicle</label>
                <select value={assignVehicle} onChange={e => setAssignVehicle(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                  <option value="" disabled>Choose Vehicle</option>
                  {realVehicles.map(v => {
                    const isAssigned = realAssignments.some(a => a.vehicle_id === v.id && a.status !== "COMPLETED");
                    return (
                      <option key={v.id} value={v.id} disabled={isAssigned}>
                        {v.plate_number} {isAssigned ? "(Already assigned)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Select Route</label>
                <select value={assignRoute} onChange={e => setAssignRoute(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                  <option value="" disabled>Choose Route</option>
                  {realRoutes.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.area})</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Allocate Stock</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                {inventoryTypes.length === 0 ? (
                  <p className="text-sm text-slate-500 font-medium">No inventory types found. Add them in the Inventory page.</p>
                ) : (
                  inventoryTypes.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                      <span className="font-bold text-slate-700">{inv.name}</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="0"
                          value={assignStock[inv.id] || ''} 
                          onChange={e => setAssignStock(prev => ({...prev, [inv.id]: parseInt(e.target.value) || 0}))} 
                          className="w-24 border border-gray-200 rounded-lg p-2 text-center text-slate-800 font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" 
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
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <span>Driver:</span>
                  <span className="font-bold text-slate-800 text-base">{driverName}</span>
                </div>
              );
            })()
          }
          width="4xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 -m-2">
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
                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 flex flex-col">
                  <div className="mb-8">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-1">Delivery Progress</h3>
                    <p className="text-slate-500 font-medium text-sm">Live tracking for {assignedRoute?.name}</p>
                  </div>

                  <div className="mb-10">
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-5xl font-black text-primary">{progressPercent}%</span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-200/50 px-3 py-1.5 rounded-lg">{deliveredCount} / {totalClients} Delivered</span>
                    </div>
                    <div className="h-4 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${progressPercent}%` }}>
                        <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase">Delivered</p>
                      <p className="text-xl font-black text-slate-800">{deliveredBottles}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase">Left in Van</p>
                      <p className="text-xl font-black text-amber-600">{bottlesLeft}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase">Earned</p>
                      <p className="text-xl font-black text-emerald-600">₹{totalEarned}</p>
                    </div>
                  </div>

                  <div className="relative border-l-4 border-slate-200 ml-4 space-y-8 flex-1">
                    {/* Step 1: Dispatched */}
                    <div className="relative pl-8">
                      <div className="absolute -left-[14px] top-0 w-6 h-6 rounded-full bg-emerald-500 border-4 border-slate-50 shadow-sm flex items-center justify-center">
                      </div>
                      <h4 className="font-bold text-slate-800 text-lg">Route Dispatched</h4>
                      <p className="text-slate-500 text-sm font-medium mt-1">Driver has left the godown.</p>
                    </div>

                    {/* Step 2: Current Stop */}
                    {!isCompleted && nextClient ? (
                      <div className="relative pl-8">
                        <div className="absolute -left-[14px] top-0 w-6 h-6 rounded-full bg-primary border-4 border-slate-50 shadow-sm">
                          <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-30"></span>
                        </div>
                        <h4 className="font-bold text-primary text-lg">Heading to Next Stop</h4>
                        <p className="text-slate-700 font-bold mt-1">{nextClient.name}</p>
                        <p className="text-slate-500 text-sm mt-0.5">{nextClient.address}</p>
                      </div>
                    ) : null}

                    {/* Step 3: Pending Stops */}
                    {!isCompleted && totalClients - deliveredCount > 1 ? (
                      <div className="relative pl-8 opacity-60">
                        <div className="absolute -left-[14px] top-0 w-6 h-6 rounded-full bg-slate-300 border-4 border-slate-50"></div>
                        <h4 className="font-bold text-slate-600 text-lg">{totalClients - deliveredCount - 1} Stops Remaining</h4>
                        <p className="text-slate-500 text-sm font-medium mt-1">Pending in queue.</p>
                      </div>
                    ) : null}

                    {/* Step 4: Completed */}
                    <div className={`relative pl-8 ${isCompleted ? '' : 'opacity-40'}`}>
                       <div className={`absolute -left-[14px] top-0 w-6 h-6 rounded-full border-4 border-slate-50 ${isCompleted ? 'bg-emerald-500 flex items-center justify-center' : 'bg-slate-300'}`}>
                       </div>
                       <h4 className="font-bold text-slate-800 text-lg">Route Completed</h4>
                       <p className="text-slate-500 text-sm font-medium mt-1">All deliveries finished.</p>
                    </div>
                  </div>

              <div className="flex gap-3 mt-8">
                <Button 
                  variant="primary" 
                  className="flex-1" 
                  icon={<Phone className="w-4 h-4" />}
                  onClick={() => {
                    const activeAssignment = realAssignments.find(a => realVehicles.find(v => v.id === a.vehicle_id)?.plate_number === trackOpen);
                    const driver = realStaff.find(s => s.id === activeAssignment?.driver_id);
                    if (driver?.phone) {
                      window.location.href = `tel:${driver.phone}`;
                    } else {
                      toast.error("No phone number found for this driver.");
                    }
                  }}
                >
                  Call Crew
                </Button>
              </div>
            </div>
          );
        })()}

            <div className="flex flex-col">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Current Status</p>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3 mb-6">
                <Truck className="w-6 h-6 text-blue-600 shrink-0" />
                <div>
                  <p className="font-bold text-blue-900">En Route to Hinjewadi Phase 1</p>
                  <p className="text-sm text-blue-700 font-medium">ETA: 12 Minutes</p>
                </div>
              </div>

              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Live Itinerary</p>
              <div className="space-y-4 border-l-2 border-gray-100 ml-3 pl-6 relative">
                {(() => {
                  const activeAssignment = realAssignments.find(a => realVehicles.find(v => v.id === a.vehicle_id)?.plate_number === trackOpen);
                  const assignedRoute = realRoutes.find(r => r.id === activeAssignment?.route_id);
                  const routeClients = assignedRoute ? realClients.filter(c => c.route_id === assignedRoute.id) : [];

                  if (routeClients.length === 0) {
                    return <p className="text-sm font-medium text-slate-500">No clients assigned to this route.</p>;
                  }

                  return routeClients.map((client, idx) => {
                    const deliveredClientIds = (activeAssignment as any)?.deliveries?.map((d: any) => d.client_id) || [];
                    const isDelivered = deliveredClientIds.includes(client.id);
                    const isNext = !isDelivered && (idx === 0 || deliveredClientIds.includes(routeClients[idx - 1]?.id));

                    return (
                      <div key={client.id} className="relative">
                        <div className={`absolute -left-[33px] w-4 h-4 rounded-full border-2 border-white ring-2 ${isDelivered ? 'bg-emerald-500 ring-emerald-100' : isNext ? 'bg-primary ring-primary/20' : 'bg-gray-300 ring-transparent opacity-50'}`}></div>
                        <div className="flex justify-between items-start">
                          <div className={isDelivered ? 'opacity-60' : ''}>
                            <p className={`font-bold text-sm ${isDelivered ? 'text-emerald-700 line-through' : isNext ? 'text-primary' : 'text-slate-700'}`}>{client.name}</p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-[180px] truncate">{client.address || "No address"}</p>
                          </div>
                          {isNext && (
                            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg shadow-sm flex items-center gap-1">
                              Pending
                            </span>
                          )}
                          {isDelivered && (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                              Done
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </Modal>

        {/* Reconciliation Modal */}
        <Modal
          isOpen={!!reconOpen}
          onClose={() => setReconOpen(null)}
          title="End of Day Recon"
          subtitle={`Vehicle: ${reconOpen}`}
          width="lg"
          actions={
            <Button variant="primary" onClick={async () => {
              const assignmentObj = realAssignments.find(a => realVehicles.find(v => v.id === a.vehicle_id)?.plate_number === reconOpen);
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
                  getAssignments().then(setRealAssignments).catch(console.error);
                } catch (e) {
                  console.error("Failed to complete assignment", e);
                }
              }
              setReconOpen(null);
            }} fullWidth>
              Confirm & Close Route
            </Button>
          }
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
              (assignmentObj as any).deliveries?.forEach((d: any) => totalCash += d.total_amount || 0);

              return (
                <>
                  {stats.map((stat, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-2xl p-6 border border-gray-200 mb-6 shadow-sm">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                        <span className="font-bold text-slate-700">Stock Dispatched ({stat.name})</span>
                        <span className="font-black text-slate-800 text-lg">{stat.allocated}</span>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-emerald-700 font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Full Delivered</span>
                          <span className="font-bold text-slate-800 text-lg">{stat.delivered}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-blue-700 font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Empty Collected</span>
                          <span className="font-bold text-slate-800 text-lg">{stat.empty}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-3 border-t border-gray-200">
                          <span className="text-amber-600 font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Full Returned (Unsold)</span>
                          <span className="font-bold text-slate-800 text-lg">{stat.returned}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-between p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <span className="font-bold text-emerald-800 text-lg">Total Cash Collected</span>
                    <span className="text-3xl font-black text-emerald-700">₹{totalCash}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>

        {/* Dispatch Confirm Modal */}
        <Modal
          isOpen={!!dispatchConfirmOpen}
          onClose={() => setDispatchConfirmOpen(null)}
          title="Confirm Dispatch"
          width="sm"
          actions={
            <div className="flex gap-4 w-full">
              <Button variant="secondary" onClick={() => setDispatchConfirmOpen(null)} fullWidth>Cancel</Button>
              <Button variant="primary" onClick={async () => {
                if (dispatchConfirmOpen) {
                  try {
                    await updateAssignment(dispatchConfirmOpen.id, { status: "ACTIVE" });
                    getAssignments().then(setRealAssignments).catch(console.error);
                  } catch (e) {
                    console.error("Failed to dispatch", e);
                  }
                  setDispatchConfirmOpen(null);
                }
              }} fullWidth>
                Confirm
              </Button>
            </div>
          }
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Dispatch Route</h3>
            <p className="text-slate-600 font-medium text-base">
              Are you sure you want to dispatch this route? The assigned driver will immediately receive the delivery details on their device.
            </p>
          </div>
        </Modal>
      </main>
    </div>
  );
}

function AssignmentCard({ id, vehicle, driver, helper, route, stock, status, progress, date, onAssign, onTrack, onRecon, onDelete }: any) {
  const isCompleted = status === "completed";
  const isPending = status === "pending";

  return (
    <div className={`bg-white p-6 rounded-2xl border shadow-sm relative ${isCompleted ? 'border-emerald-200 bg-emerald-50/20' : 'border-black/5'}`}>
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          title="Delete Assignment"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      <div className="flex justify-between items-start mb-4 pr-8">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPending ? 'bg-gray-100 text-gray-400' : 'bg-primary/10 text-primary'}`}>
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-text flex items-center gap-2">
              {vehicle}
            </h3>
            <div className="flex gap-2 items-center">
              <p className={`text-xs font-semibold uppercase tracking-wider ${isCompleted ? 'text-emerald-600' : isPending ? 'text-gray-400' : 'text-blue-600'}`}>
                {status}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Crew</span>
          <div className="text-right">
            <span className="font-medium text-text block">{driver} (Driver)</span>
            {helper && <span className="font-medium text-text-muted block text-xs mt-0.5">{helper} (Helper)</span>}
          </div>
        </div>
        <div className="flex justify-between text-sm border-t border-gray-100 pt-3 pb-3">
          <span className="text-text-muted flex items-center gap-1"><MapPin className="w-4 h-4" /> Route</span>
          <span className="font-medium text-text">{route}</span>
        </div>
        {date && (
          <div className="flex justify-between text-sm border-t border-gray-100 pt-3 pb-3">
            <span className="text-text-muted flex items-center gap-1"><Calendar className="w-4 h-4" /> Date</span>
            <span className="font-medium text-text">
              {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        )}
        <div className="border-t border-gray-100 pt-3">
          <span className="text-text-muted text-xs font-bold uppercase tracking-wider block mb-2">Allocated Stock</span>
          <div className="flex flex-wrap gap-1.5">
            {stock !== 'No stock' ? stock.split(', ').map((s: string, i: number) => (
              <span key={i} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                {s}
              </span>
            )) : (
              <span className="text-sm font-medium text-text-muted">No stock</span>
            )}
          </div>
        </div>
      </div>

      {!isPending && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1 font-medium">
            <span className="text-text-muted">Route Progress</span>
            <span className={isCompleted ? 'text-emerald-600' : 'text-primary'}>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {isPending ? (
        <Button variant="outline" fullWidth onClick={onAssign}>
          Dispatch Route
        </Button>
      ) : isCompleted ? (
        <Button variant="outline" fullWidth onClick={onRecon}>
          View Reconciliation
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onTrack}>
            Track Live
          </Button>
          <Button variant="outline" className="flex-1" onClick={onRecon}>
            Close Route
          </Button>
        </div>
      )}
    </div>
  );
}
