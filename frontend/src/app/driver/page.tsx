"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/StoreContext";
import {
  getClients,
  Client as ApiClient,
  getAssignments,
  getRoutes,
  createDelivery,
  getInventoryTypes,
  getCurrentUser,
  getVehicles,
  createClient,
  updateClient,
  getSettings,
  getUsers,
  User as UserType,
  completeAssignment,
  reopenAssignment,
  revertDeliveryByClient
} from "@/lib/api";
import { ThermalReceiptModal, ReceiptData } from "@/components/ThermalReceiptModal";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "react-hot-toast";
import {
  MapPin,
  Phone,
  Package,
  CheckCircle2,
  IndianRupee,
  Minus,
  Plus,
  QrCode,
  AlertTriangle,
  Navigation,
  Route as RouteIcon,
  Truck,
  Sparkles,
  ArrowRight,
  Crosshair,
  RefreshCw,
  ExternalLink,
  Upload,
  User as UserIcon,
  Printer,
  Clock,
  Receipt,
  Flag,
  ShieldCheck,
  RotateCcw,
  LogOut
} from "lucide-react";

export default function DriverApp() {
  const { completeDelivery } = useStore();
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [activeClient, setActiveClient] = useState<string | null>(null);

  const [step, setStep] = useState(1); // 1: Delivery Details, 2: Payment

  // Maps inventory_type_id -> { full, empty, damaged }
  const [deliveryItems, setDeliveryItems] = useState<Record<string, { full: number; empty: number; damaged: number }>>({});
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>("");
  const [activeAllocations, setActiveAllocations] = useState<any[]>([]);

  const [initialStock, setInitialStock] = useState(0);
  const [currentStock, setCurrentStock] = useState(0);
  const [assignedRouteId, setAssignedRouteId] = useState<string | null>(null);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [inventoryTypes, setInventoryTypes] = useState<any[]>([]);

  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientTier, setNewClientTier] = useState("Standard");
  const [newClientOptIn, setNewClientOptIn] = useState(true);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>("Ready to acquire GPS");
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationMethod, setLocationMethod] = useState<"gps" | "link">("gps");
  const [locationInput, setLocationInput] = useState("");
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptModalMode, setReceiptModalMode] = useState<"qr_collect" | "success_receipt">("qr_collect");
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [systemSettings, setSystemSettings] = useState<any>({});
  const watchIdRef = useRef<number | null>(null);
  const bestAccuracyRef = useRef<number>(999999);

  const parseLocationText = (text: string) => {
    if (!text || !text.trim()) {
      toast.error("Please enter a Google Maps link or coordinates");
      return;
    }
    const trimmed = text.trim();

    const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const qMatch = trimmed.match(/[?&](?:q|destination|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const coordMatch = trimmed.match(/^(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)$/);

    let lat: number | null = null;
    let lng: number | null = null;

    if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
    } else if (qMatch) {
      lat = parseFloat(qMatch[1]);
      lng = parseFloat(qMatch[2]);
    } else if (coordMatch) {
      lat = parseFloat(coordMatch[1]);
      lng = parseFloat(coordMatch[2]);
    }

    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      setGpsLocation({ lat, lng });
      setGpsAccuracy(5);
      setGpsStatus("Coordinates loaded from location link");
      toast.success(`Coordinates loaded: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

      if (!newClientAddress) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.address) {
              const parts = [
                data.address.road || data.address.pedestrian,
                data.address.suburb || data.address.neighbourhood || data.address.residential,
                data.address.city || data.address.town || data.address.county
              ].filter(Boolean);
              const resolved = parts.join(", ") || data.display_name;
              if (resolved) {
                setNewClientAddress(resolved);
                toast.success("Street address auto-populated!");
              }
            }
          })
          .catch(() => { });
      }
    } else {
      toast.error("Could not parse coordinates. Please paste a valid Google Maps pin or lat/lng pair.");
    }
  };

  const handlePinCurrentLocationForClient = (clientId: string) => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported by device");
      return;
    }
    setIsUpdatingLocation(true);
    toast.loading("Acquiring GPS to pin client location...", { id: "pin-gps" });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          let addr = clientDetails?.address;
          if (!addr) {
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
              const data = await res.json();
              if (data?.display_name) addr = data.display_name;
            } catch (e) { }
          }

          await updateClient(clientId, {
            latitude,
            longitude,
            address: addr || undefined
          });

          setClients(prev => prev.map(c => c.id === clientId ? { ...c, latitude, longitude, address: addr || c.address } : c));
          toast.success("Client location pinned and saved!", { id: "pin-gps" });
        } catch (err) {
          console.error("Failed to update client location:", err);
          toast.error("Failed to save location.", { id: "pin-gps" });
        } finally {
          setIsUpdatingLocation(false);
        }
      },
      (err) => {
        setIsUpdatingLocation(false);
        toast.error("Could not acquire GPS. Please allow location permissions.", { id: "pin-gps" });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const [driverName, setDriverName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("flyera_user");
        if (cached) {
          const u = JSON.parse(cached);
          if (u.name) return u.name;
          if (u.username) return u.username;
        }
      } catch (e) { }
    }
    return "Driver";
  });
  const [helperName, setHelperName] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [vehicleDisplay, setVehicleDisplay] = useState("No Vehicle Assigned");
  const [routeDisplay, setRouteDisplay] = useState("Awaiting Dispatch");
  const [assignmentStatus, setAssignmentStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isReopeningRoute, setIsReopeningRoute] = useState<boolean>(false);
  const [lastCompletedSummary, setLastCompletedSummary] = useState<{
    id?: string;
    routeName: string;
    vehiclePlate: string;
    stopsCount: number;
    deliveredCount: number;
    completedAt?: string;
  } | null>(null);

  // Modal for driver/helper to reconcile & end route
  const [isEndRouteModalOpen, setIsEndRouteModalOpen] = useState(false);
  const [isSubmittingEndRoute, setIsSubmittingEndRoute] = useState(false);

  // Core assignment loader supporting both DRIVER and HELPER roles with live sync
  const fetchAssignmentData = async (showFeedback: boolean = false) => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const [assignments, allClients, allRoutes, invTypes, user, allVehicles, settings, allUsers] = await Promise.all([
        getAssignments().catch(() => []),
        getClients().catch(() => []),
        getRoutes().catch(() => []),
        getInventoryTypes().catch(() => []),
        getCurrentUser().catch(() => {
          try {
            const cached = localStorage.getItem("flyera_user");
            if (cached) return JSON.parse(cached);
          } catch (e) { }
          return null;
        }),
        getVehicles().catch(() => []),
        getSettings().catch(() => null),
        getUsers().catch(() => [])
      ]);

      setInventoryTypes(invTypes || []);
      if (settings) {
        setSystemSettings(settings);
        try { localStorage.setItem("flyera_system_settings", JSON.stringify(settings)); } catch (e) { }
      }

      let activeUser = user;
      if (activeUser) {
        setCurrentUser(activeUser);
        try { localStorage.setItem("flyera_user", JSON.stringify(activeUser)); } catch (e) { }
      }

      const currentUserId = activeUser?.id;
      const userRole = activeUser?.role;

      // Check if assignment is linked to current user as either Lead Driver OR Route Helper
      const isUserAssigned = (a: any) => {
        if (!currentUserId) return false;
        return a.driver_id === currentUserId || a.helper_id === currentUserId;
      };

      // 1. Check for ACTIVE assignment assigned to current user
      let active = (assignments as any[]).find((a: any) => a.status === "ACTIVE" && isUserAssigned(a));

      // 2. Check for PENDING assignment assigned to current user
      if (!active && currentUserId) {
        active = (assignments as any[]).find((a: any) => a.status === "PENDING" && isUserAssigned(a));
      }

      // 3. For ADMIN / Owner preview mode: if no direct assignment is linked to their ID, allow viewing active or pending runs
      if (!active && (userRole === "ADMIN" || !currentUserId)) {
        active = (assignments as any[]).find((a: any) => a.status === "ACTIVE") || (assignments as any[]).find((a: any) => a.status === "PENDING");
      }

      // STRICT LOGIC: If no ACTIVE or PENDING assignment exists, active MUST remain null!
      // Completed / closed routes are NEVER treated as active runs.
      if (active) {
        setAssignedRouteId(active.route_id);
        setActiveAssignmentId(active.id);
        setAssignmentStatus(active.status);

        // Resolve driver and helper display names
        const matchedDriver = (allUsers as any[]).find(u => u.id === active.driver_id);
        const matchedHelper = active.helper_id ? (allUsers as any[]).find(u => u.id === active.helper_id) : null;

        if (matchedDriver?.name) {
          setDriverName(matchedDriver.name);
        } else if (activeUser?.role === "DRIVER" && (activeUser.name || activeUser.username)) {
          setDriverName(activeUser.name || activeUser.username);
        } else {
          setDriverName("Lead Driver");
        }

        if (matchedHelper?.name) {
          setHelperName(matchedHelper.name);
        } else if (activeUser?.role === "HELPER" && (activeUser.name || activeUser.username)) {
          setHelperName(activeUser.name || activeUser.username);
        } else {
          setHelperName(null);
        }

        const matchedRoute = (allRoutes as any[]).find(r => r.id === active.route_id);
        const matchedVehicle = (allVehicles as any[]).find(v => v.id === active.vehicle_id);

        if (matchedRoute) setRouteDisplay(matchedRoute.name);
        if (matchedVehicle) setVehicleDisplay(matchedVehicle.plate_number);

        // Filter clients by assigned route
        const routeClients = (allClients as any[]).filter(c => c.route_id === active.route_id);
        const mappedClients = routeClients.map(c => {
          const delivery = (active as any).deliveries?.find((d: any) => d.client_id === c.id);
          if (delivery) {
            const bottles = delivery.items?.reduce((sum: number, item: any) => sum + (item.delivered_full || 0), 0) || 0;
            return { ...c, isCompleted: true, deliveredCount: bottles };
          }
          return c;
        });
        setClients(mappedClients);

        if (active.allocations && active.allocations.length > 0) {
          setActiveAllocations(active.allocations);
          const total = active.allocations.reduce((sum: number, alloc: any) => sum + alloc.allocated_count, 0);
          const totalDelivered = (active as any).deliveries?.reduce((sum: number, d: any) => sum + (d.items?.reduce((itemSum: number, item: any) => itemSum + (item.delivered_full || 0), 0) || 0), 0) || 0;
          setInitialStock(total);
          setCurrentStock(Math.max(0, total - totalDelivered));
        }

        if (showFeedback) {
          toast.success(`Active route synced: ${matchedRoute?.name || "Route"}`);
        }
      } else {
        // No active route: Transition to Standby
        const wasActiveBefore = assignmentStatus === "ACTIVE" || assignmentStatus === "PENDING";

        setAssignmentStatus("UNASSIGNED");
        setActiveAssignmentId(null);
        setAssignedRouteId(null);
        setClients([]);
        setInitialStock(0);
        setCurrentStock(0);
        setVehicleDisplay("No Vehicle Assigned");
        setRouteDisplay("Awaiting Dispatch");
        setActiveAllocations([]);

        // Still display current user's name
        if (activeUser?.name || activeUser?.username) {
          setDriverName(activeUser.name || activeUser.username);
        }

        // Look for recently completed assignment to display summary on standby
        const recentCompleted = (assignments as any[])
          .filter((a: any) => a.status === "COMPLETED" && (isUserAssigned(a) || userRole === "ADMIN"))
          .sort((a: any, b: any) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())[0];

        if (recentCompleted) {
          const r = (allRoutes as any[]).find(rt => rt.id === recentCompleted.route_id);
          const v = (allVehicles as any[]).find(vh => vh.id === recentCompleted.vehicle_id);
          const totalDelivered = (recentCompleted as any).deliveries?.reduce((sum: number, d: any) =>
            sum + (d.items?.reduce((itemSum: number, item: any) => itemSum + (item.delivered_full || 0), 0) || 0), 0) || 0;
          const stopsCount = (recentCompleted as any).deliveries?.length || 0;

          setLastCompletedSummary({
            id: recentCompleted.id,
            routeName: r?.name || "Completed Run",
            vehiclePlate: v?.plate_number || "Returned to Hub",
            stopsCount: stopsCount,
            deliveredCount: totalDelivered,
            completedAt: recentCompleted.date || "Today"
          });
        }

        if (wasActiveBefore) {
          toast("Route reconciled and closed. Vehicle returned to hub.", { icon: "🏁" });
        } else if (showFeedback) {
          toast("Checked: Still on standby. Waiting for dispatch to assign next vehicle.", { icon: "⏳" });
        }
      }
    } catch (err) {
      console.error("Failed to sync driver assignment data:", err);
      if (showFeedback) toast.error("Live sync failed. Check network connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchAssignmentData(false);

    // Auto-sync polling every 12s to detect remote route closure or newly assigned vehicle
    const intervalTimer = setInterval(() => {
      fetchAssignmentData(false);
    }, 12000);

    return () => clearInterval(intervalTimer);
  }, []);

  // End Route / Reconcile from Co-Pilot
  const handleConfirmEndRoute = async () => {
    if (!activeAssignmentId) return;
    setIsSubmittingEndRoute(true);

    try {
      const deliveredBottles = clients
        .filter(c => (c as any).isCompleted)
        .reduce((sum, c) => sum + ((c as any).deliveredCount || 0), 0);

      const returned_stock = (activeAllocations || []).map((alloc: any) => {
        const invId = alloc.inventory_type_id;
        const returnedFull = Math.max(0, alloc.allocated_count - deliveredBottles);
        return {
          inventory_type_id: invId,
          allocated_count: alloc.allocated_count,
          returned_full: returnedFull,
          returned_empty: 0
        };
      });

      await completeAssignment(activeAssignmentId, returned_stock);
      toast.success("Route ended & reconciled! Returned to hub standby.");
      setIsEndRouteModalOpen(false);
      await fetchAssignmentData(false);
    } catch (err: any) {
      console.error("Failed to complete assignment:", err);
      toast.error(err.message || "Failed to end route. Please try again.");
    } finally {
      setIsSubmittingEndRoute(false);
    }
  };

  const handleStartDelivery = (id: string) => {
    const target = clients.find(c => c.id === id);
    if ((target as any)?.isCompleted) {
      toast("This client delivery is already completed and recorded.", { icon: "✅" });
      return;
    }
    setActiveClient(id);
    setStep(1);
    setDeliveryItems({});
    if (activeAllocations.length > 0) {
      setSelectedInventoryId(activeAllocations[0].inventory_type_id);
    }
  };

  // Revert/Undo an individual completed client delivery on the current route
  const handleUndoDeliveryStop = async (e: React.MouseEvent, clientId: string, clientName: string, deliveredCount: number) => {
    e.stopPropagation();
    if (!window.confirm(`Revert delivery for ${clientName}? This will restore ${deliveredCount} jar(s) back to your van stock.`)) {
      return;
    }
    try {
      if (activeAssignmentId) {
        await revertDeliveryByClient(activeAssignmentId, clientId).catch(() => { });
      }
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, isCompleted: false, deliveredCount: 0 } as any : c));
      setCurrentStock(prev => prev + deliveredCount);
      if (activeClient === clientId) {
        setActiveClient(null);
      }
      toast.success(`Delivery for ${clientName} reverted to pending.`);
    } catch (err) {
      console.error("Failed to undo delivery", err);
      toast.error("Failed to revert delivery.");
    }
  };

  // Revert/Undo an entire route closure from Shift Standby
  const handleUndoRouteClosure = async () => {
    if (!lastCompletedSummary?.id) return;
    setIsReopeningRoute(true);
    try {
      await reopenAssignment(lastCompletedSummary.id);
      toast.success("Route reopened! Restoring active co-pilot run...");
      await fetchAssignmentData(false);
    } catch (err: any) {
      console.error("Failed to reopen route:", err);
      toast.error(err.message || "Failed to reopen route.");
    } finally {
      setIsReopeningRoute(false);
    }
  };

  const handlePayment = async (method: string, clearActive: boolean = true) => {
    if (activeClient) {
      const itemsPayload = Object.entries(deliveryItems)
        .filter(([_, counts]) => counts.full > 0 || counts.empty > 0)
        .map(([invId, counts]) => {
          const inv = inventoryTypes.find(i => i.id === invId);
          return {
            inventory_type_id: invId,
            delivered_full: counts.full,
            collected_empty: counts.empty,
            price_charged: getClientPrice(inv, clients.find(c => c.id === activeClient)?.tier)
          };
        });

      if (activeAssignmentId) {
        try {
          await createDelivery({
            assignment_id: activeAssignmentId,
            client_id: activeClient,
            total_amount: totalAmount,
            payment_method: method,
            status: method === "Skipped" ? "SKIPPED" : method.includes("Pay Later") ? "PENDING_PAYMENT" : "COMPLETED",
            items: itemsPayload
          });
        } catch (e) {
          console.error("Failed to sync delivery to backend", e);
        }
      } else {
        completeDelivery("mock_assignment_id", activeClient, itemsPayload[0]?.delivered_full || 0, totalAmount, method);
      }

      const totalFullDelivered = itemsPayload.reduce((sum, item) => sum + item.delivered_full, 0);

      setClients(prev => prev.map(c =>
        c.id === activeClient ? { ...c, isCompleted: true, deliveredCount: totalFullDelivered } as any : c
      ));

      setCurrentStock(prev => Math.max(0, prev - totalFullDelivered));
      toast.success("Delivery completed successfully!");
    }
    if (clearActive) {
      setActiveClient(null);
    }
  };

  const buildReceiptData = (method: string, paymentStatus: "PAID" | "PENDING" = "PAID"): ReceiptData => {
    const itemsPayload = Object.entries(deliveryItems)
      .filter(([_, counts]) => counts.full > 0 || counts.empty > 0)
      .map(([invId, counts]) => {
        const inv = inventoryTypes.find(i => i.id === invId);
        const rate = getClientPrice(inv, clientDetails?.tier);
        return {
          name: inv?.name || "20L Mineral Jar",
          qty: counts.full,
          rate: rate,
          amount: counts.full * rate
        };
      });

    const emptyCount = Object.values(deliveryItems).reduce((sum, it) => sum + it.empty, 0);

    return {
      receiptNo: `FL-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleString("en-IN", {
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
      vehiclePlate: vehicleDisplay,
      routeName: routeDisplay,
      driverName: driverName && driverName !== "Driver" ? driverName : (currentUser?.name || currentUser?.username || "Driver"),
      clientName: clientDetails?.name || "Customer",
      clientPhone: clientDetails?.phone || "",
      clientAddress: clientDetails?.address || "",
      items: itemsPayload,
      emptyReturned: emptyCount,
      totalAmount: totalAmount,
      previousCreditBalance: Number(clientDetails?.credit_amount) || 0,
      netDueAmount: (Number(clientDetails?.credit_amount) || 0) + totalAmount,
      paymentMethod: method,
      paymentStatus: paymentStatus,
      upiId: systemSettings.upi_id || "flyera@okhdfcbank"
    };
  };

  const handleSelectCash = async () => {
    const rData = buildReceiptData("Cash", "PAID");
    setReceiptData(rData);
    await handlePayment("Cash", false);
    setReceiptModalMode("success_receipt");
    setIsReceiptModalOpen(true);
  };

  const handleSelectUPI = () => {
    const rData = buildReceiptData("UPI / QR", "PAID");
    setReceiptData(rData);
    setReceiptModalMode("qr_collect");
    setIsReceiptModalOpen(true);
  };

  const handleSelectPayLaterSlip = async () => {
    const rData = buildReceiptData("Pay Later (Slip QR)", "PENDING");
    setReceiptData(rData);
    await handlePayment("Pay Later (Slip QR)", false);
    setReceiptModalMode("success_receipt");
    setIsReceiptModalOpen(true);
  };

  const startGpsAcquisition = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (!("geolocation" in navigator)) {
      setGpsStatus("Geolocation not supported by device");
      return;
    }

    setIsLocating(true);
    setGpsStatus("Locking GPS satellites (refining accuracy)...");
    bestAccuracyRef.current = 999999;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const roundedAcc = Math.round(accuracy);

        if (accuracy < bestAccuracyRef.current) {
          bestAccuracyRef.current = accuracy;
          setGpsLocation({ lat: latitude, lng: longitude });
          setGpsAccuracy(roundedAcc);

          if (accuracy <= 15) {
            setGpsStatus(`GPS Locked (±${roundedAcc}m High Precision)`);
          } else {
            setGpsStatus(`Refining fix: ±${roundedAcc}m (waiting for satellite lock...)`);
          }

          // Reverse geocode if address is currently blank
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.address) {
                const parts = [
                  data.address.road || data.address.pedestrian,
                  data.address.suburb || data.address.neighbourhood || data.address.residential,
                  data.address.city || data.address.town || data.address.county
                ].filter(Boolean);
                const resolved = parts.join(", ") || data.display_name;
                if (resolved) {
                  setNewClientAddress(prev => prev || resolved);
                }
              }
            })
            .catch(() => { });
        }

        // Tightly locked to within 10 meters: clear watch to save battery
        if (accuracy <= 10 && watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
          setIsLocating(false);
          setGpsStatus(`GPS Locked (±${roundedAcc}m High Precision)`);
        }
      },
      (error) => {
        console.warn("Geolocation watch error:", error);
        setIsLocating(false);
        if (error.code === 1) {
          setGpsStatus("Location permission denied. Please allow GPS access.");
        } else if (error.code === 3) {
          setGpsStatus("GPS acquisition timed out. Tap 'Refetch' to retry.");
        } else {
          setGpsStatus("Could not acquire accurate GPS. Tap 'Refetch'.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 25000,
        maximumAge: 0
      }
    );

    // Stop active watch after 12s if not already stopped
    setTimeout(() => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setIsLocating(false);
      }
    }, 12000);
  };

  useEffect(() => {
    if (isAddClientOpen) {
      setGpsLocation(null);
      setGpsAccuracy(null);
      startGpsAcquisition();
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setIsLocating(false);
      }
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isAddClientOpen]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !assignedRouteId) return;

    setIsAddingClient(true);

    try {
      const client = await createClient({
        name: newClientName,
        phone: newClientPhone,
        address: newClientAddress,
        route_id: assignedRouteId,
        tier: newClientTier,
        opt_in_loyalty: newClientOptIn,
        loyalty_points: 0,
        latitude: gpsLocation?.lat,
        longitude: gpsLocation?.lng
      });
      setClients(prev => [...prev, client]);
      setActiveClient(client.id);
      setIsAddClientOpen(false);
      setNewClientName("");
      setNewClientPhone("");
      setNewClientAddress("");
      setNewClientTier("Standard");
      setNewClientOptIn(true);
      setLocationInput("");
      setLocationMethod("gps");
      toast.success("Client added and saved to route!");
    } catch (err) {
      console.error("Failed to create client", err);
      toast.error("Failed to add client. Try again.");
    } finally {
      setIsAddingClient(false);
    }
  };

  const clientDetails = clients.find(c => c.id === activeClient);

  const handleCallClient = (e: React.MouseEvent, clientName: string, phone?: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    if (!phone || !phone.trim()) {
      toast.error(`No phone number listed for ${clientName}`);
      return;
    }

    // Clean phone number: strip spaces, dashes, parentheses, non-digit characters
    const cleanPhone = phone.replace(/[^0-9+*#]/g, "");

    if (!cleanPhone || cleanPhone.length < 3) {
      toast.error(`Invalid phone number format for ${clientName}`);
      return;
    }

    // Copy to clipboard for easy manual dial or tablets
    if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(cleanPhone).catch(() => { });
    }

    toast.success(`Opening dialer: ${cleanPhone}`);

    // Direct window location trigger to reliably launch device phone dialer
    window.location.href = `tel:${cleanPhone}`;
  };

  const getClientPrice = (inv: any, tier?: string) => {
    if (!inv) return 80;
    if (tier === "Wholesale") return inv.wholesale_price || 65;
    if (tier === "Premium") return inv.premium_price || 60;
    return inv.price || 80;
  };

  const totalAmount = Object.entries(deliveryItems).reduce((sum, [invId, counts]) => {
    const inv = inventoryTypes.find(i => i.id === invId);
    return sum + (counts.full * getClientPrice(inv, clientDetails?.tier));
  }, 0);
  const totalFullDelivered = Object.values(deliveryItems).reduce((sum, item) => sum + item.full, 0);

  const currentDelivery = deliveryItems[selectedInventoryId] || { full: 0, empty: 0, damaged: 0 };
  const updateCurrentDelivery = (field: "full" | "empty" | "damaged", value: number) => {
    setDeliveryItems(prev => ({
      ...prev,
      [selectedInventoryId]: {
        ...(prev[selectedInventoryId] || { full: 0, empty: 0, damaged: 0 }),
        [field]: value
      }
    }));
  };

  const handleSignOut = () => {
    if (window.confirm("Are you sure you want to sign out of the Driver app?")) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("flyera_user");
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-900 p-4 md:p-8 relative">
      {/* Mobile-Friendly Frosted Header */}
      <header className="glass-panel p-4 md:p-6 mb-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`w-2.5 h-2.5 rounded-full ${assignmentStatus === "ACTIVE"
                ? "bg-emerald-500 animate-pulse"
                : assignmentStatus === "PENDING"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-slate-400"
              }`} />
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
              {currentUser?.role === "HELPER" ? "Helper Co-Pilot" : "Driver Co-Pilot"}
            </h1>
            <span className="text-xs font-black uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-1 rounded-lg">
              Water Run
            </span>
            {assignmentStatus === "UNASSIGNED" ? (
              <span className="text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Clock className="w-3 h-3" /> Standby • Awaiting Route
              </span>
            ) : assignmentStatus === "PENDING" ? (
              <span className="text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg">
                Pending Dispatch
              </span>
            ) : (
              <span className="text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Route In Progress
              </span>
            )}
          </div>

          {/* Crew & Vehicle Assignment Bar */}
          <div className="text-xs sm:text-sm font-semibold text-slate-600 flex flex-wrap items-center gap-2 mt-1.5">
            {/* Logged in User with Role Badge */}
            <span className="font-black text-slate-900 bg-white/90 border border-slate-200/90 px-2.5 py-1 rounded-xl text-xs shadow-2xs flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-sky-600" />
              <span>{currentUser?.name || currentUser?.username || driverName}</span>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${currentUser?.role === "HELPER"
                  ? "bg-emerald-100 text-emerald-800"
                  : currentUser?.role === "ADMIN"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-sky-100 text-sky-800"
                }`}>
                {currentUser?.role === "HELPER" ? "Route Helper" : currentUser?.role === "ADMIN" ? "Admin" : "Lead Driver"}
              </span>
            </span>

            {/* Crew Team if Helper is assigned */}
            {helperName && (
              <>
                <span className="text-slate-400">•</span>
                <span className="font-bold text-slate-700 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5">
                  <span className="text-slate-400 text-[10px] uppercase font-black">Run Crew:</span>
                  <span>🚚 {driverName}</span>
                  <span className="text-slate-300">+</span>
                  <span>🤝 {helperName}</span>
                </span>
              </>
            )}

            <span className="text-slate-400">•</span>
            <span className="font-black text-slate-900 flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-slate-500" />
              {vehicleDisplay}
            </span>

            <span className="text-slate-400">•</span>
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <RouteIcon className="w-3.5 h-3.5 text-slate-500" />
              {routeDisplay}
            </span>
          </div>
        </div>

        {/* Action Controls & Stock Indicator */}
        <div className="flex items-center gap-2.5 self-stretch md:self-auto flex-wrap">
          {/* Live Sync button */}
          <button
            onClick={() => fetchAssignmentData(true)}
            disabled={isSyncing}
            title="Check latest route and vehicle assignment status"
            className="bg-white border border-slate-200 hover:border-slate-300 active:scale-95 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isSyncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isSyncing ? "Checking..." : "Live Sync"}</span>
          </button>

          {/* Van Stock (only when active route is present) */}
          {assignmentStatus !== "UNASSIGNED" && (
            <div className="bg-white/90 border border-slate-200/80 px-3.5 py-2 rounded-xl text-xs font-black shadow-xs flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-slate-800">
                Van Stock: <span className="text-primary text-sm font-black">{currentStock}</span>/{initialStock}
              </span>
            </div>
          )}

          {/* End Route / Complete Run button */}
          {assignmentStatus !== "UNASSIGNED" && activeAssignmentId && (
            <button
              onClick={() => setIsEndRouteModalOpen(true)}
              className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 px-3.5 py-2 rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Flag className="w-3.5 h-3.5 text-rose-600" />
              <span>End Route / Close Run</span>
            </button>
          )}



          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            title="Sign Out of Driver App"
            className="bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-600 active:scale-95 px-3 py-2 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: Standby Waiting Screen vs Active Route */}
      {assignmentStatus === "UNASSIGNED" ? (
        <div className="max-w-3xl mx-auto space-y-6 py-4">
          {/* Standby Hero Card */}
          <div className="glass-panel p-6 sm:p-10 text-center relative overflow-hidden border-sky-100 shadow-md">
            {/* Ambient background glows */}
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-sky-200/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />

            {/* Standby Beacon Icon */}
            <div className="relative mx-auto w-24 h-24 mb-5">
              <div className="absolute inset-0 bg-sky-500/10 rounded-full animate-ping opacity-60" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-sky-500/25">
                <Truck className="w-12 h-12 animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-xs font-black text-emerald-800 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Shift Standby • Route Reconciled</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mb-2">
              Waiting for New Vehicle &amp; Route Assignment
            </h2>
            <p className="text-slate-600 font-medium text-sm sm:text-base max-w-lg mx-auto mb-6 leading-relaxed">
              Your delivery run has been completed and returned to the hub. Please stand by while the dispatch office assigns your next vehicle, loaded inventory bottles, and delivery route.
            </p>

            {/* Live Auto-Checking Indicator */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 max-w-md mx-auto mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-left">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <div>
                  <p className="text-xs font-black text-slate-800">Auto-Sync Active</p>
                  <p className="text-[11px] font-semibold text-slate-500">Checking for new assignments every 12 seconds</p>
                </div>
              </div>
              <button
                onClick={() => fetchAssignmentData(true)}
                disabled={isSyncing}
                className="bg-primary hover:bg-sky-600 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Checking..." : "Check Now"}</span>
              </button>
            </div>

            {/* Crew Status Bar */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-slate-600 pt-3 border-t border-slate-100">
              <span className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                <UserIcon className="w-3.5 h-3.5 text-sky-600" />
                <span>Crew: {currentUser?.name || currentUser?.username || driverName}</span>
                <span className="text-[10px] text-slate-400">({currentUser?.role === "HELPER" ? "Route Helper" : "Lead Driver"})</span>
              </span>
              <span className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                <span>Van Inventory: Reconciled &amp; Returned to Hub</span>
              </span>
              {systemSettings.dispatch_hotline && (
                <a
                  href={`tel:${systemSettings.dispatch_hotline}`}
                  className="flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 px-3 py-1.5 rounded-xl transition-all"
                >
                  <Phone className="w-3.5 h-3.5 text-sky-600" />
                  <span>Call Dispatch ({systemSettings.dispatch_hotline})</span>
                </a>
              )}
            </div>
          </div>

          {/* Previous Run Summary Card (if available) */}
          {lastCompletedSummary && (
            <div className="glass-panel p-5 sm:p-6 border-slate-200/80 bg-white/70 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
                    Previous Run Completed &amp; Reconciled
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {lastCompletedSummary.completedAt || "Today"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Route Name</span>
                  <span className="text-sm font-black text-slate-800 truncate block mt-0.5">
                    {lastCompletedSummary.routeName}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Vehicle Used</span>
                  <span className="text-sm font-black text-slate-800 truncate block mt-0.5">
                    {lastCompletedSummary.vehiclePlate}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Stops Completed</span>
                  <span className="text-sm font-black text-emerald-600 block mt-0.5">
                    {lastCompletedSummary.stopsCount} Stops
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Bottles Delivered</span>
                  <span className="text-sm font-black text-primary block mt-0.5">
                    {lastCompletedSummary.deliveredCount} Jars
                  </span>
                </div>
              </div>

              {/* Undo Route Closure Action */}
              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  Ended this delivery run by accident?
                </span>
                <button
                  type="button"
                  onClick={handleUndoRouteClosure}
                  disabled={isReopeningRoute}
                  className="inline-flex items-center gap-1.5 text-xs font-black text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3.5 py-1.5 rounded-xl transition-all active:scale-95 shadow-xs"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-amber-600 ${isReopeningRoute ? "animate-spin" : ""}`} />
                  <span>{isReopeningRoute ? "Reopening..." : "Undo Closure & Reopen Route"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
          {/* Left Side: Route Stops */}
          <div className={`flex-1 ${activeClient ? "hidden md:block" : "block"}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-base text-slate-800 flex items-center gap-2">
                <MapPin className="text-primary w-4 h-4" /> Today&apos;s Route Stops
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAddClientOpen(true)}
                  className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-emerald-100 transition-all border border-emerald-200 active:scale-95 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> <span>Add Client</span>
                </button>
              </div>
            </div>

            {/* Daily Work Summary Card */}
            <div className="glass-card p-5 mb-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Daily Route Progress
                </span>
                <span className="text-xs font-black bg-white/10 px-2.5 py-1 rounded-lg text-emerald-300">
                  Live Sync
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-2xl sm:text-3xl font-black">{clients.filter(c => (c as any).isCompleted).length}</p>
                  <p className="text-xs sm:text-sm text-slate-200 font-bold">Stops Completed</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-2xl sm:text-3xl font-black">
                    {clients.reduce((acc, c) => acc + ((c as any).deliveredCount || 0), 0)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-200 font-bold">Bottles Handed Off</p>
                </div>
              </div>
            </div>

            {/* Stops Directory */}
            <div className="space-y-3.5">
              {clients.map(c => {
                const isCompleted = (c as any).isCompleted;
                const isSelected = activeClient === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (isCompleted) {
                        toast("This client delivery is already completed and recorded.", { icon: "✅" });
                        return;
                      }
                      handleStartDelivery(c.id);
                    }}
                    className={`glass-card p-4 transition-all duration-300 ${isCompleted
                        ? "border-emerald-200/60 bg-emerald-50/20 opacity-80 cursor-default"
                        : isSelected
                          ? "border-primary ring-2 ring-primary/20 shadow-md bg-sky-50/20 cursor-pointer"
                          : "border-slate-100 hover:border-slate-200 cursor-pointer"
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-black text-base ${isCompleted ? "text-emerald-800" : "text-slate-800"}`}>
                            {c.name}
                          </h3>
                          {c.latitude && c.longitude ? (
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-emerald-600" /> Pinned
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                              No GPS
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 font-semibold flex items-center gap-1.5 mt-1">
                          <MapPin className="w-4 h-4 text-slate-500 shrink-0" /> {c.address || "Local address"}
                        </p>
                      </div>
                      {isCompleted && (
                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Done ({(c as any).deliveredCount || 0} Jars)
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleUndoDeliveryStop(e, c.id, c.name, (c as any).deliveredCount || 0)}
                            className="text-[11px] font-bold text-slate-500 hover:text-amber-800 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 px-2 py-1 rounded-lg transition-all active:scale-95 flex items-center gap-1 shadow-2xs"
                            title="Undo delivery if marked complete by accident"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-600" />
                            <span>Undo</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {!isCompleted && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleCallClient(e, c.name, c.phone)}
                          className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 ${c.phone
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                              : "bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100"
                            }`}
                          title={c.phone ? `Call ${c.name} (${c.phone})` : "No phone number registered"}
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Call</span>
                        </button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude && c.longitude ? `${c.latitude},${c.longitude}` : encodeURIComponent(c.address || c.name || "")
                            }`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-[1.2] py-2 bg-sky-50 border border-sky-100 rounded-xl text-xs font-black flex items-center justify-center gap-1 text-sky-700 hover:bg-sky-100 transition-all active:scale-95 text-center"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Directions
                        </a>
                        <button
                          type="button"
                          onClick={() => handleStartDelivery(c.id)}
                          className={`flex-[1.5] py-2 rounded-xl text-xs font-black transition-all active:scale-95 ${activeClient === c.id
                              ? "bg-primary text-white shadow-xs"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                            }`}
                        >
                          {activeClient === c.id ? "Delivering..." : "Deliver"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Active Delivery Station */}
          {activeClient && clientDetails && (
            <div className="flex-1 md:max-w-md lg:max-w-lg md:sticky top-8 self-start">
              {step === 1 && (
                <div className="glass-panel p-6 shadow-md border-slate-100">
                  <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-lg mb-1 inline-block">
                        Active Stop
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900">{clientDetails.name}</h2>
                      {clientDetails.address && (
                        <p className="text-xs text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {clientDetails.address}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setActiveClient(null)}
                      className="md:hidden text-xs font-black text-slate-500 hover:text-slate-800 px-2.5 py-1"
                    >
                      Close
                    </button>
                  </div>

                  {/* Saved Location & Directions to Client Card */}
                  <div className="bg-white rounded-2xl border border-sky-100 shadow-xs p-4 mb-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                          <Navigation className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Saved Location & Directions
                          </h3>
                          <p className="text-[11px] text-slate-500 font-semibold">
                            {clientDetails.latitude && clientDetails.longitude
                              ? "GPS Pin Verified"
                              : "No GPS Coordinates Saved"}
                          </p>
                        </div>
                      </div>
                      {clientDetails.latitude && clientDetails.longitude ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> GPS Saved
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Unpinned
                        </span>
                      )}
                    </div>

                    {/* Address & Coordinates Display */}
                    <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span className="text-slate-800 font-bold">
                          {clientDetails.address || "No street address listed"}
                        </span>
                      </div>
                      {clientDetails.latitude && clientDetails.longitude && (
                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 font-semibold text-slate-600">
                          <span>Saved Coordinates:</span>
                          <span className="font-mono text-slate-800 font-bold">
                            {clientDetails.latitude.toFixed(6)}, {clientDetails.longitude.toFixed(6)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Interactive Embedded Map Preview */}
                    {clientDetails.latitude && clientDetails.longitude ? (
                      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-2xs relative">
                        <iframe
                          title={`Saved location for ${clientDetails.name}`}
                          width="100%"
                          height="150"
                          style={{ border: 0 }}
                          loading="lazy"
                          src={`https://maps.google.com/maps?q=${clientDetails.latitude},${clientDetails.longitude}&z=16&output=embed`}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePinCurrentLocationForClient(clientDetails.id)}
                        disabled={isUpdatingLocation}
                        className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <MapPin className="w-3.5 h-3.5 text-amber-700" />
                        <span>{isUpdatingLocation ? "Acquiring GPS..." : "📍 Pin Client's Current Location Now"}</span>
                      </button>
                    )}

                    {/* Prominent Directions & Call Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${clientDetails.latitude && clientDetails.longitude
                            ? `${clientDetails.latitude},${clientDetails.longitude}`
                            : encodeURIComponent(clientDetails.address || clientDetails.name)
                          }`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 text-center"
                      >
                        <Navigation className="w-3.5 h-3.5 shrink-0" />
                        <span>Directions</span>
                      </a>

                      <button
                        type="button"
                        onClick={(e) => handleCallClient(e, clientDetails.name, clientDetails.phone)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 ${clientDetails.phone
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-slate-100 border border-slate-200 text-slate-400"
                          }`}
                      >
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{clientDetails.phone ? "Call" : "No Phone"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Client Info Pill */}
                  <div className="bg-sky-50/70 border border-sky-100 p-3.5 rounded-2xl mb-5 flex justify-between items-center text-xs sm:text-sm">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-sky-800 block mb-0.5">Tier</span>
                      <span className="font-black text-slate-900">{clientDetails.tier || "Standard"}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black uppercase tracking-wider text-sky-800 block mb-0.5">Reward Points</span>
                      <span className="font-black text-slate-900">{clientDetails.loyalty_points || 0} Pts</span>
                    </div>
                  </div>

                  {/* Product Selector */}
                  {activeAllocations.length > 0 && (
                    <div className="mb-5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                        Delivering Product
                      </label>
                      <select
                        value={selectedInventoryId}
                        onChange={e => setSelectedInventoryId(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-sm cursor-pointer shadow-xs"
                      >
                        {activeAllocations.map(alloc => {
                          const inv = inventoryTypes.find(i => i.id === alloc.inventory_type_id);
                          return (
                            <option key={alloc.inventory_type_id} value={alloc.inventory_type_id}>
                              {inv?.name || "Product"} (In Van: {alloc.allocated_count})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Quantity Steppers */}
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
                      <div>
                        <p className="font-black text-sm text-sky-700">Full Handed Over</p>
                        <p className="text-[11px] text-slate-400 font-medium">Bottles delivered</p>
                      </div>
                      <Counter value={currentDelivery.full} setValue={val => updateCurrentDelivery("full", val)} />
                    </div>

                    <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
                      <div>
                        <p className="font-black text-sm text-emerald-700">Empty Collected</p>
                        <p className="text-[11px] text-slate-400 font-medium">Empty return retrieved</p>
                      </div>
                      <Counter value={currentDelivery.empty} setValue={val => updateCurrentDelivery("empty", val)} />
                    </div>

                    <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
                      <div>
                        <p className="font-black text-sm text-rose-600">Damaged / Cullet</p>
                        <p className="text-[11px] text-slate-400 font-medium">Cracked or lost cans</p>
                      </div>
                      <Counter value={currentDelivery.damaged} setValue={val => updateCurrentDelivery("damaged", val)} />
                    </div>
                  </div>

                  {/* Bill & Actions */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex justify-between items-center mb-2 px-1">
                      <span className="text-slate-400 text-xs font-black uppercase tracking-wider">Subtotal Due</span>
                      <span className="text-3xl font-black text-slate-800">₹{totalAmount}</span>
                    </div>

                    <Button
                      variant="primary"
                      fullWidth
                      className="py-3.5 text-base font-black shadow-md"
                      onClick={() => setStep(2)}
                      disabled={!Object.values(deliveryItems).some(c => c.full > 0 || c.empty > 0)}
                    >
                      Proceed to Collect ₹{totalAmount}
                    </Button>
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => {
                        setDeliveryItems({});
                        handlePayment("Skipped");
                      }}
                    >
                      Skip (Customer Not Available)
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="glass-panel p-6 shadow-md border-slate-100 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Collect Payment
                  </span>
                  <h2 className="text-4xl font-black text-slate-800 mb-1">₹{totalAmount}</h2>
                  <p className="text-slate-500 font-bold text-xs mb-3">{clientDetails.name}</p>

                  {/* Credit Dues Breakdown Card */}
                  {(Number(clientDetails?.credit_amount) || 0) > 0 && (
                    <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 mb-4 text-left space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                        <span>Today&apos;s Drop Amount:</span>
                        <span className="font-black text-slate-800">₹{totalAmount}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-semibold text-amber-800">
                        <span>Previous Unpaid Credit:</span>
                        <span className="font-black text-rose-600">₹{Number(clientDetails.credit_amount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-black text-slate-900 pt-1.5 border-t border-amber-200">
                        <span>Total Net Dues:</span>
                        <span className="text-sm font-black text-rose-700">₹{(Number(clientDetails.credit_amount) || 0) + totalAmount}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                      onClick={handleSelectCash}
                      className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center gap-2 hover:border-emerald-500 hover:bg-emerald-50/20 active:scale-95 transition-all"
                    >
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
                        <IndianRupee className="w-6 h-6" />
                      </div>
                      <span className="font-black text-slate-800 text-sm">Cash</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Handed in person</span>
                    </button>

                    <button
                      onClick={handleSelectUPI}
                      className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center gap-2 hover:border-sky-500 hover:bg-sky-50/20 active:scale-95 transition-all"
                    >
                      <div className="w-12 h-12 bg-sky-100 text-sky-700 rounded-2xl flex items-center justify-center">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <span className="font-black text-slate-800 text-sm">UPI / QR</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Immediate phone scan</span>
                    </button>
                  </div>

                  {/* Customer Not Available / Pay Later from Slip QR */}
                  <button
                    onClick={handleSelectPayLaterSlip}
                    className="w-full mb-6 bg-gradient-to-r from-amber-50 to-orange-50/80 p-4 rounded-2xl border border-amber-200/90 shadow-xs flex items-center justify-between hover:border-amber-400 active:scale-[0.98] transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm">Leave at Door (Slip QR)</span>
                          <span className="bg-amber-200/80 text-amber-900 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                            Pay Later
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                          Customer not home • Drops jars &amp; prints 58mm slip with UPI QR to pay later
                        </p>
                      </div>
                    </div>
                    <Printer className="w-4 h-4 text-amber-700 shrink-0 ml-2" />
                  </button>

                  <button
                    onClick={() => setStep(1)}
                    className="text-xs font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ← Back to quantities
                  </button>
                </div>
              )}
            </div>
          )}

          {!activeClient && (
            <div className="hidden md:flex flex-1 items-center justify-center glass-panel border-dashed border-slate-200 min-h-[300px]">
              <div className="text-center p-8">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">Select a stop from the left column to begin delivery.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Client Modal */}
      <Modal isOpen={isAddClientOpen} onClose={() => setIsAddClientOpen(false)} title="Register Client on Route">
        <form onSubmit={handleAddClient} className="space-y-4">
          {/* Location Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setLocationMethod("gps");
                startGpsAcquisition();
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${locationMethod === "gps" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
            >
              📍 Auto-Detect GPS
            </button>
            <button
              type="button"
              onClick={() => setLocationMethod("link")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${locationMethod === "link" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
            >
              🔗 Paste Map Link
            </button>
          </div>

          {locationMethod === "gps" && (
            <div className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/90 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl shrink-0 ${gpsAccuracy !== null && gpsAccuracy <= 15
                      ? "bg-emerald-100 text-emerald-700"
                      : isLocating
                        ? "bg-sky-100 text-sky-700 animate-pulse"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                    <Crosshair className={`w-4 h-4 ${isLocating ? "animate-spin" : ""}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-800">
                        {gpsLocation ? `${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}` : "Detecting GPS..."}
                      </span>
                      {gpsAccuracy !== null && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${gpsAccuracy <= 15
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                          }`}>
                          ±{gpsAccuracy}m
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">{gpsStatus}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startGpsAcquisition}
                  disabled={isLocating}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50 shrink-0"
                  title="Refetch High-Accuracy GPS"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLocating ? "animate-spin text-primary" : ""}`} />
                  <span className="text-[11px]">Refetch</span>
                </button>
              </div>

              {gpsLocation && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> High Precision Confirmed
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${gpsLocation.lat},${gpsLocation.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Verify on Maps
                  </a>
                </div>
              )}
            </div>
          )}

          {locationMethod === "link" && (
            <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                Paste Google Maps Link / WhatsApp Location / Coordinates
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationInput}
                  onChange={e => setLocationInput(e.target.value)}
                  placeholder="e.g. maps.app.goo.gl/... or 19.0760, 72.8774"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => parseLocationText(locationInput)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 shrink-0 flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Parse</span>
                </button>
              </div>
              {gpsLocation && (
                <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pinned: {gpsLocation.lat.toFixed(6)}, {gpsLocation.lng.toFixed(6)}
                </div>
              )}
            </div>
          )}

          {/* Map Preview when coordinates are present in Add Client */}
          {gpsLocation && (
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
              <iframe
                title="New client location preview"
                width="100%"
                height="120"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${gpsLocation.lat},${gpsLocation.lng}&z=16&output=embed`}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Client / Store Name *
            </label>
            <input
              type="text"
              required
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-sm"
              placeholder="e.g. Cafe Blue Express"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={newClientPhone}
                onChange={e => setNewClientPhone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-sm"
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Pricing Tier
              </label>
              {(() => {
                const mainBottle = inventoryTypes.find((i: any) => i.name.toLowerCase().includes("20l")) || inventoryTypes[0];
                return (
                  <select
                    value={newClientTier}
                    onChange={e => setNewClientTier(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-sm cursor-pointer"
                  >
                    <option value="Standard">
                      Standard Rate {mainBottle ? `(₹${mainBottle.price} on 20L)` : "(Retail)"}
                    </option>
                    <option value="Wholesale">
                      Wholesale Discount {mainBottle ? `(₹${mainBottle.wholesale_price} on 20L)` : "(Bulk)"}
                    </option>
                    <option value="Premium">
                      Premium VIP Contract {mainBottle ? `(₹${mainBottle.premium_price} on 20L)` : "(VIP)"}
                    </option>
                  </select>
                );
              })()}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Address / Landmark
            </label>
            <input
              type="text"
              value={newClientAddress}
              onChange={e => setNewClientAddress(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 bg-white text-slate-800 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-sm"
              placeholder="Shop #12, Phase 1"
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsAddClientOpen(false)} type="button" fullWidth>
              Cancel
            </Button>
            <Button variant="primary" type="submit" fullWidth disabled={isAddingClient || !newClientName}>
              {isAddingClient ? "Saving..." : "Save Client"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* End Route / Reconcile Run Modal */}
      <Modal
        isOpen={isEndRouteModalOpen}
        onClose={() => !isSubmittingEndRoute && setIsEndRouteModalOpen(false)}
        title="End Route & Return to Warehouse"
      >
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-200/60">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Route Run Summary
              </span>
              <span className="text-xs font-bold text-slate-700">{routeDisplay} • {vehicleDisplay}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-black text-slate-400 uppercase block">Stops Completed</span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">
                  {clients.filter(c => (c as any).isCompleted).length} / {clients.length}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-black text-slate-400 uppercase block">Bottles Delivered</span>
                <span className="text-xl font-black text-primary mt-0.5 block">
                  {clients.reduce((acc, c) => acc + ((c as any).deliveredCount || 0), 0)}
                </span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs space-y-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                Van Stock Reconciliation to Warehouse
              </span>
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>Remaining Full Jars:</span>
                <span className="font-black text-slate-900 text-sm">{currentStock}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>Crew Returning:</span>
                <span className="font-semibold text-slate-600">
                  {driverName} {helperName ? `+ ${helperName}` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Incomplete stops warning if any */}
          {clients.filter(c => !(c as any).isCompleted).length > 0 && (
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-amber-900 leading-relaxed">
                Notice: {clients.filter(c => !(c as any).isCompleted).length} stop(s) were not marked completed. Ending this route now will reconcile today&apos;s shift and return all remaining stock back to the warehouse.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setIsEndRouteModalOpen(false)}
              disabled={isSubmittingEndRoute}
              fullWidth
            >
              Keep Delivering
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmEndRoute}
              isLoading={isSubmittingEndRoute}
              fullWidth
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirm &amp; End Route
            </Button>
          </div>
        </div>
      </Modal>

      {/* Thermal Bluetooth Receipt Modal with Dynamic QR & Celebratory Success Animation */}
      {receiptData && (
        <ThermalReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          mode={receiptModalMode}
          data={receiptData}
          onConfirmPayment={async () => {
            await handlePayment("UPI / QR", false);
            setReceiptData(prev => prev ? { ...prev, paymentMethod: "UPI / QR" } : null);
            setReceiptModalMode("success_receipt");
          }}
          onNextStop={() => {
            setIsReceiptModalOpen(false);
            setActiveClient(null);
            setStep(1);
            setDeliveryItems({});
          }}
        />
      )}

      {/* Brand Footer */}
      <footer className="mt-12 py-4 text-center">
        <p className="text-xs font-semibold text-slate-400">
          Powered by{" "}
          <a
            href="https://in-tasolutions.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-black bg-gradient-to-r from-slate-950 via-slate-900 to-blue-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity underline decoration-blue-500/30 underline-offset-2"
            title="Visit IN-TA Solutions"
          >
            IN-TA Solution PVT LTD
          </a>
        </p>
      </footer>
    </div>
  );
}

function Counter({ value, setValue }: { value: number; setValue: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-2xl border border-slate-100">
      <button
        onClick={() => setValue(Math.max(0, value - 1))}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-xs border border-slate-200/80 hover:bg-slate-50 active:scale-95 transition-all text-slate-800"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-6 text-center font-black text-lg text-slate-800">{value}</span>
      <button
        onClick={() => setValue(value + 1)}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary text-white shadow-xs hover:bg-sky-600 active:scale-95 transition-all"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
