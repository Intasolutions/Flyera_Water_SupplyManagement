"use server";

import { revalidatePath } from "next/cache";

const API_BASE_URL = process.env.BACKEND_URL 
  ? `${process.env.BACKEND_URL.replace(/\/api\/?$/, '')}/api` 
  : "http://64.227.171.31/api";

// Dashboard Actions
export async function getDashboardStats(startDate?: string, endDate?: string) {
  try {
    let url = `${API_BASE_URL}/dashboard/stats`;
    if (startDate && endDate) {
      url += `?start_date=${startDate}&end_date=${endDate}`;
    }
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error("Failed to fetch");
    return await res.json();
  } catch (error) {
    // Fallback if backend is down
    return {
      totalClients: 0,
      totalVehicles: 0,
      activeAssignments: 0,
      todayRevenue: 0,
      activeRoutes: [],
      recentActivity: []
    };
  }
}

// Client Actions
export async function getClients() {
  const res = await fetch(`${API_BASE_URL}/clients`, { cache: 'no-store' });
  if (!res.ok) return [];
  return await res.json();
}

export async function createClient(data: { name: string, phone: string, address: string }) {
  const res = await fetch(`${API_BASE_URL}/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath("/clients");
  return await res.json();
}

// Inventory Actions
export async function getInventory() {
  const res = await fetch(`${API_BASE_URL}/inventory`, { cache: 'no-store' });
  if (!res.ok) return [];
  return await res.json();
}

// Vehicle & Staff Actions
export async function getVehicles() {
  const res = await fetch(`${API_BASE_URL}/vehicles`, { cache: 'no-store' });
  if (!res.ok) return [];
  return await res.json();
}

export async function getStaff() {
  const res = await fetch(`${API_BASE_URL}/users`, { cache: 'no-store' });
  if (!res.ok) return [];
  return await res.json();
}

// Glass Actions
export async function getGlassDashboardStats(startDate?: string, endDate?: string) {
  try {
    let url = `${API_BASE_URL}/glass/stats`;
    if (startDate && endDate) {
      url += `?start_date=${startDate}&end_date=${endDate}`;
    }
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error("Failed to fetch glass stats");
    return await res.json();
  } catch (error) {
    console.error("Error fetching glass stats:", error);
    return null;
  }
}

