// Use relative '/api' in the browser so Next.js rewrites can proxy requests securely
// without browser Mixed Content (HTTPS -> HTTP) or CORS issues.
const API_BASE_URL = typeof window !== 'undefined'
  ? '/api'
  : (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://64.227.171.31/api');

// --- Token Rotation State ---
let activeRefreshPromise: Promise<string | null> | null = null;

export interface Token {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  user?: User;
}

/**
 * Perform silent token refresh using the stored refresh token.
 * Multiple concurrent callers will reuse the same in-flight request.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        // Refresh token is expired or revoked
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        return null;
      }

      const data: Token = await res.json();
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }
        return data.access_token;
      }
      return null;
    } catch {
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

/**
 * Generic fetcher to handle JSON responses, errors, and silent token rotation.
 */
async function fetcher<T>(endpoint: string, options?: RequestInit, isRetry: boolean = false): Promise<T> {
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
    let errorMessage = `Server returned error (${response.status})`;
    try {
      const text = await response.text();
      try {
        const errorData = JSON.parse(text);
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        if (text && text.trim().length > 0 && text.length < 150) {
          errorMessage = text.trim();
        }
      }
    } catch (e) {
      // Ignore text read failure
    }
    const isAuthError = response.status === 401 || 
      (response.status === 403 && errorMessage === "Could not validate credentials") || 
      errorMessage === "Not authenticated";

    // Attempt silent token refresh if not already retrying, and not on auth endpoints
    if (isAuthError && !isRetry && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        return fetcher<T>(endpoint, {
          ...options,
          headers: {
            ...headers,
            'Authorization': `Bearer ${newAccessToken}`,
          },
        }, true);
      }
    }

    if (isAuthError && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
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
  credit_amount?: number;
  bottle_balance?: number;
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
export const adjustClientCredit = (id: string, data: { amount: number; type: "SET" | "ADD" | "DEDUCT"; notes?: string }) =>
  fetcher<Client>(`/clients/${id}/credit-adjust`, {
    method: 'POST',
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
  driving_license?: string | null;
  is_active?: boolean;
  token_version?: number;
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
  created_at?: string;
  updated_at?: string;
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
export const reopenAssignment = (id: string) =>
  fetcher<Assignment>(`/assignments/${id}/reopen`, {
    method: 'PUT',
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
export interface DeliveryItem {
  id: string;
  delivery_id: string;
  inventory_type_id: string;
  delivered_full: number;
  collected_empty: number;
  price_charged: number;
}

export interface Delivery {
  id: string;
  assignment_id: string;
  client_id: string;
  total_amount: number;
  paid_amount?: number;
  payment_method?: string;
  status: string;
  upi_reference?: string;
  verified_at?: string;
  verified_by?: string;
  notes?: string;
  created_at: string;
  items?: DeliveryItem[];
}

export const createDelivery = (data: any) =>
  fetcher<Delivery>(`/deliveries`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const getPendingDoorstepDeliveries = (includeAll?: boolean) =>
  fetcher<Delivery[]>(`/deliveries/pending-doorstep${includeAll ? '?include_all=true' : ''}`);
export const verifyDoorstepDelivery = (deliveryId: string, data: { action: "VERIFY_PAID" | "MARK_CREDITED"; amount_paid?: number; upi_reference?: string; notes?: string; payment_mode?: string }) =>
  fetcher<Delivery>(`/deliveries/${deliveryId}/verify`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const revertDeliveryByClient = (assignmentId: string, clientId: string) =>
  fetcher<{message: string}>(`/deliveries/by-client/${assignmentId}/${clientId}`, {
    method: 'DELETE',
  });
export const deleteDelivery = (deliveryId: string) =>
  fetcher<{message: string}>(`/deliveries/${deliveryId}`, {
    method: 'DELETE',
  });


// --- Auth ---
export const login = (username: string, password: string): Promise<Token> => {
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
    const data: Token = await res.json();
    if (typeof window !== 'undefined') {
      if (data.access_token) localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
    }
    return data;
  }).catch((err: any) => {
    if (err.message === "Load failed" || err.message === "Failed to fetch") {
      throw new Error("Unable to connect to backend server. Please check backend connection or server status.");
    }
    throw err;
  });
};

export const refreshToken = (refreshTokenStr: string): Promise<Token> =>
  fetcher<Token>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshTokenStr }),
  });

export const revokeAllUserTokens = (userId: string) =>
  fetcher<{ message: string; token_version: number }>(`/auth/revoke-tokens?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
  });

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

// --- Production Setup & Reset ---
export interface SetupStatus {
  is_clean: boolean;
  total_users: number;
  total_clients: number;
  total_vehicles: number;
  total_routes: number;
  total_assignments: number;
  total_deliveries: number;
  total_inventory_types: number;
  total_glass_collections: number;
}

export interface SetupRequest {
  master_key?: string;
  confirm_wipe: string;
  name: string;
  username: string;
  password: string;
  phone?: string;
  company_name?: string;
  dispatch_hotline?: string;
  upi_id?: string;
}

export const getSetupStatus = () => fetcher<SetupStatus>('/setup/status');

export const resetAndCreateSuperuser = (data: SetupRequest) =>
  fetcher<{ status: string; message: string; user: any }>('/setup/reset-and-create-superuser', {
    method: 'POST',
    body: JSON.stringify(data),
  });


// --- Trip Expenses ---

export interface TripExpense {
  id: string;
  assignment_id: string;
  reported_by?: string;
  reporter_name?: string;
  category: 'FUEL' | 'TOLL' | 'PARKING' | 'MAINTENANCE' | 'OTHER';
  amount: number;
  description: string | null;
  created_at: string;
}

export const createTripExpense = (data: {
  assignment_id: string;
  category: string;
  amount: number;
  description?: string;
}) =>
  fetcher<TripExpense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getExpensesForAssignment = (assignmentId: string) =>
  fetcher<TripExpense[]>(`/expenses/assignment/${assignmentId}`);

export const getAllExpenses = (params?: { start_date?: string; end_date?: string; assignment_id?: string }) => {
  const q = params ? new URLSearchParams(params as any).toString() : '';
  return fetcher<TripExpense[]>(`/expenses${q ? `?${q}` : ''}`);
};

export const deleteTripExpense = (expenseId: string) =>
  fetcher<{ message: string }>(`/expenses/${expenseId}`, { method: 'DELETE' });


// --- Bottle Credit Ledger ---

export interface BottleCreditEntry {
  id: string;
  client_id: string;
  assignment_id: string | null;
  inventory_type_id: string;
  inventory_name?: string;
  quantity: number;   // +ve = we owe customer bottles, -ve = customer owes us
  notes: string | null;
  created_at: string;
}

export const adjustBottleCredit = (clientId: string, data: {
  quantity: number;
  inventory_type_id: string;
  assignment_id?: string;
  notes?: string;
}) =>
  fetcher<BottleCreditEntry>(`/clients/${clientId}/bottle-credit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getBottleLedger = (clientId: string) =>
  fetcher<BottleCreditEntry[]>(`/clients/${clientId}/bottle-ledger`);

export const getBottleCreditBalance = (clientId: string) =>
  fetcher<{ balances: { inventory_type_id: string; name: string; balance: number }[] }>(
    `/clients/${clientId}/bottle-credit-balance`
  );
