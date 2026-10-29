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
  RotateCcw,
  Edit3,
  QrCode,
  Receipt,
  Check,
  ShieldCheck,
  Printer,
  ArrowRight,
  ExternalLink,
  FileText,
  Fuel
} from "lucide-react";
import QRCode from "qrcode";
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
  reopenAssignment,
  getPendingDoorstepDeliveries,
  verifyDoorstepDelivery,
  deleteDelivery,
  Delivery,
  getSettings,
  getAllExpenses,
  deleteTripExpense,
  getExpensesForAssignment,
  TripExpense
} from "@/lib/api";
import { ThermalReceiptModal, ReceiptData } from "@/components/ThermalReceiptModal";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

const getAssignmentDateStr = (dateVal: string | Date | undefined | null): string => {
  if (!dateVal) return "";
  if (typeof dateVal === "string") {
    if (dateVal.includes("Z") || dateVal.includes("+")) {
      const d = new Date(dateVal);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return dateVal.slice(0, 10);
  }
  const d = dateVal;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
  const [startDate, setStartDate] = useState(() => getAssignmentDateStr(new Date()));
  const [endDate, setEndDate] = useState(() => getAssignmentDateStr(new Date()));
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real data from backend
  const [realStaff, setRealStaff] = useState<User[]>([]);
  const [realRoutes, setRealRoutes] = useState<Route[]>([]);
  const [realClients, setRealClients] = useState<Client[]>([]);
  const [realVehicles, setRealVehicles] = useState<Vehicle[]>([]);
  const [realAssignments, setRealAssignments] = useState<ApiAssignment[]>([]);
  const [inventoryTypes, setInventoryTypes] = useState<any[]>([]);

  // Doorstep Slip QR & Account Verification states
  // Views: Route Assignments vs Doorstep Slip QRs vs Trip Expenses
  const [activeView, setActiveView] = useState<"assignments" | "doorstep" | "expenses">("assignments");
  const [doorstepDeliveries, setDoorstepDeliveries] = useState<Delivery[]>([]);
  const [selectedDoorstepDelivery, setSelectedDoorstepDelivery] = useState<Delivery | null>(null);
  const [doorstepFilter, setDoorstepFilter] = useState<"ALL" | "PENDING" | "CREDITED" | "COMPLETED">("PENDING");
  const [doorstepSearch, setDoorstepSearch] = useState("");
  const [verifyAmount, setVerifyAmount] = useState<number | string>("");
  const [verifyUpiRef, setVerifyUpiRef] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [modalQrUrl, setModalQrUrl] = useState<string>("");
  const [systemSettings, setSystemSettings] = useState<any>({});
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptModalData, setReceiptModalData] = useState<ReceiptData | null>(null);

  // Trip Expenses States
  const [allTripExpenses, setAllTripExpenses] = useState<TripExpense[]>([]);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("ALL");
  const [expenseSearch, setExpenseSearch] = useState<string>("");
  const [reconExpenses, setReconExpenses] = useState<TripExpense[]>([]);
  const [trackExpenses, setTrackExpenses] = useState<TripExpense[]>([]);
  const [isDeletingExpense, setIsDeletingExpense] = useState<string | null>(null);

  useEffect(() => {
    if (reconOpen) {
      getExpensesForAssignment(reconOpen)
        .then(setReconExpenses)
        .catch(() => setReconExpenses([]));
    } else {
      setReconExpenses([]);
    }
  }, [reconOpen]);

  useEffect(() => {
    if (trackOpen) {
      getExpensesForAssignment(trackOpen)
        .then(setTrackExpenses)
        .catch(() => setTrackExpenses([]));
    } else {
      setTrackExpenses([]);
    }
  }, [trackOpen]);

  const handleDeleteExpense = async (expenseId: string, desc: string) => {
    if (!window.confirm(`Delete expense record (${desc})?`)) return;
    setIsDeletingExpense(expenseId);
    try {
      await deleteTripExpense(expenseId);
      toast.success("Trip expense deleted successfully");
      const updated = await getAllExpenses();
      setAllTripExpenses(updated || []);
      if (reconOpen) {
        const rUpdated = await getExpensesForAssignment(reconOpen);
        setReconExpenses(rUpdated || []);
      }
      if (trackOpen) {
        const tUpdated = await getExpensesForAssignment(trackOpen);
        setTrackExpenses(tUpdated || []);
      }
    } catch (err: any) {
      console.error("Failed to delete expense:", err);
      toast.error(err.message || "Failed to delete expense");
    } finally {
      setIsDeletingExpense(null);
    }
  };

  useEffect(() => {
    fetchRealData();

    // Smart background poll every 20 seconds only when tab is active and visible
    let isPolling = false;
    const interval = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (isPolling) return;
      isPolling = true;
      try {
        const [aData, dData, eData] = await Promise.all([
          getAssignments().catch(() => null),
          getPendingDoorstepDeliveries(true).catch(() => null),
          getAllExpenses().catch(() => null)
        ]);
        if (aData) setRealAssignments(aData);
        if (dData) setDoorstepDeliveries(dData);
        if (eData) setAllTripExpenses(eData);
      } catch (err) {
        console.warn("Deliveries background poll error:", err);
      } finally {
        isPolling = false;
      }
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const fetchRealData = async () => {
    try {
      setIsRefreshing(true);
      const [staffData, routesData, clientsData, vehiclesData, assignmentsData, invData, pendingData, settingsData, expensesData] = await Promise.all([
        getUsers(),
        getRoutes(),
        getClients(),
        getVehicles(),
        getAssignments(),
        getInventoryTypes(),
        getPendingDoorstepDeliveries(true).catch(() => []),
        getSettings().catch(() => ({})),
        getAllExpenses().catch(() => [])
      ]);
      setRealStaff(staffData || []);
      setRealRoutes(routesData || []);
      setRealClients(clientsData || []);
      setRealVehicles(vehiclesData || []);
      setRealAssignments(assignmentsData || []);
      setInventoryTypes(invData || []);
      setDoorstepDeliveries(pendingData || []);
      setSystemSettings(settingsData || {});
      setAllTripExpenses(expensesData || []);
    } catch (error) {
      console.error("Failed to fetch real data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenDoorstepModal = (d: Delivery) => {
    const client = realClients.find(c => c.id === d.client_id);
    const clientCredit = Number(client?.credit_amount) || 0;
    const unpaidDelivery = Math.max(0, Number(d.total_amount || 0) - Number(d.paid_amount || 0));
    const defaultAmt = unpaidDelivery > 0 ? unpaidDelivery : (clientCredit > 0 ? clientCredit : d.total_amount);

    setSelectedDoorstepDelivery(d);
    setVerifyAmount(defaultAmt);
    setVerifyUpiRef(d.upi_reference || "");
    setVerifyNotes(d.notes || "");

    // Generate scannable dynamic UPI QR for this delivery
    const note = encodeURIComponent(`Bill-${d.id.slice(0, 6)} - ${client?.name || "Client"}`);
    const upiId = systemSettings.upi_id || "flyera@okhdfcbank";
    const company = encodeURIComponent(systemSettings.company_name || "Flyera Logistics");
    const upiUri = `upi://pay?pa=${upiId}&pn=${company}&am=${(defaultAmt || d.total_amount).toFixed(2)}&tn=${note}&cu=INR`;

    QRCode.toDataURL(upiUri, { width: 220, margin: 1 })
      .then(setModalQrUrl)
      .catch(err => console.error("QR error", err));
  };

  const handleVerifyPayment = async () => {
    if (!selectedDoorstepDelivery) return;
    const amt = Number(verifyAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid credited amount");
      return;
    }
    if (!verifyUpiRef.trim()) {
      toast.error("Please enter UPI reference / UTR number from bank statement");
      return;
    }

    setIsVerifying(true);
    try {
      const res = await verifyDoorstepDelivery(selectedDoorstepDelivery.id, {
        action: "VERIFY_PAID",
        amount_paid: amt,
        upi_reference: verifyUpiRef.trim(),
        notes: verifyNotes.trim() || undefined,
        payment_mode: "UPI"
      });
      if (res.status === "COMPLETED") {
        toast.success(`Payment verified! ₹${amt} credited. Zero balance reached — delivery marked COMPLETED!`);
      } else {
        toast.success(`Partial payment verified! ₹${amt} credited via UPI to vehicle shift. Balance updated.`);
      }
      setSelectedDoorstepDelivery(null);
      await fetchRealData();
    } catch (err: any) {
      console.error("Verification failed", err);
      toast.error(err.message || "Failed to verify delivery payment");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleMarkCredited = async () => {
    if (!selectedDoorstepDelivery) return;
    setIsVerifying(true);
    try {
      await verifyDoorstepDelivery(selectedDoorstepDelivery.id, {
        action: "MARK_CREDITED",
        notes: verifyNotes.trim() || undefined
      });
      toast.success("Delivery confirmed as unpaid credit on customer ledger.");
      setSelectedDoorstepDelivery(null);
      await fetchRealData();
    } catch (err: any) {
      console.error("Failed to mark credited", err);
      toast.error(err.message || "Failed to confirm credit");
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePrintSlipForDelivery = (d: Delivery) => {
    const client = realClients.find(c => c.id === d.client_id);
    const assignment = realAssignments.find(a => a.id === d.assignment_id);
    const driver = realStaff.find(s => s.id === assignment?.driver_id);
    const vehicle = realVehicles.find(v => v.id === assignment?.vehicle_id);
    const route = realRoutes.find(r => r.id === assignment?.route_id);

    const itemsPayload = (d.items || []).map(item => {
      const inv = inventoryTypes.find(i => i.id === item.inventory_type_id);
      return {
        name: inv?.name || "20L Mineral Jar",
        qty: item.delivered_full,
        rate: item.price_charged,
        amount: item.delivered_full * item.price_charged
      };
    });

    const emptyCount = (d.items || []).reduce((sum, item) => sum + (item.collected_empty || 0), 0);
    const prevCredit = Number(client?.credit_amount) || 0;

    setReceiptModalData({
      receiptNo: `FL-${d.id.slice(0, 6).toUpperCase()}`,
      date: new Date(d.created_at).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }),
      companyName: systemSettings.company_name || "Flyera - Water & Glass Logistics",
      gstin: systemSettings.gstin || "GSTIN-27AAACH7409R1ZZ",
      hotline: systemSettings.dispatch_hotline || "+91 98765 43210",
      address: systemSettings.central_address || "Plot 42, Hinjewadi Industrial Zone Phase 2, Pune",
      vehiclePlate: vehicle?.plate_number || "Van Delivery",
      routeName: route?.name || "Route Run",
      driverName: driver?.name || "Driver",
      clientName: client?.name || "Customer",
      clientPhone: client?.phone || "",
      clientAddress: client?.address || "",
      items: itemsPayload,
      emptyReturned: emptyCount,
      totalAmount: d.total_amount,
      previousCreditBalance: prevCredit,
      netDueAmount: prevCredit,
      paymentMethod: d.payment_method || "Pay Later (Slip QR)",
      paymentStatus: d.status === "COMPLETED" ? "PAID" : "PENDING",
      upiId: systemSettings.upi_id || "flyera@okhdfcbank"
    });
    setReceiptModalOpen(true);
  };

  const handleDeleteDoorstepDelivery = async (e: React.MouseEvent, deliveryId: string, clientName: string) => {
    e.stopPropagation();
    const isConfirmed = await confirm({
      title: "Delete Delivery Record",
      message: `Are you sure you want to delete this doorstep delivery record for "${clientName}"?`,
      confirmText: "Delete Record",
      cancelText: "Cancel"
    });
    if (isConfirmed) {
      try {
        await deleteDelivery(deliveryId);
        toast.success("Delivery record deleted");
        await fetchRealData();
        if (selectedDoorstepDelivery?.id === deliveryId) {
          setSelectedDoorstepDelivery(null);
        }
      } catch (err: any) {
        console.error("Failed to delete delivery", err);
        toast.error(err.message || "Failed to delete delivery record");
      }
    }
  };

  // Assign modal state
  const [assignDriver, setAssignDriver] = useState("");
  const [assignHelper, setAssignHelper] = useState("");
  const [assignRoute, setAssignRoute] = useState("");
  const [assignVehicle, setAssignVehicle] = useState("");
  const [assignPettyCash, setAssignPettyCash] = useState<string>("");
  const [assignStock, setAssignStock] = useState<Record<string, number>>({});

  // Edit modal state
  const [editAssignment, setEditAssignment] = useState<ApiAssignment | null>(null);
  const [editDriver, setEditDriver] = useState("");
  const [editHelper, setEditHelper] = useState("");
  const [editRoute, setEditRoute] = useState("");
  const [editVehicle, setEditVehicle] = useState("");
  const [editPettyCash, setEditPettyCash] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("PENDING");
  const [editDate, setEditDate] = useState<string>("");
  const [editStock, setEditStock] = useState<Record<string, number>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleOpenEdit = (assignment: ApiAssignment) => {
    setEditAssignment(assignment);
    setEditDriver(assignment.driver_id || "");
    setEditPettyCash(assignment.petty_cash ? String(assignment.petty_cash) : "");
    setEditHelper(assignment.helper_id || "");
    setEditRoute(assignment.route_id || "");
    setEditVehicle(assignment.vehicle_id || "");
    setEditStatus(assignment.status ? assignment.status.toUpperCase() : "PENDING");
    setEditDate(
      assignment.date
        ? getAssignmentDateStr(assignment.date)
        : getAssignmentDateStr(new Date())
    );

    const stockMap: Record<string, number> = {};
    if (assignment.allocations && assignment.allocations.length > 0) {
      assignment.allocations.forEach(al => {
        stockMap[al.inventory_type_id] = al.allocated_count || 0;
      });
    }
    setEditStock(stockMap);
  };

  const handleSaveEdit = async () => {
    if (!editAssignment) return;
    if (!editDriver || !editRoute || !editVehicle) {
      toast.error("Please select a driver, route, and vehicle.");
      return;
    }

    const allocations = Object.entries(editStock)
      .filter(([_, count]) => count > 0)
      .map(([invId, count]) => ({
        inventory_type_id: invId,
        allocated_count: count,
      }));

    try {
      setIsSavingEdit(true);
      await updateAssignment(editAssignment.id, {
        date: editDate ? new Date(editDate).toISOString() : undefined,
        vehicle_id: editVehicle,
        driver_id: editDriver,
        helper_id: editHelper || null,
        route_id: editRoute,
        status: editStatus,
        petty_cash: parseFloat(editPettyCash) || 0.0,
        allocations,
      });
      setEditAssignment(null);
      const refreshed = await getAssignments();
      setRealAssignments(refreshed);
      toast.success("Delivery route updated successfully!");
    } catch (e: any) {
      console.error("Failed to update assignment", e);
      toast.error(e?.message || "Failed to update assignment.");
    } finally {
      setIsSavingEdit(false);
    }
  };

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
        petty_cash: parseFloat(assignPettyCash) || 0.0,
        allocations
      });
      setModalOpen(false);
      setAssignDriver("");
      setAssignHelper("");
      setAssignRoute("");
      setAssignVehicle("");
      setAssignPettyCash("");
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
      } catch (e: any) {
        toast.error(e?.message || "Failed to delete assignment.");
        console.error(e);
      }
    }
  };

  // Filtered & Sorted assignments (Not completed on top, FIFO earliest first)
  const filteredAssignments = useMemo(() => {
    const list = realAssignments.filter(a => {
      const aDate = getAssignmentDateStr(a.date);
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

    // Sort: Uncompleted first (ACTIVE -> PENDING -> COMPLETED), then FIFO (earliest created_at / date first)
    return list.sort((a, b) => {
      const getStatusRank = (status: string) => {
        const s = (status || "").toUpperCase();
        if (s === "ACTIVE") return 0;
        if (s === "PENDING") return 1;
        return 2; // COMPLETED and others
      };

      const rankA = getStatusRank(a.status);
      const rankB = getStatusRank(b.status);
      if (rankA !== rankB) {
        return rankA - rankB; // Not completed on top
      }

      // FIFO order: earliest created first
      const timeA = new Date(a.created_at || a.date).getTime() || 0;
      const timeB = new Date(b.created_at || b.date).getTime() || 0;
      return timeA - timeB;
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
    const today = getAssignmentDateStr(new Date());
    return realAssignments.filter(a => {
      const aDate = getAssignmentDateStr(a.date);
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

  // Doorstep Slip QR Metrics and Memoized filter
  const pendingDoorstepCount = useMemo(() => {
    return doorstepDeliveries.filter(d => {
      const c = realClients.find(cl => cl.id === d.client_id);
      return d.status !== "COMPLETED" || (c?.credit_amount || 0) > 0;
    }).length;
  }, [doorstepDeliveries, realClients]);

  const totalDoorstepPendingAmount = useMemo(() => {
    return doorstepDeliveries
      .filter(d => {
        const c = realClients.find(cl => cl.id === d.client_id);
        return d.status !== "COMPLETED" || (c?.credit_amount || 0) > 0;
      })
      .reduce((sum, d) => {
        const c = realClients.find(cl => cl.id === d.client_id);
        const unpaid = Math.max(0, (d.total_amount || 0) - (d.paid_amount || 0));
        return sum + (unpaid > 0 ? unpaid : (c?.credit_amount || 0));
      }, 0);
  }, [doorstepDeliveries, realClients]);

  const filteredDoorstepDeliveries = useMemo(() => {
    return doorstepDeliveries.filter(d => {
      const client = realClients.find(c => c.id === d.client_id);
      const assignment = realAssignments.find(a => a.id === d.assignment_id);
      const driver = realStaff.find(s => s.id === assignment?.driver_id);
      const vehicle = realVehicles.find(v => v.id === assignment?.vehicle_id);

      const clientCredit = Number(client?.credit_amount) || 0;
      const deliveryDue = Math.max(0, (d.total_amount || 0) - (d.paid_amount || 0));
      const isSettled = d.status === "COMPLETED" && clientCredit <= 0 && deliveryDue <= 0;

      if (doorstepFilter === "PENDING") {
        if (isSettled || d.status === "CREDITED") return false;
      } else if (doorstepFilter === "CREDITED") {
        if (d.status !== "CREDITED" && d.status !== "PARTIAL_PAID") return false;
      } else if (doorstepFilter === "COMPLETED") {
        if (!isSettled) return false;
      }

      if (doorstepSearch.trim()) {
        const q = doorstepSearch.toLowerCase().trim();
        const clientMatch = (client?.name || "").toLowerCase().includes(q) || (client?.phone || "").includes(q);
        const driverMatch = (driver?.name || "").toLowerCase().includes(q);
        const vehicleMatch = (vehicle?.plate_number || "").toLowerCase().includes(q);
        const upiMatch = (d.upi_reference || "").toLowerCase().includes(q);
        return clientMatch || driverMatch || vehicleMatch || upiMatch;
      }

      return true;
    });
  }, [doorstepDeliveries, doorstepFilter, doorstepSearch, realClients, realAssignments, realStaff, realVehicles]);

  // Trip Expenses Memoized Aggregations
  const totalTripExpensesAmount = useMemo(() => {
    return allTripExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [allTripExpenses]);

  const fuelTripExpensesAmount = useMemo(() => {
    return allTripExpenses.filter(e => e.category === "FUEL").reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [allTripExpenses]);

  const tollTripExpensesAmount = useMemo(() => {
    return allTripExpenses.filter(e => e.category === "TOLL").reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [allTripExpenses]);

  const otherTripExpensesAmount = useMemo(() => {
    return allTripExpenses.filter(e => e.category !== "FUEL" && e.category !== "TOLL").reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [allTripExpenses]);

  const filteredTripExpenses = useMemo(() => {
    return allTripExpenses.filter(e => {
      if (expenseCategoryFilter !== "ALL" && e.category !== expenseCategoryFilter) return false;
      if (expenseSearch.trim()) {
        const q = expenseSearch.toLowerCase().trim();
        const assignment = realAssignments.find(a => a.id === e.assignment_id);
        const vehicle = realVehicles.find(v => v.id === assignment?.vehicle_id);
        const driver = realStaff.find(s => s.id === assignment?.driver_id);
        const matchVehicle = (vehicle?.plate_number || "").toLowerCase().includes(q);
        const matchDriver = (driver?.name || e.reporter_name || "").toLowerCase().includes(q);
        const matchDesc = (e.description || "").toLowerCase().includes(q);
        const matchCat = (e.category || "").toLowerCase().includes(q);
        return matchVehicle || matchDriver || matchDesc || matchCat;
      }
      return true;
    });
  }, [allTripExpenses, expenseCategoryFilter, expenseSearch, realAssignments, realVehicles, realStaff]);

  return (
    <div className="flex min-h-screen bg-[#FDFBF7]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 lg:p-10 pt-20 md:pt-8 pb-24 md:pb-12 transition-all relative">
        {/* Standardized Frosted Page Header */}
        <PageHeader
          title="Deliveries & Dispatch"
          subtitle="Real-time route assignments, fleet vehicle dispatch, doorstep QR slips & account verification"
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

        {/* Top KPI Stat Cards - 3 Core Shift Drivers (Reduces Mobile Scrolling) */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 md:gap-5 mb-4 sm:mb-6">
          <StatCard
            label="Active On-Road"
            value={activeRoutesCount}
            subtext="Live delivery routes"
            icon={<Truck className="w-5 h-5 sm:w-6 sm:h-6" />}
            color="emerald"
            category="Live Fleet"
          />
          <StatCard
            label="Completed Today"
            value={completedTodayCount}
            subtext="Reconciled & closed"
            icon={<CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />}
            color="purple"
            category="Closed Routes"
          />
          <StatCard
            label="Collected Cash"
            value={`₹${totalRevenueCollected.toLocaleString()}`}
            subtext="Completed drops"
            icon={<IndianRupee className="w-5 h-5 sm:w-6 sm:h-6" />}
            color="blue"
            category="Revenue"
          />
        </div>

        {/* View Switcher: Route Dispatch vs Doorstep Slip QRs vs Trip Expenses */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5 sm:mb-6 bg-white/80 p-1.5 sm:p-2 rounded-2xl border border-slate-200/70 shadow-xs">
          <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveView("assignments")}
              className={`px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${activeView === "assignments"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
            >
              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">Routes</span>
                <span className="hidden sm:inline">Route Dispatch</span>
              </span>
              <span className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full font-black shrink-0 ${activeView === "assignments" ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"
                }`}>
                {filteredAssignments.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView("doorstep")}
              className={`px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 sm:gap-2 relative ${activeView === "doorstep"
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
            >
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">Doorstep</span>
                <span className="hidden sm:inline">Doorstep Bills</span>
              </span>
              {pendingDoorstepCount > 0 ? (
                <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black animate-pulse shrink-0">
                  <span className="sm:hidden">{pendingDoorstepCount}</span>
                  <span className="hidden sm:inline">{pendingDoorstepCount} Pending</span>
                </span>
              ) : (
                <span className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full font-black shrink-0 ${activeView === "doorstep" ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                  {doorstepDeliveries.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveView("expenses")}
              className={`px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 sm:gap-2 relative ${activeView === "expenses"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
            >
              <Fuel className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">Expenses</span>
                <span className="hidden sm:inline">Trip Expenses</span>
              </span>
              <span className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full font-black shrink-0 ${activeView === "expenses" ? "bg-amber-700 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                {allTripExpenses.length}
              </span>
            </button>
          </div>

          {activeView === "assignments" && pendingDoorstepCount > 0 && (
            <button
              onClick={() => setActiveView("doorstep")}
              className="text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/90 px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5 w-full sm:w-auto transition-all text-center"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-bounce shrink-0" />
              <span className="truncate">{pendingDoorstepCount} doorstep bills awaiting verification</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            </button>
          )}
        </div>

        {/* VIEW 1: ROUTE ASSIGNMENTS & DISPATCH */}
        {activeView === "assignments" && (
          <>
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${statusFilter === status
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
                      const today = getAssignmentDateStr(new Date());
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

                  const deliveriesCount = (a as any).deliveries_count ?? (a as any).deliveries?.length ?? 0;
                  const routeClientsCount = Math.max(realClients.filter(c => c.route_id === a.route_id).length, deliveriesCount, 1);
                  let progress = a.status === "COMPLETED"
                    ? 100
                    : (a.status === "ACTIVE"
                      ? Math.min(100, Math.round(deliveriesCount / routeClientsCount * 100))
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
                      pettyCash={a.petty_cash || 0}
                      onEdit={() => handleOpenEdit(a)}
                      onAssign={() => setDispatchConfirmOpen(a)}
                      onTrack={() => setTrackOpen(a.id)}
                      onRecon={() => setReconOpen(a.id)}
                      onDelete={() => handleDeleteAssignment(a.id)}
                      onReopen={() => handleReopenAssignment(a.id)}
                    />
                  );
                })
              )}
            </div>
          </>
        )}

        {/* VIEW 2: DOORSTEP BILLS & SLIP QR */}
        {activeView === "doorstep" && (
          <div className="space-y-6">
            {/* Doorstep Search & Status Filter Toolbar */}
            <div className="glass-panel p-4 md:p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by customer, phone, driver, vehicle, or UPI UTR reference..."
                    value={doorstepSearch}
                    onChange={e => setDoorstepSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                  {doorstepSearch && (
                    <button
                      onClick={() => setDoorstepSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Status Pills for Doorstep Bills */}
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 w-full sm:w-auto">
                  {(["PENDING", "ALL", "CREDITED", "COMPLETED"] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setDoorstepFilter(status)}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all text-center truncate ${doorstepFilter === status
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                        }`}
                    >
                      {status === "PENDING" ? (
                        <>
                          <span className="sm:hidden">Pending</span>
                          <span className="hidden sm:inline">Awaiting Verification</span>
                        </>
                      ) : status === "ALL" ? (
                        "All Bills"
                      ) : status === "CREDITED" ? (
                        <>
                          <span className="sm:hidden">Credit</span>
                          <span className="hidden sm:inline">Unpaid Credit</span>
                        </>
                      ) : (
                        <>
                          <span className="sm:hidden">Verified</span>
                          <span className="hidden sm:inline">Paid &amp; Verified</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Doorstep Bills Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredDoorstepDeliveries.length === 0 ? (
                <div className="col-span-full py-16 text-center glass-panel">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-600">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 mb-1">No Doorstep Deliveries Found</h3>
                  <p className="text-slate-500 font-medium text-sm max-w-md mx-auto mb-5">
                    {doorstepSearch || doorstepFilter !== "ALL"
                      ? "No doorstep bills match your current search or filter criteria."
                      : "When drivers leave water bottles at customers' doors and print 58mm QR slips, they appear here for bank account credit verification."}
                  </p>
                  {doorstepFilter !== "ALL" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDoorstepFilter("ALL");
                        setDoorstepSearch("");
                      }}
                    >
                      Show All Deliveries
                    </Button>
                  )}
                </div>
              ) : (
                filteredDoorstepDeliveries.map(d => {
                  const client = realClients.find(c => c.id === d.client_id);
                  const assignment = realAssignments.find(a => a.id === d.assignment_id);
                  const driver = realStaff.find(s => s.id === assignment?.driver_id);
                  const vehicle = realVehicles.find(v => v.id === assignment?.vehicle_id);
                  const route = realRoutes.find(r => r.id === assignment?.route_id);

                  return (
                    <DoorstepBillCard
                      key={d.id}
                      delivery={d}
                      client={client}
                      driver={driver}
                      vehicle={vehicle}
                      route={route}
                      inventoryTypes={inventoryTypes}
                      onVerifyClick={() => handleOpenDoorstepModal(d)}
                      onPrintSlip={() => handlePrintSlipForDelivery(d)}
                      onDelete={(e) => handleDeleteDoorstepDelivery(e, d.id, client?.name || "Customer")}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: TRIP EXPENSES & TRAVEL COSTS */}
        {activeView === "expenses" && (
          <div className="space-y-6">

            {/* Filter & Search Toolbar */}
            <div className="glass-panel p-4 md:p-5 rounded-2xl shadow-xs border border-slate-200/80">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by vehicle, driver or expense description..."
                    value={expenseSearch}
                    onChange={e => setExpenseSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 shadow-2xs"
                  />
                  {expenseSearch && (
                    <button
                      onClick={() => setExpenseSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {["ALL", "FUEL", "TOLL", "PARKING", "MAINTENANCE", "OTHER"].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setExpenseCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${expenseCategoryFilter === cat
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      {cat === "ALL" ? "All Expenses" : cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Expenses List / Table */}
            {filteredTripExpenses.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-3xl border border-slate-200/80">
                <Fuel className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-black text-slate-800">No Trip Expenses Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {expenseSearch || expenseCategoryFilter !== "ALL"
                    ? "No expense records match your current filter criteria."
                    : "Drivers and helpers can log on-road expenses directly from their mobile Co-Pilot app."}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/90 border-b border-slate-200 text-[10px] uppercase font-black tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date &amp; Time</th>
                        <th className="px-4 py-3">Vehicle &amp; Route</th>
                        <th className="px-4 py-3">Logged By</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {filteredTripExpenses.map(e => {
                        const assignment = realAssignments.find(a => a.id === e.assignment_id);
                        const vehicle = realVehicles.find(v => v.id === assignment?.vehicle_id);
                        const route = realRoutes.find(r => r.id === assignment?.route_id);
                        const driver = realStaff.find(s => s.id === assignment?.driver_id);

                        return (
                          <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                              {new Date(e.created_at).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-black text-slate-900 block">{vehicle?.plate_number || "Trip"}</span>
                              <span className="text-[11px] text-slate-500">{route?.name || "Route"}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-800">
                              {e.reporter_name || driver?.name || "Driver"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md ${e.category === "FUEL"
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : e.category === "TOLL"
                                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                                    : e.category === "MAINTENANCE"
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}>
                                {e.category === "FUEL" ? "⛽ FUEL" : e.category === "TOLL" ? "🛣️ TOLL" : e.category === "MAINTENANCE" ? "🔧 REPAIR" : e.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs">
                              <span className="font-bold text-slate-900 block truncate">{e.description || "On-route travel cost"}</span>
                              <span className="text-[10px]">
                                {e.paid_from_inhand ? (
                                  <span className="text-emerald-700 font-bold">₹{e.inhand_amount ?? e.amount} from In-Hand Petty Cash</span>
                                ) : (
                                  <span className="text-amber-700 font-bold">Personal (Reimbursable)</span>
                                )}
                                {(e.inhand_amount ?? 0) < e.amount && e.paid_from_inhand && (
                                  <span className="text-amber-700 font-medium ml-1">&bull; ₹{e.amount - (e.inhand_amount ?? 0)} personal</span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-black text-slate-900 text-sm">
                              <div>₹{e.amount}</div>
                              {e.paid_from_inhand && (
                                <span className="text-[10px] text-emerald-700 block font-bold">Cash: ₹{e.inhand_amount ?? e.amount}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(e.id, `${e.category} ₹${e.amount}`)}
                                disabled={isDeletingExpense === e.id}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all"
                                title="Delete expense entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

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

            {/* In-Hand Petty Cash to Driver */}
            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80">
              <label className="block text-xs font-black uppercase tracking-wider text-emerald-950 mb-1.5 flex items-center justify-between">
                <span>In-Hand Petty Cash (₹)</span>
                <span className="text-[10px] font-bold text-emerald-700 normal-case bg-emerald-100/90 px-2 py-0.5 rounded-md">Given to driver at morning departure</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-700 font-bold text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={assignPettyCash}
                  onChange={e => setAssignPettyCash(e.target.value)}
                  placeholder="e.g. 500.00"
                  className="w-full pl-8 pr-4 py-2.5 border border-emerald-300 rounded-xl bg-white text-slate-800 font-bold outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm shadow-2xs"
                />
              </div>
              <p className="text-[11px] font-medium text-emerald-800 mt-1.5">
                Starting physical cash given to driver for on-road fuel, toll, customer change, or trip emergencies.
              </p>
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

        {/* Edit Assignment Modal */}
        <Modal
          isOpen={!!editAssignment}
          onClose={() => setEditAssignment(null)}
          title="Edit Delivery Assignment"
          subtitle="Update driver, helper crew, assigned vehicle, route, and loaded cargo"
          width="2xl"
          actions={
            <div className="flex gap-4 w-full">
              <Button
                variant="secondary"
                onClick={() => setEditAssignment(null)}
                fullWidth
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveEdit}
                fullWidth
                disabled={isSavingEdit}
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Status & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Assignment Status
                </label>
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/70">
                  {(["PENDING", "ACTIVE", "COMPLETED"] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditStatus(st)}
                      className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${editStatus === st
                          ? st === "COMPLETED"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : st === "ACTIVE"
                              ? "bg-sky-600 text-white shadow-sm"
                              : "bg-amber-500 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Assignment Date
                </label>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full text-sm font-semibold text-slate-800 outline-none bg-transparent cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Driver & Helper */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Select Driver *
                </label>
                <select
                  value={editDriver}
                  onChange={e => setEditDriver(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>Choose Driver</option>
                  {realStaff.filter(s => s.role.toUpperCase() === "DRIVER").map(d => {
                    const isAssigned = realAssignments.some(
                      a => a.id !== editAssignment?.id && (a.driver_id === d.id || a.helper_id === d.id) && a.status !== "COMPLETED"
                    );
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
                  value={editHelper}
                  onChange={e => setEditHelper(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="">No Helper Assigned</option>
                  {realStaff.filter(s => s.role.toUpperCase() === "HELPER").map(d => {
                    const isAssigned = realAssignments.some(
                      a => a.id !== editAssignment?.id && (a.driver_id === d.id || a.helper_id === d.id) && a.status !== "COMPLETED"
                    );
                    return (
                      <option key={d.id} value={d.id} disabled={isAssigned}>
                        {d.name} {isAssigned ? "(Already assigned)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Vehicle & Route */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Select Vehicle *
                </label>
                <select
                  value={editVehicle}
                  onChange={e => setEditVehicle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>Choose Vehicle</option>
                  {realVehicles.map(v => {
                    const isAssigned = realAssignments.some(
                      a => a.id !== editAssignment?.id && a.vehicle_id === v.id && a.status !== "COMPLETED"
                    );
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
                  value={editRoute}
                  onChange={e => setEditRoute(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>Choose Route</option>
                  {realRoutes.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.area || "General Area"})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* In-Hand Petty Cash in Edit modal */}
            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80">
              <label className="block text-xs font-black uppercase tracking-wider text-emerald-950 mb-1.5 flex items-center justify-between">
                <span>In-Hand Petty Cash (₹)</span>
                <span className="text-[10px] font-bold text-emerald-700 normal-case bg-emerald-100/90 px-2 py-0.5 rounded-md">Given to driver at departure</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-700 font-bold text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editPettyCash}
                  onChange={e => setEditPettyCash(e.target.value)}
                  placeholder="e.g. 500.00"
                  className="w-full pl-8 pr-4 py-2.5 border border-emerald-300 rounded-xl bg-white text-slate-800 font-bold outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm shadow-2xs"
                />
              </div>
            </div>

            {/* Stock Allocation */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Update Cargo Stock Allocation
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
                          value={editStock[inv.id] ?? ""}
                          onChange={e => setEditStock(prev => ({ ...prev, [inv.id]: parseInt(e.target.value) || 0 }))}
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
          title={(() => {
            const activeAssignment = realAssignments.find(a => a.id === trackOpen);
            const vPlate = realVehicles.find(v => v.id === activeAssignment?.vehicle_id)?.plate_number;
            return `Vehicle: ${vPlate || "Vehicle"}`;
          })()}
          subtitle={
            (() => {
              const activeAssignment = realAssignments.find(a => a.id === trackOpen);
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
              const activeAssignment = realAssignments.find(a => a.id === trackOpen);
              const assignedRoute = realRoutes.find(r => r.id === activeAssignment?.route_id);
              const initialClients = assignedRoute ? realClients.filter(c => c.route_id === assignedRoute.id) : [];
              const deliveredClientIds = (activeAssignment as any)?.deliveries?.map((d: any) => d.client_id) || [];
              const extraClients = realClients.filter(c => deliveredClientIds.includes(c.id) && !initialClients.some(ic => ic.id === c.id));
              const routeClients = [...initialClients, ...extraClients];
              const deliveredCount = routeClients.filter(c => deliveredClientIds.includes(c.id)).length;
              const totalClients = Math.max(routeClients.length, deliveredClientIds.length, 1);
              const progressPercent = Math.min(100, Math.round((deliveredCount / totalClients) * 100));
              const nextClient = routeClients.find(c => !deliveredClientIds.includes(c.id));
              const isCompleted = deliveredCount >= totalClients && totalClients > 0;

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

                    {/* Running Trip Expenses & Net Margin */}
                    {trackExpenses.length > 0 && (
                      <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80 mb-6 flex items-center justify-between shadow-2xs">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1">
                            <Fuel className="w-3.5 h-3.5 text-amber-600" />
                            Trip Expenses ({trackExpenses.length} entries)
                          </span>
                          <span className="text-xs font-semibold text-slate-600">
                            {trackExpenses.map(e => `${e.category}: ₹${e.amount}`).join(" • ")}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Net Margin</span>
                          <span className="text-sm font-black text-emerald-700">
                            ₹{Math.max(0, totalEarned - trackExpenses.reduce((s, e) => s + (e.amount || 0), 0))}
                          </span>
                        </div>
                      </div>
                    )}

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
                  const activeAssignment = realAssignments.find(a => a.id === trackOpen);
                  const assignedRoute = realRoutes.find(r => r.id === activeAssignment?.route_id);
                  const initialClients = assignedRoute ? realClients.filter(c => c.route_id === assignedRoute.id) : [];
                  const deliveredClientIds = (activeAssignment as any)?.deliveries?.map((d: any) => d.client_id) || [];
                  const extraClients = realClients.filter(c => deliveredClientIds.includes(c.id) && !initialClients.some(ic => ic.id === c.id));
                  const routeClients = [...initialClients, ...extraClients];

                  if (routeClients.length === 0) {
                    return <p className="text-sm font-medium text-slate-400 p-4 text-center">No clients configured on this route.</p>;
                  }

                  return routeClients.map((client, idx) => {
                    const isDelivered = deliveredClientIds.includes(client.id);
                    const isNext = !isDelivered && (idx === 0 || deliveredClientIds.includes(routeClients[idx - 1]?.id));

                    return (
                      <div
                        key={client.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${isDelivered
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
          subtitle={(() => {
            const assignmentObj = realAssignments.find(a => a.id === reconOpen);
            const vPlate = realVehicles.find(v => v.id === assignmentObj?.vehicle_id)?.plate_number;
            return `Reconcile returns, empties & cash for ${vPlate || "Vehicle"}`;
          })()}
          width="lg"
          actions={(() => {
            const assignmentObj = realAssignments.find(a => a.id === reconOpen);
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
              const assignmentObj = realAssignments.find(a => a.id === reconOpen);
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
                const paid = Number(d.paid_amount) || 0;
                const total = Number(d.total_amount) || 0;
                const method = (d.payment_method || "").toLowerCase();
                const isSlipOrCredit = method.includes("slip") || method.includes("pay later") || method.includes("credit") || d.status === "PENDING_PAYMENT" || d.status === "CREDITED" || d.status === "PARTIAL_PAID";

                if (method.includes("cash")) {
                  totalCash += paid > 0 ? paid : (d.status === "COMPLETED" ? total : 0);
                } else if (method.includes("upi")) {
                  totalUpi += paid > 0 ? paid : (d.status === "COMPLETED" ? total : 0);
                }

                if (isSlipOrCredit) {
                  // Any uncollected portion remains pending slip
                  const unpaidPortion = Math.max(0, total - paid);
                  totalPendingSlip += unpaidPortion;
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
                      <span className="text-[10px] text-sky-600 font-bold block mt-0.5">Direct to bank &amp; verified slip transfers</span>
                    </div>

                    <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200/80 shadow-xs">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">Pending Slip QR</span>
                      <span className="text-2xl font-black text-amber-950">₹{totalPendingSlip.toLocaleString()}</span>
                      <span className="text-[10px] text-amber-600 font-bold block mt-0.5">Remaining uncollected slip credit</span>
                    </div>
                  </div>

                  {/* Trip Expenses & Petty Cash Deduction */}
                  {(() => {
                    const startingPettyCash = assignmentObj.petty_cash || 0;
                    const reconTotalExpenses = reconExpenses.reduce((s, e) => s + (e.amount || 0), 0);
                    const inhandCashSpent = reconExpenses.reduce((s, e) => s + (e.paid_from_inhand ? (e.inhand_amount ?? e.amount) : 0), 0);
                    const personalSpent = Math.max(0, reconTotalExpenses - inhandCashSpent);
                    const remainingPettyCash = Math.max(0, startingPettyCash - inhandCashSpent);
                    const netCashFromDriver = Math.max(0, (totalCash + remainingPettyCash) - personalSpent);
                    const netShiftProfit = (totalCash + totalUpi) - reconTotalExpenses;

                    return (
                      <div className="space-y-3 pt-1">
                        {/* Petty Cash & Expenses summary grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div className="bg-emerald-50/90 border border-emerald-200/90 p-3 rounded-xl">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">Morning In-Hand Cash</span>
                            <span className="text-lg font-black text-emerald-950">₹{startingPettyCash.toLocaleString()}</span>
                            <span className="text-[10px] text-emerald-600 font-semibold block">Petty cash given to driver</span>
                          </div>
                          <div className="bg-amber-50/90 border border-amber-200/90 p-3 rounded-xl">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">Cash Used by Driver</span>
                            <span className="text-lg font-black text-amber-950">− ₹{inhandCashSpent.toLocaleString()}</span>
                            <span className="text-[10px] text-amber-600 font-semibold block">From petty cash for trips</span>
                          </div>
                          <div className="bg-teal-50/90 border border-teal-200/90 p-3 rounded-xl">
                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 block">Petty Cash to Return</span>
                            <span className="text-lg font-black text-teal-950">₹{remainingPettyCash.toLocaleString()}</span>
                            <span className="text-[10px] text-teal-600 font-semibold block">Unspent in-hand cash</span>
                          </div>
                        </div>

                        <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200/80 shadow-xs space-y-2">
                          <div className="flex justify-between items-center pb-2 border-b border-amber-200/60">
                            <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                              <Fuel className="w-4 h-4 text-amber-600" />
                              Trip Expenses Logged ({reconExpenses.length})
                            </span>
                            <span className="text-base font-black text-amber-950">
                              {reconTotalExpenses > 0 ? `Total: ₹${reconTotalExpenses.toLocaleString()}` : "₹0"}
                            </span>
                          </div>

                          {reconExpenses.length > 0 ? (
                            <div className="space-y-1.5 text-xs">
                              {reconExpenses.map(exp => (
                                <div key={exp.id} className="flex justify-between items-center text-slate-700 bg-white/70 p-2 rounded-lg border border-amber-100">
                                  <div>
                                    <span className="font-bold text-slate-800">
                                      <strong className="text-amber-900 uppercase font-black mr-1">{exp.category}</strong>
                                      {exp.description ? `• ${exp.description}` : ""}
                                    </span>
                                    <div className="text-[10px] text-slate-500">
                                      {exp.paid_from_inhand ? (
                                        <span className="text-emerald-700 font-bold">₹{exp.inhand_amount ?? exp.amount} from In-Hand Cash</span>
                                      ) : (
                                        <span className="text-amber-700 font-bold">Personal Out-of-pocket</span>
                                      )}
                                      {(exp.inhand_amount ?? 0) < exp.amount && exp.paid_from_inhand && (
                                        <span className="text-amber-700 font-medium ml-1">&bull; ₹{exp.amount - (exp.inhand_amount ?? 0)} personal</span>
                                      )}
                                    </div>
                                  </div>
                                  <span className="font-black text-slate-900 text-sm">₹{exp.amount}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 font-medium">No on-road travel expenses logged by crew.</p>
                          )}
                        </div>

                        {/* Net Shift Reconciliation Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs font-bold text-slate-700 shadow-2xs">
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                                Net Cash from Driver
                              </span>
                              <span className="text-slate-500 text-[11px] font-medium">
                                (Customer Cash ₹{totalCash} + Returned Petty Cash ₹{remainingPettyCash}{personalSpent > 0 ? ` − Reimbursed ₹${personalSpent}` : ""})
                              </span>
                            </div>
                            <span className="text-xl font-black text-emerald-950">
                              ₹{netCashFromDriver.toLocaleString()}
                            </span>
                          </div>

                          <div className="p-3.5 bg-sky-50 rounded-2xl border border-sky-200 flex items-center justify-between text-xs font-bold text-slate-700 shadow-2xs">
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 block">
                                Net Shift Profit
                              </span>
                              <span className="text-slate-500 text-[11px] font-medium">(Gross Collections − All Expenses)</span>
                            </div>
                            <span className="text-xl font-black text-sky-950">
                              ₹{netShiftProfit.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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

        {/* Modal: Doorstep Slip QR Detailed Breakdown & Account Verification */}
        {selectedDoorstepDelivery && (() => {
          const client = realClients.find(c => c.id === selectedDoorstepDelivery.client_id);
          const assignment = realAssignments.find(a => a.id === selectedDoorstepDelivery.assignment_id);
          const driver = realStaff.find(s => s.id === assignment?.driver_id);
          const vehicle = realVehicles.find(v => v.id === assignment?.vehicle_id);
          const route = realRoutes.find(r => r.id === assignment?.route_id);
          const isPending = selectedDoorstepDelivery.status === "PENDING_PAYMENT" || selectedDoorstepDelivery.status === "PENDING" || selectedDoorstepDelivery.status === "PENDING_VERIFICATION";
          const isCredited = selectedDoorstepDelivery.status === "CREDITED";
          const isCompleted = selectedDoorstepDelivery.status === "COMPLETED";

          return (
            <Modal
              isOpen={!!selectedDoorstepDelivery}
              onClose={() => setSelectedDoorstepDelivery(null)}
              title="Doorstep Bill Breakdown & Account Verification"
              subtitle={`Slip Ref: FL-${selectedDoorstepDelivery.id.slice(0, 6).toUpperCase()} • Delivered on ${new Date(selectedDoorstepDelivery.created_at).toLocaleString("en-IN")}`}
              width="4xl"
              actions={
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedDoorstepDelivery(null)}
                    className="w-full sm:w-auto"
                  >
                    Close Window
                  </Button>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => handlePrintSlipForDelivery(selectedDoorstepDelivery)}
                      icon={<Printer className="w-4 h-4" />}
                      className="flex-1 sm:flex-initial"
                    >
                      Print 58mm Slip
                    </Button>

                    {isPending && (
                      <Button
                        variant="secondary"
                        onClick={handleMarkCredited}
                        disabled={isVerifying}
                        icon={<Clock className="w-4 h-4 text-sky-600" />}
                        className="flex-1 sm:flex-initial border-sky-300 text-sky-800 hover:bg-sky-50"
                      >
                        Confirm as Unpaid Credit
                      </Button>
                    )}

                    <Button
                      variant="primary"
                      onClick={handleVerifyPayment}
                      disabled={isVerifying}
                      icon={<ShieldCheck className="w-4 h-4" />}
                      className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 shadow-md font-black"
                    >
                      {isVerifying ? "Verifying..." : "Verify & Mark as Paid (UPI)"}
                    </Button>
                  </div>
                </div>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Customer Details, Crew, and Items Breakdown */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Customer & Route Card */}
                  <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                          Customer Profile
                        </span>
                        <h4 className="font-black text-lg text-slate-900">{client?.name || "Customer Drop"}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span>{client?.phone || "No phone listed"}</span>
                        </div>
                      </div>
                      <span className="text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
                        {client?.tier || "Standard Tier"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex items-start gap-1.5 text-xs text-slate-600 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{client?.address || "Address not specified"}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 font-semibold text-slate-600">
                      <span>Delivery Route:</span>
                      <span className="font-bold text-slate-800">{route?.name || "Route Zone"}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>Crew &amp; Van:</span>
                      <span className="font-bold text-slate-800">{driver?.name || "Driver"} • {vehicle?.plate_number || "Van"}</span>
                    </div>
                  </div>

                  {/* Delivered Items Breakdown Table */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-slate-500" />
                        Delivered Items Breakdown
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {selectedDoorstepDelivery.items?.length || 0} Products
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 text-xs">
                      {(selectedDoorstepDelivery.items || []).map((item, idx) => {
                        const inv = inventoryTypes.find(i => i.id === item.inventory_type_id);
                        return (
                          <div key={idx} className="p-3.5 flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-900 block">{inv?.name || "20L Mineral Jar"}</span>
                              <span className="text-[11px] text-slate-500">
                                {item.delivered_full} jar(s) delivered @ ₹{item.price_charged} each
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-slate-900 text-sm">
                                ₹{item.delivered_full * item.price_charged}
                              </span>
                              {item.collected_empty > 0 && (
                                <span className="block text-[10px] font-bold text-emerald-600">
                                  {item.collected_empty} empties returned
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Financials & Balance Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100/60 rounded-2xl border border-slate-200/80">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        Drop Amount
                      </span>
                      <span className="text-xl font-black text-slate-900 block mt-0.5">
                        ₹{selectedDoorstepDelivery.total_amount}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">
                        Total delivery invoice
                      </span>
                    </div>

                    <div className="p-3 bg-gradient-to-br from-emerald-50/70 to-teal-50/50 rounded-2xl border border-emerald-200/80">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                        Already Paid
                      </span>
                      <span className="text-xl font-black text-emerald-700 block mt-0.5">
                        ₹{(selectedDoorstepDelivery.paid_amount || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-medium text-emerald-600">
                        Credited via UPI/Cash
                      </span>
                    </div>

                    <div className="p-3 bg-gradient-to-br from-rose-50/60 to-amber-50/40 rounded-2xl border border-rose-200/80">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">
                        Ledger Dues
                      </span>
                      <span className="text-xl font-black text-rose-700 block mt-0.5">
                        ₹{(client?.credit_amount || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-medium text-rose-600">
                        Customer balance
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: QR Code & Bank Verification Form */}
                <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                  {/* Scannable Dynamic UPI QR Box */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 text-center shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-primary" />
                        Slip Payment QR Code
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 font-mono">
                        {systemSettings.upi_id || "flyera@okhdfcbank"}
                      </span>
                    </div>

                    {modalQrUrl ? (
                      <div className="p-2 border-2 border-dashed border-slate-200 rounded-xl inline-block bg-white my-1 shadow-2xs">
                        <img src={modalQrUrl} alt="UPI QR" className="w-40 h-40 mx-auto" />
                      </div>
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center bg-slate-50 rounded-xl mx-auto text-xs text-slate-400">
                        Generating QR...
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                      Printed on customer&apos;s 58mm slip for scanning via GPay, PhonePe, Paytm, or BHIM.
                    </p>
                  </div>

                  {/* Bank Account Verification Section */}
                  <div className="p-4 bg-gradient-to-br from-emerald-50/90 to-teal-50/60 rounded-2xl border-2 border-emerald-300 shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          Verify &amp; Add UPI Transfer
                        </h4>
                        <p className="text-[11px] text-slate-600 font-medium">
                          Match incoming transaction on your bank statement &amp; credit to vehicle
                        </p>
                      </div>
                    </div>

                    {/* Amount Credited Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                          Amount Credited in Account (₹) *
                        </label>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                          Credits to vehicle shift
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-sm text-slate-500">
                          ₹
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={verifyAmount}
                          onChange={e => setVerifyAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-black text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-2xs"
                        />
                      </div>

                      {/* Live Ledger Preview */}
                      {Number(verifyAmount) > 0 && (() => {
                        const currentCredit = client?.credit_amount || 0;
                        const paying = Number(verifyAmount) || 0;
                        const newBalance = Math.max(0, currentCredit - paying);
                        const deliveryDue = Math.max(0, (selectedDoorstepDelivery.total_amount || 0) - (selectedDoorstepDelivery.paid_amount || 0) - paying);
                        const willComplete = newBalance <= 0 && deliveryDue <= 0;

                        return (
                          <div className={`p-2.5 rounded-xl border text-xs mt-2 transition-all ${willComplete ? "bg-emerald-100/70 border-emerald-300 text-emerald-900" : "bg-amber-100/70 border-amber-300 text-amber-900"
                            }`}>
                            <div className="flex justify-between items-center font-bold">
                              <span>Customer Ledger Dues After Payment:</span>
                              <span className="font-black text-sm">₹{newBalance.toLocaleString()}</span>
                            </div>
                            <p className="text-[11px] font-semibold mt-0.5">
                              {willComplete
                                ? "✓ Zero balance reached! Delivery will turn to Paid & Verified."
                                : `⚡ Partial payment: Customer still carries ₹${newBalance} remaining dues. Status will remain Partially Paid.`}
                            </p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* UPI Reference / UTR Number Input */}
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                        UPI Reference / UTR Number *
                      </label>
                      <input
                        type="text"
                        value={verifyUpiRef}
                        onChange={e => setVerifyUpiRef(e.target.value)}
                        placeholder="e.g. 428901234567 (12-digit UTR)"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-xs outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-2xs"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Found in your GPay / PhonePe / Paytm / Bank SMS receipt.
                      </p>
                    </div>

                    {/* Verification Notes */}
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                        Verification Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={verifyNotes}
                        onChange={e => setVerifyNotes(e.target.value)}
                        placeholder="e.g. Received via GPay from customer"
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium text-xs outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Modal>
          );
        })()}

        {/* 58mm Thermal Slip Modal */}
        {receiptModalOpen && receiptModalData && (
          <ThermalReceiptModal
            isOpen={receiptModalOpen}
            onClose={() => setReceiptModalOpen(false)}
            mode="success_receipt"
            data={receiptModalData}
          />
        )}
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
  onEdit,
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
      className={`glass-card p-6 flex flex-col justify-between relative group transition-all duration-300 hover:shadow-md ${isCompleted
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
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${isActive
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
                  className={`w-2 h-2 rounded-full ${isActive ? "bg-sky-500 animate-pulse" : isCompleted ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                />
                <span
                  className={`text-xs font-black uppercase tracking-wider ${isActive ? "text-sky-700" : isCompleted ? "text-emerald-800" : "text-amber-800"
                    }`}
                >
                  {status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                title="Edit Assignment"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
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
                className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? "bg-emerald-500" : "bg-gradient-to-r from-sky-400 to-primary"
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

function DoorstepBillCard({
  delivery,
  client,
  driver,
  vehicle,
  route,
  inventoryTypes,
  onVerifyClick,
  onPrintSlip,
  onDelete
}: {
  delivery: Delivery;
  client?: Client;
  driver?: User;
  vehicle?: Vehicle;
  route?: Route;
  inventoryTypes: any[];
  onVerifyClick: () => void;
  onPrintSlip: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const clientCredit = Number(client?.credit_amount) || 0;
  const deliveryPaid = Number(delivery.paid_amount) || 0;
  const deliveryDue = Math.max(0, Number(delivery.total_amount || 0) - deliveryPaid);

  // STRICT ZERO-CREDIT COMPLETION RULE:
  // A delivery is only "COMPLETED" when the client's credit dues are 0 AND the delivery has no remaining unpaid balance!
  const isCompleted = delivery.status === "COMPLETED" && clientCredit <= 0 && deliveryDue <= 0;
  const isPartial = delivery.status === "PARTIAL_PAID" || (deliveryPaid > 0 && (clientCredit > 0 || deliveryDue > 0));
  const isCredited = delivery.status === "CREDITED" && !isPartial;
  const isPending = (delivery.status === "PENDING_PAYMENT" || delivery.status === "PENDING" || delivery.status === "PENDING_VERIFICATION") && !isPartial;

  const itemsSummary = (delivery.items || []).map(item => {
    const inv = inventoryTypes.find(i => i.id === item.inventory_type_id);
    return `${item.delivered_full}x ${inv?.name || "Can"}`;
  }).join(", ") || "Bottles delivered";

  const formattedDate = new Date(delivery.created_at).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });

  return (
    <div
      onClick={onVerifyClick}
      className={`glass-card p-5 sm:p-6 flex flex-col justify-between relative group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border ${isPending
          ? "border-rose-300/80 bg-gradient-to-br from-rose-50/30 via-white to-amber-50/20"
          : isPartial
            ? "border-amber-300/90 bg-gradient-to-br from-amber-50/40 via-white to-orange-50/20"
            : isCredited
              ? "border-sky-200/80 bg-sky-50/20"
              : "border-emerald-200/70 bg-emerald-50/15"
        }`}
    >
      <div>
        {/* Top Header */}
        <div className="flex justify-between items-start mb-3 gap-2">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xs ${isPending
                ? "bg-rose-500 text-white border-rose-400"
                : isPartial
                  ? "bg-amber-500 text-white border-amber-400"
                  : isCredited
                    ? "bg-sky-500 text-white border-sky-400"
                    : "bg-emerald-600 text-white border-emerald-500"
              }`}>
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-slate-900 tracking-tight group-hover:text-primary transition-colors">
                  {client?.name || "Customer Drop"}
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-semibold">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border flex items-center gap-1 shadow-2xs ${isCompleted
                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                : isPartial
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : isCredited
                    ? "bg-sky-100 text-sky-900 border-sky-300"
                    : "bg-rose-100 text-rose-900 border-rose-300 animate-pulse"
              }`}>
              {isCompleted && <Check className="w-3 h-3 text-emerald-600" />}
              {isPartial && <Clock className="w-3 h-3 text-amber-600" />}
              {isCredited && <Clock className="w-3 h-3 text-sky-600" />}
              {isPending && <AlertTriangle className="w-3 h-3 text-rose-600" />}
              <span>
                {isCompleted
                  ? "Paid & Verified"
                  : isPartial
                    ? `Partially Paid • Due ₹${clientCredit}`
                    : isCredited
                      ? `Unpaid Credit • Due ₹${clientCredit}`
                      : "Awaiting Verification"}
              </span>
            </span>

            <button
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
              title="Delete record"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Customer & Route Details */}
        <div className="space-y-2 py-3 border-y border-slate-200/60 my-3 text-xs sm:text-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span className="font-semibold flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone:
            </span>
            <span className="font-bold text-slate-900">{client?.phone || "No phone listed"}</span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span className="font-semibold flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-slate-400" /> Delivered By:
            </span>
            <span className="font-bold text-slate-900">
              {driver?.name || "Driver"} • {vehicle?.plate_number || "Van"}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span className="font-semibold flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-slate-400" /> Items:
            </span>
            <span className="font-bold text-slate-900 truncate max-w-[200px]" title={itemsSummary}>
              {itemsSummary}
            </span>
          </div>

          {/* Amount Due Box */}
          <div className="p-3 bg-white/90 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs mt-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Slip Drop Amount
              </span>
              <span className="text-xl font-black text-slate-900">
                ₹{delivery.total_amount}
              </span>
              {deliveryPaid > 0 && (
                <span className="block text-[10px] font-bold text-emerald-600">
                  Paid (UPI): ₹{deliveryPaid}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Customer Ledger Dues
              </span>
              <span className={`text-sm font-black ${clientCredit > 0 ? "text-rose-600" : "text-emerald-700"
                }`}>
                ₹{clientCredit.toLocaleString()}
              </span>
              {clientCredit === 0 && (
                <span className="block text-[10px] font-bold text-emerald-600">
                  Zero Balance
                </span>
              )}
            </div>
          </div>

          {delivery.upi_reference && (
            <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
              <span className="font-semibold text-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Bank UTR:
              </span>
              <span className="font-mono font-black text-emerald-900">{delivery.upi_reference}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="pt-1 flex gap-2">
        <Button
          variant={isCompleted ? "secondary" : "primary"}
          size="sm"
          className="flex-1 text-xs font-black shadow-xs"
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          onClick={(e) => {
            e.stopPropagation();
            onVerifyClick();
          }}
        >
          {isCompleted ? "View Breakdown" : "Verify Account Credit"}
        </Button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrintSlip();
          }}
          className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-2xs"
          title="Print 58mm Thermal Slip"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" />
          <span>Slip</span>
        </button>
      </div>
    </div>
  );
}
