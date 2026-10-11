// Use relative '/api' in the browser so Next.js rewrites can proxy requests securely
// without browser Mixed Content (HTTPS -> HTTP) or CORS issues.
const API_BASE_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('127.0.0.1') && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')
      ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
      : '/api')
  : (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api');

/**
 * Generic fetcher to handle JSON responses and errors uniformly.
 */
async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as any,
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store', // Prevent aggressive browser caching
      ...options,
      headers,
    });
  } catch (netErr: any) {
    if (netErr.message === "Load failed" || netErr.message === "Failed to fetch") {
      throw new Error("Unable to connect to backend server. Please check server status or connection.");
    }
    throw netErr;
  }

  if (!response.ok) {
    let errorMessage = 'An error occurred while fetching data.';
    try {
      const errorData = await response.json();
      if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
      } else {
        errorMessage = errorData.detail || errorMessage;
      }
    } catch (e) {
      // Ignore if cannot parse error response
    }
    const isAuthError = response.status === 401 || 
      (response.status === 403 && errorMessage === "Could not validate credentials") || 
      errorMessage === "Not authenticated";

    if (isAuthError && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
      // Return a never-resolving promise to pause execution until the browser navigates away
      return new Promise(() => {}) as any;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

// --- Dashboard Stats ---
export const getDashboardStats = () => fetcher<any>('/dashboard-stats');

// --- Clients ---
export interface Client {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  tier?: string;
  loyalty_points: number;
  opt_in_loyalty: boolean;
  latitude?: number;
  longitude?: number;
  route_id: string | null;
  created_at: string;
  updated_at: string;
}

export const getClients = () => fetcher<Client[]>('/clients');
export const getClient = (id: string) => fetcher<Client>(`/clients/${id}`);
export const createClient = (data: Partial<Client>) => 
  fetcher<Client>('/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const updateClient = (id: string, data: Partial<Client>) =>
  fetcher<Client>(`/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
export const deleteClient = (id: string) =>
  fetcher<{message: string}>(`/clients/${id}`, {
    method: 'DELETE',
  });

// --- Vehicles ---
export interface Vehicle {
  id: string;
  plate_number: string;
  model: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const getVehicles = () => fetcher<Vehicle[]>('/vehicles');
export const createVehicle = (data: Partial<Vehicle>) => 
  fetcher<Vehicle>('/vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const updateVehicle = (id: string, data: Partial<Vehicle>) =>
  fetcher<Vehicle>(`/vehicles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
export const deleteVehicle = (id: string) =>
  fetcher<{message: string}>(`/vehicles/${id}`, {
    method: 'DELETE',
  });

// --- Users (Staff) ---
export interface User {
  id: string;
  name: string;
  username?: string;
  role: string;
  phone: string | null;
  address?: string | null;
  id_proof_url?: string | null;
  assigned_vehicle_id?: string | null;
  created_at: string;
  updated_at: string;
}

export const getUsers = () => fetcher<User[]>('/users');
export const getUser = (id: string) => fetcher<User>(`/users/${id}`);
export const createUser = (data: Partial<User>) => 
  fetcher<User>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const deleteUser = (id: string) => 
  fetcher<{message: string}>(`/users/${id}`, {
    method: 'DELETE',
  });
export const updateUser = (id: string, data: Partial<User>) =>
  fetcher<User>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

// --- Inventory ---
export interface InventoryType {
  id: string;
  name: string;
  price: number;
  wholesale_price: number;
  premium_price: number;
  points_value: number;
  created_at: string;
  updated_at: string;
  // Let's add full/empty/damaged placeholders for frontend logic until stock table is fully wired
  full?: number;
  empty?: number;
  damaged?: number;
}

export const getInventoryTypes = () => fetcher<InventoryType[]>('/inventory');
export const createInventoryType = (data: Partial<InventoryType>) => 
  fetcher<InventoryType>('/inventory', {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const updateInventoryType = (id: string, data: Partial<InventoryType>) =>
  fetcher<InventoryType>(`/inventory/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
export const deleteInventoryType = (id: string) =>
  fetcher<{message: string}>(`/inventory/${id}`, {
    method: 'DELETE',
  });
export const adjustInventoryStock = (id: string, data: {add_full: number, add_empty: number, add_damaged: number}) =>
  fetcher<InventoryType>(`/inventory/${id}/stock`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// --- Routes ---
export interface Route {
  id: string;
  name: string;
  area: string | null;
  created_at: string;
  updated_at: string;
}

export const getRoutes = () => fetcher<Route[]>('/routes');
export const createRoute = (data: Partial<Route>) => 
  fetcher<Route>('/routes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const updateRoute = (id: string, data: Partial<Route>) =>
  fetcher<Route>(`/routes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
export const deleteRoute = (id: string) =>
  fetcher<{message: string}>(`/routes/${id}`, {
    method: 'DELETE',
  });

// --- Assignments ---
export interface Allocation {
  id: string;
  inventory_type_id: string;
  allocated_count: number;
  returned_full: number;
  returned_empty: number;
}

export interface Assignment {
  id: string;
  date: string;
  vehicle_id: string;
  driver_id: string;
  helper_id: string | null;
  route_id: string | null;
  status: string;
  allocations: Allocation[];
}

export const getAssignments = () => fetcher<Assignment[]>('/assignments');
export const getAssignment = (id: string) => fetcher<Assignment>(`/assignments/${id}`);
export const createAssignment = (data: any) => 
  fetcher<Assignment>('/assignments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const completeAssignment = (id: string, returned_stock: any[]) =>
  fetcher<Assignment>(`/assignments/${id}/complete`, {
    method: 'PUT',
    body: JSON.stringify(returned_stock),
  });
export const updateAssignment = (id: string, data: any) =>
  fetcher<Assignment>(`/assignments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
export const deleteAssignment = (id: string) =>
  fetcher<{message: string}>(`/assignments/${id}`, {
    method: 'DELETE',
  });
export const createDelivery = (data: any) =>
  fetcher<any>(`/deliveries`, {
    method: 'POST',
    body: JSON.stringify(data),
  });


// --- Auth ---
export const login = (username: string, password: string) => {
  // OAuth2 expects form-urlencoded data
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  
  return fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString()
  }).then(async res => {
    if (!res.ok) {
      let detail = "Login failed";
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch (e) {}
      throw new Error(detail);
    }
    return res.json();
  }).catch((err: any) => {
    if (err.message === "Load failed" || err.message === "Failed to fetch") {
      throw new Error("Unable to connect to backend server. Please check backend connection or server status.");
    }
    throw err;
  });
};

export const getCurrentUser = () => fetcher<User>('/auth/me');

// --- Glass Business API ---
export interface GlassInventory {
  id: string;
  type: "unseparated" | "white" | "mixed";
  tons: number;
  updated_at?: string;
}

export interface GlassCollection {
  id: string;
  driver_id?: string;
  driverId?: string;
  driver_name?: string;
  driverName?: string;
  vehicle: string;
  property: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  tons_collected?: number;
  tonsCollected?: number;
  payment_amount?: number;
  paymentAmount?: number;
  status: "collected" | "dropped_at_godown" | "separated";
  date: string;
}

export interface GlassVendorPickup {
  id: string;
  vendor_name?: string;
  vendorName?: string;
  type: "white" | "mixed";
  tons: number;
  price_per_ton?: number;
  pricePerTon?: number;
  date: string;
}

export interface GlassStats {
  totalCollectedTons: number;
  total_collected_tons?: number;
  totalPaid: number;
  total_paid?: number;
  unseparatedTons: number;
  unseparated_tons?: number;
  whiteTons: number;
  white_tons?: number;
  mixedTons: number;
  mixed_tons?: number;
  totalPickupTons: number;
  total_pickup_tons?: number;
  totalPickupRevenue: number;
  total_pickup_revenue?: number;
  inTransitTons: number;
  in_transit_tons?: number;
  inTransitCount: number;
  recentPickups: GlassVendorPickup[];
  recentCollections: GlassCollection[];
}

export const getGlassStats = (startDate?: string, endDate?: string) => {
  let url = '/glass/stats';
  if (startDate && endDate) {
    url += `?start_date=${startDate}&end_date=${endDate}`;
  }
  return fetcher<GlassStats>(url);
};

export const getGlassCollections = (status?: string, startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const q = params.toString();
  return fetcher<GlassCollection[]>(`/glass/collections${q ? `?${q}` : ''}`);
};

export const createGlassCollection = (data: Partial<GlassCollection>) =>
  fetcher<GlassCollection>('/glass/collect', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const dropoffGlassCollection = (id: string) =>
  fetcher<GlassCollection>(`/glass/dropoff/${id}`, {
    method: 'POST',
  });

export const dropoffAllGlass = (driverId?: string) =>
  fetcher<{ message: string; count: number; totalTons?: number }>('/glass/dropoff-all', {
    method: 'POST',
    body: JSON.stringify({ driver_id: driverId }),
  });

export const separateGlassStock = (data: {
  collection_id?: string | null;
  tons_separated: number;
  white_tons: number;
  mixed_tons: number;
  staff_id?: string;
}) =>
  fetcher<any>('/glass/separate', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getGlassInventoryList = () => fetcher<GlassInventory[]>('/glass/inventory');

export const createGlassVendorPickup = (data: {
  vendor_name: string;
  type: "white" | "mixed";
  tons: number;
  price_per_ton?: number;
}) =>
  fetcher<GlassVendorPickup>('/glass/vendor-pickup', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getGlassVendorPickups = () => fetcher<GlassVendorPickup[]>('/glass/vendor-pickups');

// --- System Settings ---
export const getSettings = () => fetcher<Record<string, any>>('/settings');
export const updateSettings = (data: Record<string, any>) =>
  fetcher<Record<string, any>>('/settings', {
    method: 'POST',
    body: JSON.stringify(data),
  });


