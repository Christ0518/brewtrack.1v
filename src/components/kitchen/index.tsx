"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";

interface Order {
  id: number;
  order_number: string;
  items: Array<{
    product_name: string;
    quantity: number;
    variant: string;
  }>;
  status: "pending" | "preparing" | "completed";
  created_at: string;
  special_notes?: string;
  customer_name?: string;
}

export default function KitchenDisplay() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const buildOrderNumber = (id: number) => `ORD-${String(id).padStart(3, "0")}`;

  const loadOrders = async () => {
    const storedShopId = localStorage.getItem("shopId") || "1";

    const response = await fetch(api_links.tbl_orders, {
      headers: {
        "x-shop-id": storedShopId,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load orders: ${response.status} - ${errorText.substring(0, 120)}`);
    }

    const data = await response.json();
    const normalizedOrders: Order[] = (Array.isArray(data) ? data : []).map((order: any) => ({
      id: Number(order.id),
      order_number: order.order_number || buildOrderNumber(Number(order.id)),
      items: Array.isArray(order.items)
        ? order.items.map((item: any) => ({
            product_name: item.product_name || "Unknown item",
            quantity: Number(item.quantity) || 0,
            variant: item.variant_name || item.variant || "Default",
          }))
        : [],
      status: order.status,
      created_at: order.created_at,
      special_notes: order.notes || order.special_notes || undefined,
      customer_name: order.customer_name || undefined,
    }));

    setOrders(normalizedOrders);
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
    console.log("DEBUG KITCHEN - storedUser:", storedUser);
    
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

    return () => clearInterval(refreshInterval);
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleStatusChange = async (orderId: number, newStatus: "pending" | "preparing" | "completed") => {
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
        currentOrders.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
    } catch (error) {
      console.error("Failed to update order status:", error);
    }
  };

  const getTimeElapsed = (createdAt: string) => {
    const minutes = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / 60000
    );
    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 min";
    return `${minutes} mins`;
  };

  const getCurrentDateTime = () => {
    return `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-red-50 border-red-200";
      case "preparing":
        return "bg-yellow-50 border-yellow-200";
      case "completed":
        return "bg-green-50 border-green-200";
      default:
        return "bg-slate-50 border-slate-200";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-red-100 text-red-700";
      case "preparing":
        return "bg-yellow-100 text-yellow-700";
      case "completed":
        return "bg-green-100 text-green-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#073dbe] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-700 font-medium">Loading kitchen display...</p>
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const completedOrders = orders.filter((o) => o.status === "completed");

  return (
    <div className="min-h-screen bg-white p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-slate-900">
                Kitchen Display System
              </h1>
              <p className="text-slate-600 mt-2">
                {orders.length} total orders • {pendingOrders.length} pending • {preparingOrders.length} preparing
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-600 text-sm mb-3">
                {new Date().toLocaleTimeString()}
              </p>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition-colors text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Orders */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <h2 className="text-xl font-bold text-slate-900">
                Pending ({pendingOrders.length})
              </h2>
            </div>
            <div className="space-y-3">
              {pendingOrders.length > 0 ? (
                pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`border-2 rounded-lg p-4 ${getStatusColor(order.status)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">
                          {order.order_number}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1">
                          {getTimeElapsed(order.created_at)} ago
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusBadgeColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4 bg-white rounded p-2">
                      <div className="pb-2 border-b border-slate-200">
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-700">Name:</span> {order.customer_name || "Walk-in"}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          <span className="font-semibold text-slate-700">Current:</span> {getCurrentDateTime()}
                        </p>
                      </div>
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-slate-600">
                              {item.variant}
                            </p>
                          </div>
                          <span className="font-bold text-slate-900">
                            ×{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.special_notes && (
                      <div className="mb-3 p-2 bg-white rounded border-l-4 border-orange-500">
                        <p className="text-xs font-semibold text-slate-700">
                          Notes:
                        </p>
                        <p className="text-sm text-slate-600">
                          {order.special_notes}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => handleStatusChange(order.id, "preparing")}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded transition-colors"
                    >
                      Start Preparing
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No pending orders
                </div>
              )}
            </div>
          </div>

          {/* Preparing Orders */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              <h2 className="text-xl font-bold text-slate-900">
                Preparing ({preparingOrders.length})
              </h2>
            </div>
            <div className="space-y-3">
              {preparingOrders.length > 0 ? (
                preparingOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`border-2 rounded-lg p-4 ${getStatusColor(order.status)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">
                          {order.order_number}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1">
                          {getTimeElapsed(order.created_at)} ago
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusBadgeColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4 bg-white rounded p-2">
                      <div className="pb-2 border-b border-slate-200">
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-700">Name:</span> {order.customer_name || "Walk-in"}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          <span className="font-semibold text-slate-700">Current:</span> {getCurrentDateTime()}
                        </p>
                      </div>
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-slate-600">
                              {item.variant}
                            </p>
                          </div>
                          <span className="font-bold text-slate-900">
                            ×{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleStatusChange(order.id, "completed")}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded transition-colors"
                    >
                      Mark Complete
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No orders being prepared
                </div>
              )}
            </div>
          </div>

          {/* Completed Orders */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <h2 className="text-xl font-bold text-slate-900">
                Completed ({completedOrders.length})
              </h2>
            </div>
            <div className="space-y-3">
              {completedOrders.length > 0 ? (
                completedOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`border-2 rounded-lg p-4 ${getStatusColor(order.status)} opacity-75`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">
                          {order.order_number}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1">
                          Ready for pickup
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusBadgeColor(order.status)}`}>
                        ✓ Done
                      </span>
                    </div>

                    <div className="space-y-2 bg-white rounded p-2">
                      <div className="pb-2 border-b border-slate-200">
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-700">Name:</span> {order.customer_name || "Walk-in"}
                        </p>
                        
                      </div>
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-slate-600">
                              {item.variant}
                            </p>
                          </div>
                          <span className="font-bold text-slate-900">
                            ×{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No completed orders
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
