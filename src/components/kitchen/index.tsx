"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { supabaseClient } from "@/lib/supabase-client";

interface Order {
  id: number;
  order_number: string;
  items: Array<{
    product_name: string;
    quantity: number;
    variant: string;
  }>;
  status: "pending" | "awaiting_acceptance" | "preparing" | "completed";
  created_at: string;
  cashier_id?: string | number | null;
  accepted_at?: string;
  special_notes?: string;
  customer_name?: string;
}

export default function KitchenDisplay() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [shopName, setShopName] = useState("Shop");

  const buildOrderNumber = (id: number) => `ORD-${String(id).padStart(3, "0")}`;

  const getOrderTimestamp = (acceptedAt: string | undefined, createdAt: string, cashierId?: string | number | null) => {
    const queueTime = acceptedAt || (cashierId ? createdAt : undefined);
    if (!queueTime) return Number.POSITIVE_INFINITY;

    const timestamp = new Date(queueTime).getTime();
    return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
  };

  const sortByQueueOrder = (a: Order, b: Order) => {
    const aTimestamp = getOrderTimestamp(a.accepted_at, a.created_at, a.cashier_id);
    const bTimestamp = getOrderTimestamp(b.accepted_at, b.created_at, b.cashier_id);

    if (!Number.isFinite(aTimestamp)) return Number.isFinite(bTimestamp) ? 1 : a.id - b.id;
    if (!Number.isFinite(bTimestamp)) return -1;

    const timeDiff = bTimestamp - aTimestamp;
    if (timeDiff !== 0) return timeDiff;
    return a.id - b.id;
  };

  const loadOrders = async () => {
    const storedShopId = localStorage.getItem("shopId") || "1";

    const response = await fetch(api_links.tbl_orders, {
      cache: "no-store",
      headers: {
        "x-shop-id": storedShopId,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load orders: ${response.status} - ${errorText.substring(0, 120)}`);
    }

    const data = await response.json();
    const normalizedOrders: Order[] = (Array.isArray(data) ? data : [])
      .filter((order: any) => {
        const status = String(order.status || "").toLowerCase();
        return status === "preparing" || status === "completed";
      })
      .map((order: any) => ({
        id: Number(order.id),
        cashier_id: order.cashier_id,
        order_number: order.order_number || buildOrderNumber(Number(order.id)),
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              product_name: item.product_name || "Unknown item",
              quantity: Number(item.quantity) || 0,
              variant: item.variant_name || item.variant || "Default",
            }))
          : [],
        status: String(order.status || "preparing").toLowerCase() as Order["status"],
        created_at: order.created_at,
        accepted_at: order.accepted_at || undefined,
        special_notes: order.notes || order.special_notes || undefined,
        customer_name: order.customer_name || undefined,
      }));

    setOrders([...normalizedOrders].sort(sortByQueueOrder));
  };

  const handleLogout = async () => {
    try {
      await Fetch_to(api_links.jwt.deauth);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("user");
      localStorage.removeItem("shopId");
      router.push("/");
    }
  };

  // Check user role on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedShopName = localStorage.getItem("shopName");
    console.log("DEBUG KITCHEN - storedUser:", storedUser);

    if (storedShopName) setShopName(storedShopName);
    
    if (!storedUser || storedUser === "undefined") {
      console.log("DEBUG KITCHEN - No user or undefined, redirecting to /");
      router.push("/");
      return;
    }

    try {
      const userData = JSON.parse(storedUser);
      console.log("DEBUG KITCHEN - Parsed userData:", userData);
      console.log("DEBUG KITCHEN - User role:", userData.role);
      
      if (userData.role !== "kitchen" && userData.role !== "admin") {
        console.log("DEBUG KITCHEN - Role not kitchen/admin, redirecting to /");
        router.push("/");
        return;
      }
      console.log("DEBUG KITCHEN - Authorization passed, showing kitchen display");
    } catch (error) {
      console.error("Failed to parse user data:", error);
      localStorage.removeItem("user");
      router.push("/");
      return;
    }

    const storedShopId = localStorage.getItem("shopId") || "1";

    const initializeOrders = async () => {
      try {
        await loadOrders();
      } catch (error) {
        console.error("Failed to load kitchen orders:", error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    initializeOrders();
    let fallbackRefreshInterval: ReturnType<typeof setInterval> | undefined;

    const startFallbackRefresh = () => {
      if (fallbackRefreshInterval) return;

      fallbackRefreshInterval = setInterval(() => {
        loadOrders().catch((error) => {
          console.error("Failed to refresh kitchen orders:", error);
        });
      }, 5000);
    };

    const ordersChannel = supabaseClient
      .channel(`kitchen-orders-${storedShopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tbl_orders",
          filter: `shop_id=eq.${storedShopId}`,
        },
        () => {
          loadOrders().catch((error) => {
            console.error("Failed to refresh kitchen orders:", error);
          });
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Kitchen orders realtime unavailable; using 5-second refresh:", status);
          startFallbackRefresh();
        }
      });

    return () => {
      if (fallbackRefreshInterval) clearInterval(fallbackRefreshInterval);
      void supabaseClient.removeChannel(ordersChannel);
    };
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleStatusChange = async (orderId: number, newStatus: "pending" | "awaiting_acceptance" | "preparing" | "completed") => {
    try {
      const response = await fetch(api_links.tbl_orders, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-shop-id": localStorage.getItem("shopId") || "1",
        },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update order status");
      }

      setOrders((currentOrders) =>
          currentOrders
          .map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
          )
          .sort(sortByQueueOrder)
        );  
    } catch (error) {
      console.error("Failed to update order status:", error);
    }
  };

  const getTimeElapsed = (createdAt: string) => {
    const createdMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdMs)) return "Unknown time";

    const diffMs = Math.max(0, now.getTime() - createdMs);
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return minutes === 1 ? "1 min" : `${minutes} mins`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? "1 hr" : `${hours} hrs`;

    const days = Math.floor(hours / 24);
    return days === 1 ? "1 day" : `${days} days`;
  };

  const getCurrentDateTime = () => {
    return now.toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#073dbe] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-700 font-medium">Loading kitchen...</p>
        </div>
      </div>
    );
  }

  const preparingOrders = orders
    .filter((o) => o.status === "preparing")
    .sort(sortByQueueOrder)
    .slice(0, 10);
  const completedOrders = orders
    .filter((o) => o.status === "completed")
    .sort(sortByQueueOrder);
  const recentCompletedOrders = completedOrders.slice(0, 8);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#073dbe]">{shopName} Kitchen</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Kitchen</h1>
            <p className="mt-1 text-sm text-slate-500">
              {preparingOrders.length === 0 ? "Nothing is waiting right now" : `${preparingOrders.length} ${preparingOrders.length === 1 ? "order" : "orders"} in progress`}
            </p>
          </div>
          <div className="flex items-center justify-between gap-5 sm:justify-end">
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums text-slate-900">
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-xs text-slate-500">{getCurrentDateTime().split(",")[0]}</p>
            </div>
            <button
              onClick={handleLogout}
              className="border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
          <section aria-labelledby="preparing-heading">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#f2b705]" />
                <h2 id="preparing-heading" className="text-lg font-bold">Preparing now</h2>
              </div>
              <span className="text-sm font-semibold text-slate-400">Newest accepted first</span>
            </div>

            <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
              {preparingOrders.length > 0 ? preparingOrders.map((order, orderIndex) => (
                <article key={order.id} className={`p-4 sm:p-5 ${orderIndex > 0 ? "border-t border-slate-200" : ""}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#073dbe] text-sm font-black text-white">
                        {orderIndex + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h3 className="text-xl font-black text-slate-950">{order.order_number}</h3>
                          <span className="text-sm text-slate-500">{order.customer_name || "Walk-in"}</span>
                        </div>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                          Accepted {getTimeElapsed(order.accepted_at || order.created_at)} ago
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                          {order.items.map((item, itemIndex) => (
                            <span key={`${order.id}-${itemIndex}`}>
                              <strong className="text-slate-950">{item.quantity}x</strong> {item.product_name}{item.variant !== "Default" ? ` · ${item.variant}` : ""}
                            </span>
                          ))}
                        </div>
                        {order.special_notes && <p className="mt-3 border-l-2 border-[#f2b705] pl-3 text-sm text-slate-600">{order.special_notes}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleStatusChange(order.id, "completed")}
                      className="shrink-0 bg-[#16834b] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#116b3d] sm:mt-1"
                    >
                      Mark done
                    </button>
                  </div>
                </article>
              )) : (
                <div className="px-6 py-16 text-center">
                  <p className="font-semibold text-slate-700">Queue is clear</p>
                  <p className="mt-1 text-sm text-slate-500">Accepted orders will appear here automatically.</p>
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="completed-heading">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#16834b]" />
                <h2 id="completed-heading" className="text-lg font-bold">Recently done</h2>
              </div>
              <span className="text-sm font-semibold text-slate-400">{completedOrders.length} total</span>
            </div>
            <div className="border border-slate-200 bg-white shadow-sm">
              {recentCompletedOrders.length > 0 ? recentCompletedOrders.map((order, orderIndex) => (
                <div key={order.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${orderIndex > 0 ? "border-t border-slate-100" : ""}`}>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">{order.order_number}</p>
                    <p className="truncate text-xs text-slate-500">{order.customer_name || "Walk-in"}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[#16834b]">Ready</span>
                </div>
              )) : (
                <p className="px-4 py-8 text-center text-sm text-slate-500">No completed orders yet.</p>
              )}
            </div>
            {completedOrders.length > recentCompletedOrders.length && (
              <p className="mt-3 text-center text-xs text-slate-400">Showing the latest {recentCompletedOrders.length} completed orders</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
