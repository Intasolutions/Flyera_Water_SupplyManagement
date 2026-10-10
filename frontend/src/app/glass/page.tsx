"use client";

import { Sidebar } from "@/components/ui/Sidebar";
import { useStore } from "@/lib/StoreContext";
import { 
  Recycle, 
  Factory, 
  IndianRupee,
  Car
} from "lucide-react";

export default function GlassDashboardPage() {
  const { glassInventory, glassCollections, glassVendorPickups } = useStore();

  const totalCollectedTons = glassCollections.reduce((acc, c) => acc + c.tonsCollected, 0);
  const totalPaid = glassCollections.reduce((acc, c) => acc + c.paymentAmount, 0);

  const unseparatedTons = glassCollections
    .filter(c => c.status === "dropped_at_godown")
    .reduce((acc, c) => acc + c.tonsCollected, 0);

  const whiteTons = glassInventory.find(i => i.type === "white")?.tons || 0;
  const mixedTons = glassInventory.find(i => i.type === "mixed")?.tons || 0;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8 transition-all">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text mb-1">Glass Business Overview</h1>
            <p className="text-text-muted">High-level summary of glass collection operations.</p>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          <StatCard 
            title="Total Collected" 
            value={`${totalCollectedTons.toFixed(1)} T`} 
            trend="Today" 
            icon={<Recycle className="w-6 h-6 text-emerald-500" />} 
          />
          <StatCard 
            title="Total Paid" 
            value={`₹${totalPaid}`} 
            trend="To properties" 
            icon={<IndianRupee className="w-6 h-6 text-blue-500" />} 
          />
          <StatCard 
            title="Ready to Separate" 
            value={`${unseparatedTons.toFixed(1)} T`} 
            trend="In Godown" 
            icon={<Factory className="w-6 h-6 text-amber-500" />} 
          />
          <StatCard 
            title="White Glass Stock" 
            value={`${whiteTons.toFixed(1)} T`} 
            trend="Ready for vendor" 
            icon={<Car className="w-6 h-6 text-cyan-500" />} 
          />
          <StatCard 
            title="Mixed Glass Stock" 
            value={`${mixedTons.toFixed(1)} T`} 
            trend="Ready for vendor" 
            icon={<Car className="w-6 h-6 text-purple-500" />} 
          />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-text mb-6">Recent Vendor Pickups</h2>
            <div className="space-y-4">
              {glassVendorPickups.length === 0 && (
                <p className="text-text-muted text-sm">No recent vendor pickups.</p>
              )}
              {glassVendorPickups.map(pickup => (
                <div key={pickup.id} className="p-4 bg-surface rounded-xl border border-black/5 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-text">{pickup.vendorName}</p>
                    <p className="text-xs text-text-muted capitalize">{pickup.type} Glass</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-text">{pickup.tons} T</p>
                    <p className="text-xs text-text-muted">{new Date(pickup.date).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-text mb-6">Recent Collections</h2>
            <div className="space-y-4">
              {glassCollections.length === 0 && (
                <p className="text-text-muted text-sm">No recent collections.</p>
              )}
              {glassCollections.map(collection => (
                <div key={collection.id} className="p-4 bg-surface rounded-xl border border-black/5 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-text">{collection.property}</p>
                    <p className="text-xs text-text-muted">Status: {collection.status === 'collected' ? 'In Transit' : 'Dropped at Godown'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-text">{collection.tonsCollected} T</p>
                    <p className="text-xs text-success font-medium">Paid: ₹{collection.paymentAmount}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, trend, icon }: { title: string, value: string, trend: string, icon: React.ReactNode }) {
  return (
    <div className="glass-panel p-6 rounded-2xl hover:bg-surface-hover transition-colors cursor-pointer">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-surface rounded-xl border border-black/5 shadow-sm">
          {icon}
        </div>
        <span className="text-sm font-medium text-text-muted">
          {trend}
        </span>
      </div>
      <h3 className="text-text-muted text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-text">{value}</p>
    </div>
  );
}
