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
    addOns: Array<{
      id?: string | number;
      name: string;
    }>;
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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

    const timeDiff = aTimestamp - bTimestamp;
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
              addOns: Array.isArray(item.add_ons)
                ? item.add_ons.map((addOn: any) => ({
                    id: addOn.id,
                      name: addOn.name || "Add-on",
                    }))
                : [],
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
    const refreshInterval = setInterval(() => {
      loadOrders().catch((error) => {
        console.error("Failed to refresh kitchen orders:", error);
      });
    }, 5000);

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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tbl_orders_details",
        },
        () => {
          loadOrders().catch((error) => {
            console.error("Failed to refresh kitchen order details:", error);
          });
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Kitchen orders realtime unavailable; continuing with 5-second refresh:", status);
        }
      });

    return () => {
      clearInterval(refreshInterval);
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
      <div className="min-h-screen bg-[#FAF6F4] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#C98A84] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#4D413E] font-bold">Loading kitchen...</p>
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
    <main className="min-h-screen bg-[#FAF6F4] text-[#2D2626]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#E9DEDA] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A65F58]">{shopName} Kitchen</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#2D2626]">Kitchen</h1>
            <p className="mt-1 text-sm text-[#796E6B]">
              {preparingOrders.length === 0 ? "Nothing is waiting right now" : `${preparingOrders.length} ${preparingOrders.length === 1 ? "order" : "orders"} in progress`}
            </p>
          </div>
          <div className="flex items-center justify-between gap-5 sm:justify-end">
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums text-[#2D2626]">
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-xs text-[#796E6B]">{getCurrentDateTime().split(",")[0]}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-[#E9DEDA] bg-white px-3 py-2 text-sm font-bold text-[#796E6B] transition-colors hover:border-[#C98A84] hover:bg-[#FBF2F0]"
            >
              Log out
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
          <section aria-labelledby="preparing-heading">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#C98A84]" />
                <h2 id="preparing-heading" className="text-lg font-black">Preparing now</h2>
              </div>

            </div>

            <div className="space-y-3">
              {preparingOrders.length > 0 ? preparingOrders.map((order, orderIndex) => (
                <article
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOrder(order)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedOrder(order);
                    }
                  }}
                  className="cursor-pointer rounded-2xl border border-[#E9DEDA] bg-white p-4 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#C98A84] sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C98A84] text-sm font-black text-white">
                        {orderIndex + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h3 className="text-xl font-black text-[#2D2626]">{order.order_number}</h3>
                          <span className="text-sm text-[#796E6B]">{order.customer_name || "Walk-in"}</span>
                        </div>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#B7A8A3]">
                          Accepted {getTimeElapsed(order.accepted_at || order.created_at)} ago
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#4D413E]">
                          {order.items.map((item, itemIndex) => (
                            <span key={`${order.id}-${itemIndex}`}>
                              <strong className="text-[#2D2626]">{item.quantity}x</strong> {item.product_name}{item.variant !== "Default" ? ` · ${item.variant}` : ""}
                              {item.addOns.length > 0 && (
                                <span className="ml-1 text-[#A65F58]">
                                  (Add-ons: {item.addOns.map((addOn) => addOn.name).join(", ")})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                        {order.special_notes && <p className="mt-3 rounded-xl bg-[#ECE6E2] px-3 py-2 text-sm text-[#796E6B]">{order.special_notes}</p>}
                      </div>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleStatusChange(order.id, "completed");
                      }}
                      className="shrink-0 rounded-xl bg-[#C98A84] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#B97872] sm:mt-1"
                    >
                      Mark done
                    </button>
                  </div>
                </article>
              )) : (
                <div className="rounded-2xl border border-dashed border-[#E9DEDA] bg-white px-6 py-16 text-center">
                  <p className="font-bold text-[#4D413E]">Queue is clear</p>
                  <p className="mt-1 text-sm text-[#796E6B]">Accepted orders will appear here automatically.</p>
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="completed-heading">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#7EAA8A]" />
                <h2 id="completed-heading" className="text-lg font-black">Recently done</h2>
              </div>
              <span className="text-sm font-bold text-[#B7A8A3]">{completedOrders.length} total</span>
            </div>
            <div className="rounded-2xl border border-[#E9DEDA] bg-white shadow-sm">
              {recentCompletedOrders.length > 0 ? recentCompletedOrders.map((order, orderIndex) => (
                <div
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOrder(order)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedOrder(order);
                    }
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#FBF2F0] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#C98A84] ${orderIndex > 0 ? "border-t border-[#E9DEDA]" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[#4D413E]">{order.order_number}</p>
                    <p className="truncate text-xs text-[#796E6B]">{order.customer_name || "Walk-in"}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#E5F1E9] px-2 py-1 text-xs font-bold text-[#477259]">Ready</span>
                </div>
              )) : (
                <p className="px-4 py-8 text-center text-sm text-[#796E6B]">No completed orders yet.</p>
              )}
            </div>
            {completedOrders.length > recentCompletedOrders.length && (
              <p className="mt-3 text-center text-xs text-slate-400">Showing the latest {recentCompletedOrders.length} completed orders</p>
            )}
          </section>
        </div>
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2626]/45 p-4"
          role="presentation"
          onClick={() => setSelectedOrder(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-heading"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E9DEDA] pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A65F58]">Order details</p>
                <h2 id="order-detail-heading" className="mt-1 text-2xl font-black text-[#2D2626]">
                  {selectedOrder.order_number}
                </h2>
                <p className="mt-1 text-sm text-[#796E6B]">{selectedOrder.customer_name || "Walk-in"}</p>
              </div>
              <button
                type="button"
                aria-label="Close order details"
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl border border-[#E9DEDA] px-3 py-2 text-lg font-bold text-[#796E6B] transition-colors hover:border-[#C98A84] hover:bg-[#FBF2F0]"
              >
                ×
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wide ${
                selectedOrder.status === "completed"
                  ? "bg-[#E5F1E9] text-[#477259]"
                  : "bg-[#FBEEE9] text-[#A65F58]"
              }`}>
                {selectedOrder.status === "completed" ? "Ready" : "Preparing"}
              </span>
              <span className="text-sm text-[#796E6B]">
                Accepted {getTimeElapsed(selectedOrder.accepted_at || selectedOrder.created_at)} ago
              </span>
            </div>

            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-[#796E6B]">Items</h3>
              {selectedOrder.items.length > 0 ? selectedOrder.items.map((item, itemIndex) => (
                <div
                  key={`${selectedOrder.id}-detail-${itemIndex}`}
                  className="flex items-start justify-between gap-4 rounded-2xl bg-[#ECE6E2] px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-[#2D2626]">{item.product_name}</p>
                    {item.variant !== "Default" && <p className="mt-0.5 text-sm text-[#796E6B]">{item.variant}</p>}
                    {item.addOns.length > 0 && (
                      <p className="mt-1 text-sm text-[#A65F58]">
                        Add-ons: {item.addOns.map((addOn) => addOn.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-lg font-black text-[#A65F58]">×{item.quantity}</span>
                </div>
              )) : (
                <p className="rounded-2xl bg-[#ECE6E2] px-4 py-3 text-sm text-[#796E6B]">No items listed.</p>
              )}
            </div>

            {selectedOrder.special_notes && (
              <div className="mt-5">
                <h3 className="text-sm font-black uppercase tracking-wide text-[#796E6B]">Special notes</h3>
                <p className="mt-2 rounded-2xl bg-[#FBF2F0] px-4 py-3 text-sm text-[#4D413E]">{selectedOrder.special_notes}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl border border-[#E9DEDA] px-4 py-2.5 text-sm font-bold text-[#796E6B] transition-colors hover:border-[#C98A84] hover:bg-[#FBF2F0]"
              >
                Close
              </button>
              {selectedOrder.status === "preparing" && (
                <button
                  type="button"
                  onClick={() => {
                    const orderId = selectedOrder.id;
                    setSelectedOrder(null);
                    handleStatusChange(orderId, "completed");
                  }}
                  className="rounded-xl bg-[#C98A84] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#B97872]"
                >
                  Mark done
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
