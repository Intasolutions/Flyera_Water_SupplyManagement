"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { 
  TrendingUp, 
  Package, 
  Truck, 
  IndianRupee,
  Calendar
} from "lucide-react";
import { getDashboardStats } from "@/lib/actions";

export default function DashboardPage() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState<any>({
    totalClients: 0,
    totalVehicles: 0,
    activeAssignments: 0,
    todayRevenue: 0,
    activeRoutes: [],
    recentActivity: []
  });

  useEffect(() => {
    getDashboardStats(startDate, endDate).then(setStats).catch(console.error);
  }, [startDate, endDate]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8 transition-all">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text mb-1">Overview</h1>
            <p className="text-text-muted">Welcome back. Here's what's happening today.</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
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
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Period Revenue" 
            value={`₹${stats.todayRevenue}`} 
            trend="Total Collected" 
            icon={<IndianRupee className="w-6 h-6 text-emerald-500" />} 
          />
          <StatCard 
            title="Active Vehicles" 
            value={`${stats.activeAssignments} / ${stats.totalVehicles}`} 
            trend="Active Routes" 
            icon={<Truck className="w-6 h-6 text-blue-500" />} 
          />
          <StatCard 
            title="Total Clients" 
            value={stats.totalClients.toString()} 
            trend="Registered" 
            icon={<Package className="w-6 h-6 text-purple-500" />} 
          />
          <StatCard 
            title="System Status" 
            value="Online" 
            trend="Running smoothly" 
            icon={<TrendingUp className="w-6 h-6 text-amber-500" />} 
          />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Routes */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text">Active Routes</h2>
              <button className="text-sm text-primary font-medium hover:underline">View All</button>
            </div>
            
            <div className="space-y-4">
              {stats.activeRoutes && stats.activeRoutes.length > 0 ? (
                stats.activeRoutes.map((route: any, i: number) => (
                  <RouteRow key={i} vehicle={route.vehicle} driver={route.driver} progress={route.progress} deliveries={route.deliveries} />
                ))
              ) : (
                <p className="text-slate-500 font-medium text-sm">No active routes right now.</p>
              )}
            </div>
          </div>

          {/* Quick Actions / Recent Activity */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-text mb-6">Recent Activity</h2>
            <div className="space-y-6">
              {stats.recentActivity && stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((act: any, i: number) => {
                  const date = new Date(act.time);
                  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return <ActivityRow key={i} text={act.text} time={timeStr} />
                })
              ) : (
                <p className="text-slate-500 font-medium text-sm">No recent activity.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Subcomponents for the dashboard
function StatCard({ title, value, trend, icon }: { title: string, value: string, trend: string, icon: React.ReactNode }) {
  return (
    <div className="glass-panel p-6 rounded-2xl hover:bg-surface-hover transition-colors cursor-pointer">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-surface rounded-xl border border-black/5 shadow-sm">
          {icon}
        </div>
        <span className={`text-sm font-medium ${trend.startsWith('+') ? 'text-success' : 'text-text-muted'}`}>
          {trend}
        </span>
      </div>
      <h3 className="text-text-muted text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-text">{value}</p>
    </div>
  );
}

function RouteRow({ vehicle, driver, progress, deliveries }: { vehicle: string, driver: string, progress: number, deliveries: string }) {
  return (
    <div className="p-4 bg-surface rounded-xl border border-black/5 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Truck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-text">{vehicle}</p>
          <p className="text-xs text-text-muted font-medium">Driver: {driver}</p>
        </div>
      </div>
      
      <div className="flex-1 max-w-xs mx-8">
        <div className="flex justify-between text-xs mb-1 font-medium">
          <span className="text-text-muted">Progress</span>
          <span className="text-text">{progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="text-right">
        <p className="text-sm font-bold text-text">{deliveries}</p>
        <p className="text-xs text-text-muted font-medium">Deliveries</p>
      </div>
    </div>
  );
}

function ActivityRow({ text, time }: { text: string, time: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-2 h-2 mt-2 rounded-full bg-primary shadow-[0_0_8px_rgba(37,99,235,0.4)] shrink-0"></div>
      <div>
        <p className="text-sm text-text font-medium leading-snug">{text}</p>
        <p className="text-xs text-text-muted mt-1">{time}</p>
      </div>
    </div>
  );
}
