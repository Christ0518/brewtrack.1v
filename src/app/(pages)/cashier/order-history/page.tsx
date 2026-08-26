"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiEdit2, FiSearch, FiTrash2 } from "react-icons/fi";
import api_links from "@/config/fetch_links/api_links.json";

interface OrderItem {
  product_name?: string;
  variant_name?: string;
  quantity: number;
  variant_id?: string | number;
  price?: number;
}

interface Order {
  id: string | number;
  order_number?: string;
  customer_name?: string;
  notes?: string;
  status?: string;
  created_at?: string;
  total?: number;
  items: OrderItem[];
}

type ProtectedAction = "edit" | "delete";

export default function OrderHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [shopId, setShopId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [action, setAction] = useState<ProtectedAction | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadOrders = async (currentShopId: string) => {
    const response = await fetch(`${api_links.tbl_orders}?shop_id=${currentShopId}`, {
      cache: "no-store",
      headers: { "x-shop-id": currentShopId },
    });
    if (!response.ok) throw new Error("Unable to load order history.");
    const data = await response.json();
    setOrders(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser || storedUser === "undefined") {
      router.push("/");
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      const currentShopId = String(user.shop_id || localStorage.getItem("shopId") || "1");
      setShopId(currentShopId);
      loadOrders(currentShopId).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load order history."));
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const openAction = (nextAction: ProtectedAction, order: Order) => {
    if (nextAction === "edit") {
      sessionStorage.setItem("cashierEditOrder", JSON.stringify(order));
      router.push("/cashier");
      return;
    }

    setAction(nextAction);
    setSelectedOrder(order);
    setAdminPassword("");
    setEditName(order.customer_name || "Walk-in");
    setEditNotes(order.notes || "");
    setEditItems(order.items.map((item) => ({ ...item })));
  };

  const closeAction = () => {
    if (submitting) return;
    setAction(null);
    setSelectedOrder(null);
  };

  const submitAction = async () => {
    if (!selectedOrder || !action || !shopId || !adminPassword) return;
    setSubmitting(true);
    setError("");

    try {
      const isEditing = action === "edit";
      const activeEditItems = editItems.filter((item) => Number(item.quantity) > 0);
      if (isEditing && activeEditItems.length === 0) {
        throw new Error("Keep at least one item in the order.");
      }
      const editedTotal = activeEditItems.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * Number(item.quantity),
        0
      );
      const response = await fetch(api_links.tbl_orders, {
        method: isEditing ? "PUT" : "PATCH",
        headers: { "Content-Type": "application/json", "x-shop-id": shopId },
        body: JSON.stringify({
          id: selectedOrder.id,
          action,
          admin_password: adminPassword,
          ...(isEditing
            ? {
                items: activeEditItems
                  .map((item) => ({
                  variant_id: item.variant_id,
                  quantity: Number(item.quantity),
                  price: Number(item.price) || 0,
                  discount_type: "none",
                  discount: 0,
                  })),
                total: editedTotal,
                discount_type: "none",
                discount: 0,
                paid: editedTotal,
                change: 0,
              }
            : {}),
          customer_name: editName,
          notes: editNotes,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "Admin authorization failed.");

      if (isEditing) {
        closeAction();
        router.push("/cashier");
        return;
      }

      await loadOrders(shopId);
      closeAction();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update order.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const value = `${order.order_number || order.id} ${order.customer_name || ""}`.toLowerCase();
    return value.includes(search.toLowerCase());
  });

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button type="button" onClick={() => router.push("/cashier")} className="mb-5 inline-flex items-center gap-2 px-0 py-1 text-sm font-semibold text-slate-600 hover:text-slate-950">
              <FiArrowLeft size={16} /> Back to cashier
            </button>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Cashier records</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Order history</h1>
            <p className="mt-1 text-sm text-slate-500">Edit or delete records with admin authorization.</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-slate-950">{orders.length}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Total orders</p>
          </div>
        </header>

        <div className="mt-6 flex items-center gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order number or customer..." className="w-full border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-600" />
          </div>
        </div>

        {error && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 overflow-hidden border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading order history...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">No orders found.</p>
          ) : filteredOrders.map((order, index) => (
            <article key={order.id} className={`p-4 sm:p-5 ${index > 0 ? "border-t border-slate-200" : ""}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-black text-slate-950">{order.order_number || `Order #${order.id}`}</h2>
                    <span className="bg-slate-100 px-2 py-1 text-xs font-bold capitalize text-slate-600">{order.status || "unknown"}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{order.customer_name || "Walk-in"} {order.created_at ? `· ${new Date(order.created_at).toLocaleString()}` : ""}</p>
                  <p className="mt-3 text-sm text-slate-700">{order.items.map((item, itemIndex) => `${item.quantity}x ${item.product_name || "Item"}${item.variant_name ? ` (${item.variant_name})` : ""}`).join(" · ") || "No items"}</p>
                  {order.notes && <p className="mt-2 border-l-2 border-amber-400 pl-3 text-sm text-slate-500">{order.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => openAction("edit", order)} className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><FiEdit2 size={15} /> Edit</button>
                  <button type="button" onClick={() => openAction("delete", order)} className="inline-flex items-center gap-2 border border-red-200 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"><FiTrash2 size={15} /> Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {action && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-slate-200 bg-white p-6 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Admin authorization</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{action === "edit" ? "Edit order" : "Delete order"}</h2>
            <p className="mt-2 text-sm text-slate-500">Enter an admin password to continue.</p>

            {action === "edit" && (
              <div className="mt-5 space-y-3">
                <div className="border-y border-slate-200 py-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Order items</p>
                  {editItems.map((item, itemIndex) => (
                    <div key={`${item.variant_id || item.product_name}-${itemIndex}`} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0 text-sm text-slate-700">
                        <p className="truncate font-semibold">{item.product_name || "Item"}</p>
                        {item.variant_name && <p className="text-xs text-slate-500">{item.variant_name}</p>}
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(event) => {
                          const quantity = Math.max(0, Number(event.target.value) || 0);
                          setEditItems((current) => current.map((currentItem, currentIndex) => currentIndex === itemIndex ? { ...currentItem, quantity } : currentItem));
                        }}
                        className="w-20 border border-slate-300 px-2 py-2 text-center text-sm font-bold outline-none focus:border-blue-600"
                        aria-label={`Quantity for ${item.product_name || "item"}`}
                      />
                    </div>
                  ))}
                </div>
                <input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Customer name" className="w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600" />
                <textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} placeholder="Notes" rows={3} className="w-full resize-none border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600" />
              </div>
            )}

            <div className="mt-4 space-y-3">
              <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="Admin password" autoComplete="current-password" className="w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600" />
            </div>

            <div className="mt-6 flex gap-2">
              <button type="button" onClick={closeAction} disabled={submitting} className="flex-1 border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={submitAction} disabled={submitting || !adminPassword} className={`flex-1 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300 ${action === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-[#16834b] hover:bg-[#116b3d]"}`}>{submitting ? "Checking..." : action === "edit" ? "Save changes" : "Delete order"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
