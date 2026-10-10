"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Package, Plus, Search, Filter } from "lucide-react";
import { getInventoryTypes, createInventoryType, updateInventoryType, deleteInventoryType, adjustInventoryStock, InventoryType } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/lib/useConfirm";

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const confirm = useConfirm();
  
  // Item edit states
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);

  // Edit stock states
  const [addFull, setAddFull] = useState(0);
  const [addEmpty, setAddEmpty] = useState(0);
  const [addDamaged, setAddDamaged] = useState(0);

  // Add new item states
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState(0);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const data = await getInventoryTypes();
      setInventory(data);
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStock = async () => {
    if (editingId) {
      try {
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
        toast.success("Stock updated successfully!");
      } catch (error: any) {
        console.error("Failed to update stock:", error);
        toast.error(error.message || "Failed to update stock.");
      }
    }
  };

  const openEditModal = (id: string) => {
    setEditingId(id);
    setAddFull(0);
    setAddEmpty(0);
    setAddDamaged(0);
  };

  const handleSaveItem = async () => {
    if (newItemName) {
      try {
        const payload = {
          name: newItemName,
          price: newItemPrice,
        };
        
        if (editItemId) {
          await updateInventoryType(editItemId, payload);
        } else {
          await createInventoryType(payload);
        }
        
        await fetchInventory();
        
        setItemModalOpen(false);
        setEditItemId(null);
        setNewItemName("");
        setNewItemPrice(0);
        toast.success(editItemId ? "Inventory item updated successfully!" : "Inventory item created successfully!");
      } catch (error: any) {
        console.error("Failed to save item:", error);
        toast.error(error.message || "Failed to save inventory item.");
      }
    }
  };

  const handleEditItemClick = (item: InventoryType) => {
    setEditItemId(item.id);
    setNewItemName(item.name);
    setNewItemPrice(item.price);
    setItemModalOpen(true);
  };

  const handleAddItemClick = () => {
    setEditItemId(null);
    setNewItemName("");
    setNewItemPrice(0);
    setItemModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Delete Inventory Item",
      message: "Are you sure you want to delete this inventory item? This may affect existing deliveries.",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    
    if (isConfirmed) {
      try {
        await deleteInventoryType(id);
        await fetchInventory();
        toast.success("Inventory item deleted successfully.");
      } catch (error: any) {
        console.error("Failed to delete item:", error);
        toast.error(error.message || "Failed to delete inventory item.");
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pt-16 md:pt-8 transition-all relative">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text mb-1">Inventory Management</h1>
            <p className="text-text-muted">Track full, empty, and damaged stock.</p>
          </div>
          <Button onClick={handleAddItemClick} icon={<Plus className="w-5 h-5" />}>
            Add Stock Item
          </Button>
        </header>

        {/* Global Inventory Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <h3 className="text-text-muted font-medium mb-1">Total Full Bottles (20L)</h3>
            <p className="text-4xl font-bold text-blue-600">{inventory[0]?.full || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <h3 className="text-text-muted font-medium mb-1">Total Empty Returned (20L)</h3>
            <p className="text-4xl font-bold text-emerald-600">{inventory[0]?.empty || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <h3 className="text-text-muted font-medium mb-1">Damaged / Missing</h3>
            <p className="text-4xl font-bold text-red-500">{inventory[0]?.damaged || 0}</p>
          </div>
        </div>

        {/* Inventory List */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-black/5 flex flex-col md:flex-row justify-between gap-4">
            <h2 className="text-xl font-bold text-text">Stock Categories</h2>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="w-5 h-5 absolute left-3 top-2.5 text-text-muted" />
                <input 
                  type="text" 
                  placeholder="Search item..." 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <Button variant="outline" className="px-3" icon={<Filter className="w-5 h-5" />} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {inventory.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col h-full relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl border border-blue-100/50 flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-800 tracking-tight leading-tight">{item.name}</h3>
                      <div className="text-slate-500 text-sm font-medium mt-0.5">₹{item.price} per unit</div>
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/30 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Full</span>
                      <span className="text-xl font-black text-blue-600">{item.full}</span>
                    </div>
                    <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/30 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Empty</span>
                      <span className="text-xl font-black text-emerald-600">{item.empty}</span>
                    </div>
                    <div className="bg-red-50/50 rounded-xl p-3 border border-red-100/30 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Damaged</span>
                      <span className="text-xl font-black text-red-500">{item.damaged}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-100 mt-auto">
                  <Button variant="primary" size="sm" onClick={() => openEditModal(item.id)} className="flex-1">Stock</Button>
                  <Button variant="secondary" size="sm" onClick={() => handleEditItemClick(item)} className="flex-1">Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteItem(item.id)} className="flex-[0.5]">Del</Button>
                </div>
              </div>
            ))}
            {inventory.length === 0 && (
              <div className="col-span-full py-12 text-center text-text-muted bg-white border border-gray-100 rounded-2xl shadow-sm">
                No inventory items found.
              </div>
            )}
          </div>
        </div>

        {/* Edit Modal */}
        <Modal
          isOpen={!!editingId}
          onClose={() => setEditingId(null)}
          title="Adjust Stock"
          subtitle="Update the exact quantity arriving at the warehouse."
          width="md"
          actions={
            <div className="flex gap-4 w-full">
              <Button variant="secondary" onClick={() => setEditingId(null)} fullWidth>Cancel</Button>
              <Button variant="primary" onClick={handleEditStock} fullWidth>
                Save Changes
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Add Full Bottles</label>
              <input type="number" value={addFull} onChange={(e) => setAddFull(parseInt(e.target.value) || 0)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Receive Empty Bottles</label>
              <input type="number" value={addEmpty} onChange={(e) => setAddEmpty(parseInt(e.target.value) || 0)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Report Damaged</label>
              <input type="number" value={addDamaged} onChange={(e) => setAddDamaged(parseInt(e.target.value) || 0)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
          </div>
        </Modal>

        {/* Item Modal */}
        <Modal
          isOpen={itemModalOpen}
          onClose={() => setItemModalOpen(false)}
          title={editItemId ? "Edit Stock Item" : "Add Stock Item"}
          width="md"
          actions={
            <div className="flex gap-4 w-full">
              <Button variant="secondary" onClick={() => setItemModalOpen(false)} fullWidth>Cancel</Button>
              <Button variant="primary" onClick={handleSaveItem} fullWidth>
                {editItemId ? "Update Item" : "Save Item"}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Item Name</label>
              <input type="text" placeholder="e.g. 10 Liter Mineral Water" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Price per Unit (₹)</label>
              <input type="number" value={newItemPrice} onChange={(e) => setNewItemPrice(parseInt(e.target.value) || 0)} className="w-full border border-gray-200 rounded-xl p-3.5 bg-white text-slate-800 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
