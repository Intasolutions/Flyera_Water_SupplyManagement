"use client";

import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { 
  Package, 
  Plus, 
  Search, 
  RefreshCw, 
  IndianRupee, 
  Layers, 
  AlertTriangle, 
  Edit2, 
  Trash2, 
  Sliders,
  CheckCircle2
} from "lucide-react";
import { getInventoryTypes, createInventoryType, updateInventoryType, deleteInventoryType, adjustInventoryStock, InventoryType } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const confirm = useConfirm();
  
  // Stock adjustment modal states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addFull, setAddFull] = useState(0);
  const [addEmpty, setAddEmpty] = useState(0);
  const [addDamaged, setAddDamaged] = useState(0);
  const [adjustingStock, setAdjustingStock] = useState(false);

  // Item create/edit states
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState(80);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const data = await getInventoryTypes();
      setInventory(data || []);
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
      toast.error("Failed to load inventory stock");
    } finally {
      setLoading(false);
    }
  };

  const handleEditStock = async () => {
    if (!editingId) return;
    try {
      setAdjustingStock(true);
      await adjustInventoryStock(editingId, {
        add_full: addFull,
        add_empty: addEmpty,
        add_damaged: addDamaged,
      });
      await fetchInventory();
      setEditingId(null);
      setAddFull(0);
      setAddEmpty(0);
      setAddDamaged(0);
      toast.success("Stock counts adjusted successfully!");
    } catch (error: any) {
      console.error("Failed to update stock:", error);
      toast.error(error.message || "Failed to adjust stock");
    } finally {
      setAdjustingStock(false);
    }
  };

  const openStockModal = (item: InventoryType) => {
    setEditingId(item.id);
    setAddFull(0);
    setAddEmpty(0);
    setAddDamaged(0);
  };

  const handleSaveItem = async () => {
    if (!newItemName.trim()) {
      toast.error("Please enter an item name");
      return;
    }

    try {
      const payload = {
        name: newItemName.trim(),
        price: Number(newItemPrice) || 0,
      };
      
      if (editItemId) {
        await updateInventoryType(editItemId, payload);
        toast.success("Item updated successfully!");
      } else {
        await createInventoryType(payload);
        toast.success("New product category created!");
      }
      
      await fetchInventory();
      setItemModalOpen(false);
      setEditItemId(null);
      setNewItemName("");
      setNewItemPrice(80);
    } catch (error: any) {
      console.error("Failed to save item:", error);
      toast.error(error.message || "Failed to save category");
    }
  };

  const handleAddItemClick = () => {
    setEditItemId(null);
    setNewItemName("");
    setNewItemPrice(80);
    setItemModalOpen(true);
  };

  const handleEditItemClick = (item: InventoryType) => {
    setEditItemId(item.id);
    setNewItemName(item.name);
    setNewItemPrice(item.price);
    setItemModalOpen(true);
  };

  const handleDeleteItem = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: "Delete Inventory Category",
      message: `Are you sure you want to remove "${name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    
    if (isConfirmed) {
      try {
        await deleteInventoryType(id);
        await fetchInventory();
        toast.success("Item category deleted.");
      } catch (error: any) {
        console.error("Failed to delete item:", error);
        toast.error(error.message || "Failed to delete item");
      }
    }
  };

  // Filter dynamically
  const filteredInventory = useMemo(() => {
    return inventory.filter(i => 
      (i.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [inventory, searchQuery]);

  // Aggregate KPI metrics
  const totalFullStock = inventory.reduce((acc, i) => acc + (i.full || 0), 0);
  const totalEmptyStock = inventory.reduce((acc, i) => acc + (i.empty || 0), 0);
  const totalDamagedStock = inventory.reduce((acc, i) => acc + (i.damaged || 0), 0);
  const totalStockValuation = inventory.reduce((acc, i) => acc + ((i.full || 0) * (i.price || 0)), 0);

  const activeStockItem = inventory.find(i => i.id === editingId);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 lg:p-10 pt-20 md:pt-8 pb-24 md:pb-12 transition-all max-w-7xl">
        <PageHeader 
          title="Inventory & Stock" 
          subtitle="Track godown inventory, full bottle supplies, returned empties, and scrap damage."
          badge={`${inventory.length} Product Lines`}
          badgeColor="cyan"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchInventory()}
                title="Refresh stock"
                className="p-2.5 bg-white border border-gray-200 hover:border-primary rounded-xl shadow-sm text-text-muted hover:text-primary transition-all active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
              </button>
              <Button 
                onClick={handleAddItemClick} 
                icon={<Plus className="w-4 h-4" />}
                className="shadow-md"
              >
                Add Stock Category
              </Button>
            </div>
          }
        />

        {/* Top KPI Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 mb-6 md:mb-8">
          <StatCard 
            title="Full Warehouse Stock" 
            value={totalFullStock.toLocaleString()} 
            trend="Ready for route dispatch"
            icon={<Package className="w-5 h-5 text-blue-600" />}
            badge="Full"
            color="blue"
          />
          <StatCard 
            title="Returned Empties" 
            value={totalEmptyStock.toLocaleString()} 
            trend="Awaiting plant refilling"
            icon={<Layers className="w-5 h-5 text-emerald-600" />}
            badge="Refill"
            color="emerald"
          />
          <StatCard 
            title="Damaged / Scrap" 
            value={totalDamagedStock.toLocaleString()} 
            trend="Needs replacement or repair"
            icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
            badge="Damaged"
            color="rose"
          />
          <StatCard 
            title="Full Stock Valuation" 
            value={`₹${totalStockValuation.toLocaleString()}`} 
            trend="Total warehouse inventory value"
            icon={<IndianRupee className="w-5 h-5 text-purple-600" />}
            badge="Valuation"
            color="purple"
          />
        </div>

        {/* Search Bar Container */}
        <div className="glass-panel p-4 md:p-5 rounded-3xl mb-8 border border-black/5 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search product category..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-gray-200 rounded-xl outline-none text-text text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
              />
            </div>

            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs font-bold text-primary hover:underline px-2 py-1"
              >
                Reset Search
              </button>
            )}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInventory.map(item => {
            const totalUnits = (item.full || 0) + (item.empty || 0) + (item.damaged || 0);
            const fullPercent = totalUnits > 0 ? Math.round(((item.full || 0) / totalUnits) * 100) : 0;
            const emptyPercent = totalUnits > 0 ? Math.round(((item.empty || 0) / totalUnits) * 100) : 0;

            return (
              <div 
                key={item.id} 
                className="glass-panel p-5 rounded-3xl hover:shadow-md transition-all border border-black/5 flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-50 text-primary rounded-2xl border border-blue-100 shadow-sm group-hover:scale-105 transition-transform">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-text tracking-tight group-hover:text-primary transition-colors">
                          {item.name}
                        </h3>
                        <p className="text-xs text-text-muted font-bold">
                          ₹{item.price} <span className="font-medium text-[11px]">per unit</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stock Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 py-3 my-2 text-center">
                    <div className="p-2.5 bg-blue-50/70 border border-blue-100/60 rounded-xl">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-700 block mb-0.5">
                        Full
                      </span>
                      <span className="text-lg font-black text-blue-900">
                        {item.full || 0}
                      </span>
                    </div>

                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-100/60 rounded-xl">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 block mb-0.5">
                        Empty
                      </span>
                      <span className="text-lg font-black text-emerald-900">
                        {item.empty || 0}
                      </span>
                    </div>

                    <div className="p-2.5 bg-rose-50/70 border border-rose-100/60 rounded-xl">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-700 block mb-0.5">
                        Damaged
                      </span>
                      <span className="text-lg font-black text-rose-900">
                        {item.damaged || 0}
                      </span>
                    </div>
                  </div>

                  {/* Balance Progress Bar */}
                  <div className="mt-2 mb-4">
                    <div className="flex justify-between text-[11px] font-bold text-text-muted mb-1">
                      <span>Stock Ratio</span>
                      <span>{fullPercent}% Full</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                      <div style={{ width: `${fullPercent}%` }} className="h-full bg-blue-500" />
                      <div style={{ width: `${emptyPercent}%` }} className="h-full bg-emerald-500" />
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex gap-2 pt-2 border-t border-black/5">
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => openStockModal(item)} 
                    icon={<Sliders className="w-3.5 h-3.5" />}
                    className="flex-1"
                  >
                    Adjust Stock
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => handleEditItemClick(item)} 
                    icon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    onClick={() => handleDeleteItem(item.id, item.name)} 
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  />
                </div>
              </div>
            );
          })}

          {filteredInventory.length === 0 && !loading && (
            <div className="col-span-full p-12 text-center bg-surface/60 rounded-3xl border border-dashed border-gray-200">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-text">No inventory categories</h3>
              <p className="text-text-muted text-sm mt-1 max-w-sm mx-auto">
                Add 20L bottles, 5L cans, or custom supply items to start tracking warehouse volumes.
              </p>
              <div className="mt-4">
                <Button onClick={handleAddItemClick} icon={<Plus className="w-4 h-4" />} size="sm">
                  Add Stock Category
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Adjust Stock Quantities */}
        <Modal
          isOpen={!!editingId}
          onClose={() => setEditingId(null)}
          title={`Adjust Stock: ${activeStockItem?.name || "Product"}`}
          subtitle="Add or subtract quantities when receiving refills or inspecting damaged bottles."
          width="md"
          actions={
            <div className="flex gap-3 w-full">
              <Button variant="secondary" onClick={() => setEditingId(null)} fullWidth>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleEditStock} 
                disabled={adjustingStock} 
                fullWidth
              >
                {adjustingStock ? "Updating Stock..." : "Update Stock"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Current In Godown:</span>
              <span className="font-extrabold text-blue-700">
                {activeStockItem?.full || 0} Full • {activeStockItem?.empty || 0} Empty • {activeStockItem?.damaged || 0} Damaged
              </span>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1 block">
                Add / Deduct Full Bottles
              </label>
              <input 
                type="number" 
                placeholder="e.g. 50 (or -10)" 
                value={addFull || ""} 
                onChange={e => setAddFull(parseInt(e.target.value) || 0)} 
                className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text font-bold text-lg focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" 
              />
              <span className="text-[11px] text-text-muted">Use negative numbers to deduct damaged or expired units.</span>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1 block">
                Add / Deduct Returned Empties
              </label>
              <input 
                type="number" 
                placeholder="e.g. 25" 
                value={addEmpty || ""} 
                onChange={e => setAddEmpty(parseInt(e.target.value) || 0)} 
                className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text font-bold text-lg focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" 
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1 block">
                Add / Deduct Damaged Units
              </label>
              <input 
                type="number" 
                placeholder="e.g. 3" 
                value={addDamaged || ""} 
                onChange={e => setAddDamaged(parseInt(e.target.value) || 0)} 
                className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text font-bold text-lg focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all" 
              />
            </div>
          </div>
        </Modal>

        {/* Modal: Create or Edit Category */}
        <Modal
          isOpen={itemModalOpen}
          onClose={() => setItemModalOpen(false)}
          title={editItemId ? "Edit Stock Item" : "New Stock Item"}
          subtitle="Configure item name and default delivery unit price."
          width="md"
          actions={
            <div className="flex gap-3 w-full">
              <Button variant="secondary" onClick={() => setItemModalOpen(false)} fullWidth>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveItem} fullWidth>
                {editItemId ? "Save Item" : "Create Item"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                Item / Product Name
              </label>
              <input 
                type="text" 
                placeholder="e.g. 20L Water Jar" 
                value={newItemName} 
                onChange={e => setNewItemName(e.target.value)} 
                className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium" 
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                Standard Retail Price (₹)
              </label>
              <input 
                type="number" 
                placeholder="80" 
                value={newItemPrice || ""} 
                onChange={e => setNewItemPrice(parseFloat(e.target.value) || 0)} 
                className="w-full bg-surface border border-gray-200 rounded-xl px-4 py-3 outline-none text-text focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-lg" 
              />
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
