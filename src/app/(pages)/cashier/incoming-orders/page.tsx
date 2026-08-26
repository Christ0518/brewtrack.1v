"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api_links from "@/config/fetch_links/api_links.json";
import { FiArrowLeft, FiPackage } from "react-icons/fi";

interface CustomerOrder {
  id: string | number;
  order_number?: string;
  customer_name?: string;
  notes?: string;
  status?: string;
  created_at?: string;
  items: Array<{
    product_name?: string;
    variant_name?: string;
    quantity: number;
  }>;
}

export default function IncomingOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | number | null>(null);

  const handleAcceptOrder = async (orderId: string | number) => {
    if (!shopId) return;

    setAcceptingOrderId(orderId);

    try {
      const response = await fetch(api_links.tbl_orders, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-shop-id": shopId,
        },
        body: JSON.stringify({ id: orderId, status: "preparing" }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to accept order: ${response.status} - ${errorText.substring(0, 120)}`);
      }

      setOrders((currentOrders) => currentOrders.filter((order) => order.id !== orderId));
    } catch (err) {
      console.error("Failed to accept incoming order:", err);
      setError(err instanceof Error ? err.message : "Unable to accept order.");
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const isRecentOrder = (createdAt?: string) => {
    if (!createdAt) return false;
    const created = new Date(createdAt).getTime();
    return !Number.isNaN(created) && Date.now() - created < 1000 * 60 * 5;
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.push("/");
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      setShopId(String(user.shop_id || ""));
    } catch (err) {
      console.error("Failed to parse user data", err);
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    if (!shopId) return;

    const loadOrders = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${api_links.tbl_orders}?shop_id=${shopId}`, {
          cache: "no-store",
          headers: { "x-shop-id": shopId },
        });
        if (!response.ok) {
          throw new Error(`Failed to load orders: ${response.status}`);
        }
        const data = await response.json();
        const normalized = Array.isArray(data) ? data : [];
        const pendingOrders = normalized
          .filter((order: any) => {
            const status = String(order.status).toLowerCase();
            return status === "pending" || status === "awaiting_acceptance";
          })
          .map((order: any) => ({
            id: order.id,
            order_number: order.order_number || `ORD-${String(order.id).padStart(6, "0")}`,
            customer_name: order.customer_name || "Walk-in",
            notes: order.notes || order.special_notes || "",
            status: order.status,
            created_at: order.created_at || order.createdAt || new Date().toISOString(),
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  product_name: item.product_name || "Item",
                  variant_name: item.variant_name || "",
                  quantity: Number(item.quantity) || 0,
                }))
              : [],
          }));
        setOrders(pendingOrders);
      } catch (err) {
        console.error(err);
        setError("Unable to load incoming orders.");
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [shopId]);

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push("/cashier")}
              className="mb-5 inline-flex items-center gap-2 px-0 py-1 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
            >
              <FiArrowLeft size={16} /> Back to cashier
            </button>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Cashier queue</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Incoming orders</h1>
            <p className="mt-1 text-sm text-slate-500">Accept orders in the order they arrived.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-500">Waiting</span>
            <span className="flex h-10 min-w-10 items-center justify-center bg-red-600 px-3 text-lg font-black text-white">
              {orders.length}
            </span>
          </div>
        </header>

        <div className="mt-6">
          {loading ? (
            <div className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">Loading incoming orders...</div>
          ) : error ? (
            <div className="border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
          ) : orders.length === 0 ? (
            <div className="border border-slate-200 bg-white px-6 py-16 text-center">
              <FiPackage className="mx-auto mb-3 text-slate-300" size={38} />
              <p className="font-bold text-slate-700">Queue is clear</p>
              <p className="mt-1 text-sm text-slate-500">New customer orders will appear here.</p>
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
              {orders.map((order, orderIndex) => (
                <article
                  key={order.id}
                  className={`border-l-4 p-5 transition sm:p-6 ${
                    isRecentOrder(order.created_at) ? "border-red-500 bg-red-50/40" : "border-transparent"
                  } ${orderIndex > 0 ? "border-t border-slate-200" : ""}`}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs font-black text-slate-400">#{orderIndex + 1}</span>
                        <p className="text-xl font-black text-slate-950">{order.order_number}</p>
                        {isRecentOrder(order.created_at) && (
                          <span className="bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">New</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                        <span>{order.customer_name}</span>
                        <span className="text-slate-300">|</span>
                        <span>{order.created_at ? new Date(order.created_at).toLocaleString() : ""}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="text-sm text-slate-700">
                            <span className="font-black text-slate-950">{item.quantity}x</span> {item.product_name}
                            {item.variant_name && <span className="text-slate-500"> · {item.variant_name}</span>}
                          </div>
                        ))}
                      </div>
                      {order.notes && <p className="mt-3 border-l-2 border-amber-400 pl-3 text-sm text-slate-600">{order.notes}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAcceptOrder(order.id)}
                      disabled={acceptingOrderId === order.id}
                      className="shrink-0 bg-[#16834b] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#116b3d] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {acceptingOrderId === order.id ? "Accepting..." : "Accept to Kitchen"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
