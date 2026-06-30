"use client";

import {Fetch_to} from "@/utilities";
import { useEffect, useMemo, useState } from "react";
import {useRouter} from "next/navigation";
import api_links from "@/config/fetch_links/api_links.json";
import Sidebar from "@/components/sidebar";


export default function Dashboard() {
    const router = useRouter();
    const [shopName, setShopName] = useState("Shop");
    const [shopId, setShopId] = useState("1");
    const [shopColor, setShopColor] = useState("#073dbe");
    const [orders, setOrders] = useState<any[]>([]);
    const [cashflow, setCashflow] = useState<any[]>([]);
    const [ingredients, setIngredients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const Verify = async () => {
            const response = await Fetch_to(api_links.jwt.verify);
            if (!response.success) return router.push("/");
        };

        Verify();
    }, [router]);

    useEffect(() => {
        const storedShopName = localStorage.getItem("shopName");
        const storedShopId = localStorage.getItem("shopId") || "1";
        const storedShopColor = localStorage.getItem("shopColor");

        if (storedShopName) setShopName(storedShopName);
        setShopId(storedShopId);
        setShopColor(storedShopColor || (storedShopId === "2" ? "#fec107" : "#073dbe"));
    }, []);

    useEffect(() => {
        const loadDashboardMetrics = async () => {
            if (!shopId) return;

            setLoading(true);
            try {
                const headers = { "x-shop-id": shopId };
                const [ordersRes, cashflowRes, ingredientsRes] = await Promise.all([
                    fetch(api_links.tbl_orders, { headers }),
                    fetch(api_links.tbl_cashflow, { headers }),
                    fetch(`${api_links.tbl_ingredients}?shop_id=${shopId}`, { headers }),
                ]);

                const [ordersData, cashflowData, ingredientsData] = await Promise.all([
                    ordersRes.ok ? ordersRes.json() : [],
                    cashflowRes.ok ? cashflowRes.json() : [],
                    ingredientsRes.ok ? ingredientsRes.json() : [],
                ]);

                setOrders(Array.isArray(ordersData) ? ordersData : []);
                setCashflow(Array.isArray(cashflowData) ? cashflowData : []);
                setIngredients(Array.isArray(ingredientsData) ? ingredientsData : []);
            } catch (error) {
                console.error("Failed to load dashboard metrics:", error);
                setOrders([]);
                setCashflow([]);
                setIngredients([]);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardMetrics();
    }, [shopId]);

    const formatMoney = (value: number) => `₱${value.toFixed(2)}`;

    const todayOrders = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfTomorrow = new Date(startOfToday);
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

        return orders.filter((order) => {
            const date = new Date(order.created_at);
            return date >= startOfToday && date < startOfTomorrow;
        });
    }, [orders]);

    const todayRevenue = useMemo(
        () => todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
        [todayOrders]
    );

    const todayCompletedOrdersCount = useMemo(
        () => todayOrders.filter((order) => {
            const status = String(order.status || "").toLowerCase();
            return status.includes("complete") || status.includes("ready") || status.includes("done");
        }).length,
        [todayOrders]
    );

    const pendingOrdersCount = useMemo(
        () => orders.filter((order) => {
            const status = String(order.status || "").toLowerCase();
            return status !== "completed" && status !== "ready" && status !== "done" && status !== "cancelled";
        }).length,
        [orders]
    );

    const lowStockCount = useMemo(
        () => ingredients.filter((ingredient) => Number(ingredient.quantity || 0) <= 5).length,
        [ingredients]
    );

    const stockHealthPercent = useMemo(() => {
        if (!ingredients.length) return 100;
        const low = lowStockCount;
        const healthy = Math.max(0, ingredients.length - low);
        return Math.round((healthy / ingredients.length) * 100);
    }, [ingredients, lowStockCount]);

    const cashflowCount = useMemo(() => cashflow.length, [cashflow]);
    const totalCashflow = useMemo(
        () => cashflow.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
        [cashflow]
    );

    const statusCounts = useMemo(() => {
        const counts = { pending: 0, preparing: 0, completed: 0, cancelled: 0, other: 0 };
        orders.forEach((order) => {
            const status = String(order.status || "pending").toLowerCase();
            if (status.includes("pending")) counts.pending += 1;
            else if (status.includes("prepare") || status.includes("cooking") || status.includes("processing")) counts.preparing += 1;
            else if (status.includes("complete") || status.includes("ready") || status.includes("done")) counts.completed += 1;
            else if (status.includes("cancel")) counts.cancelled += 1;
            else counts.other += 1;
        });
        return counts;
    }, [orders]);

    const weeklyTrend = useMemo(() => {
        const now = new Date();
        const trend: { label: string; total: number; count: number }[] = [];

        for (let offset = 6; offset >= 0; offset -= 1) {
            const day = new Date(now);
            day.setDate(now.getDate() - offset);
            day.setHours(0, 0, 0, 0);
            const nextDay = new Date(day);
            nextDay.setDate(day.getDate() + 1);

            const label = day.toLocaleDateString("en-US", { weekday: "short" });
            const dayOrders = orders.filter((order) => {
                const orderDate = new Date(order.created_at);
                return orderDate >= day && orderDate < nextDay;
            });
            const total = dayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
            const count = dayOrders.length;

            trend.push({ label, total, count });
        }

        return trend;
    }, [orders]);

    const topSellingProducts = useMemo(() => {
        const products = new Map<string, { product: string; variant: string; quantity: number; revenue: number }>();

        orders.forEach((order) => {
            (order.items || []).forEach((item: any) => {
                const productName = item.product_name || "Unknown";
                const variantName = item.variant_name || "Default";
                const key = `${productName}||${variantName}`;
                const current = products.get(key) || {
                    product: productName,
                    variant: variantName,
                    quantity: 0,
                    revenue: 0,
                };

                current.quantity += Number(item.quantity || 0);
                current.revenue += Number(item.subtotal || 0);
                products.set(key, current);
            });
        });

        return Array.from(products.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 4);
    }, [orders]);

    const topLowStockItems = useMemo(
        () =>
            [...ingredients]
                .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0))
                .slice(0, 4),
        [ingredients]
    );

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6">
                    

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 mb-8 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-sm uppercase tracking-[0.24em] text-slate-400 mb-2">Welcome back</p>
                                <h2 className="text-3xl font-bold text-slate-900">Hello, {shopName} !</h2>
                                <p className="mt-3 max-w-2xl text-slate-600">Here is your latest store overview with inventory health, top sales, and order performance.</p>
                            </div>
                            <div className="rounded-3xl bg-slate-50 p-4 text-slate-700">
                                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Today</p>
                                <p className="mt-2 text-lg font-semibold">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                            </div>
                        </div>
                    </div>

                    {/* Data Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                        <div className="bg-linear-to-br from-green-500 to-green-600 text-white rounded-3xl p-5 shadow-lg">
                            <p className="text-sm uppercase tracking-[0.2em] opacity-80">Revenue</p>
                            <p className="mt-4 text-3xl font-black">{formatMoney(todayRevenue)}</p>
                            <p className="mt-3 text-xs opacity-80">Today</p>
                        </div>
                        <div className="bg-linear-to-br from-sky-500 to-blue-600 text-white rounded-3xl p-5 shadow-lg">
                            <p className="text-sm uppercase tracking-[0.2em] opacity-80">Completed Orders</p>
                            <p className="mt-4 text-3xl font-black">{todayCompletedOrdersCount}</p>
                            <p className="mt-3 text-xs opacity-80">Today</p>
                        </div>
                        <div className="bg-linear-to-br from-rose-500 to-red-600 text-white rounded-3xl p-5 shadow-lg">
                            <p className="text-sm uppercase tracking-[0.2em] opacity-80">Low Stock</p>
                            <p className="mt-4 text-3xl font-black">{lowStockCount}</p>
                            <p className="mt-3 text-xs opacity-80">Items ≤ 5 qty</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 mb-8">
                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900">Sales trend</h2>
                                    <p className="text-sm text-slate-500">Last 7 days</p>
                                </div>
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                    {formatMoney(weeklyTrend.reduce((sum, day) => sum + day.total, 0))}
                                </span>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Revenue
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Orders
                                </span>
                            </div>
                            <p className="mt-4 text-sm text-slate-500">Daily revenue and order volume for the past week. Taller bars mean higher sales and the count label shows orders per day. The value above is the total revenue for these seven days.</p>
                            <div className="mt-4">
                                <div className="grid h-40 grid-cols-7 gap-2 rounded-3xl bg-slate-50 p-4">
                                    {weeklyTrend.map((day) => {
                                        const maxTotal = Math.max(...weeklyTrend.map((trendDay) => trendDay.total), 1);
                                        const barHeight = Math.max(16, Math.round((day.total / maxTotal) * 120));
                                        return (
                                            <div key={day.label} className="flex h-full flex-col items-center gap-2">
                                                <div className="flex h-full w-full items-end">
                                                    <div className="w-full rounded-t-2xl bg-sky-500" style={{ height: `${barHeight}px` }} />
                                                </div>
                                                <div className="text-[10px] text-slate-500 text-center">
                                                    <div>{day.label}</div>
                                                    <div>{day.count} orders</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900">Order status</h2>
                                    <p className="text-sm text-slate-500">Current breakdown</p>
                                </div>
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{orders.length} total</span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Pending / open
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Preparing
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Completed
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Cancelled
                                </span>
                            </div>
                            <p className="mt-4 text-sm text-slate-500">This chart shows where orders currently stand, from pending to preparing to completed and cancelled.</p>
                            <div className="mt-6 space-y-4">
                                {Object.entries(statusCounts).map(([key, value]) => (
                                    <div key={key} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm text-slate-600"><span>{key.charAt(0).toUpperCase() + key.slice(1)}</span><span>{value}</span></div>
                                        <div className="h-3 rounded-full bg-slate-100">
                                            <div className={`h-3 rounded-full ${key === 'completed' ? 'bg-emerald-500' : key === 'cancelled' ? 'bg-rose-500' : key === 'preparing' ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${orders.length ? (value / orders.length) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900">Top Sales</h2>
                                    <p className="text-sm text-slate-500">Best-selling products</p>
                                </div>
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{topSellingProducts.length} items</span>
                            </div>
                            <div className="mt-6 space-y-4 text-sm text-slate-600">
                                {topSellingProducts.length > 0 ? (
                                    topSellingProducts.map((item) => (
                                        <div key={`${item.product}-${item.variant}`} className="flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="truncate text-slate-900 font-semibold">{item.product}</p>
                                                <p className="text-xs text-slate-500">{item.variant}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-slate-900">{item.quantity} sold</p>
                                                <p className="text-xs text-slate-500">{formatMoney(item.revenue)}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500">No sales data available yet.</p>
                                )}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900">Inventory health</h2>
                                    <p className="text-sm text-slate-500">Low stock items</p>
                                </div>
                                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">{lowStockCount} low</span>
                            </div>
                            <div className="mt-6 space-y-4 text-sm text-slate-600">
                                {topLowStockItems.map((item) => (
                                    <div key={item.id}>
                                        <div className="flex justify-between mb-2"><span>{item.ingredient_name || item.name || "Item"}</span><span>{Number(item.quantity || 0)}</span></div>
                                        <div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-rose-500" style={{ width: `${Math.min(100, (Number(item.quantity || 0) / 10) * 100)}%` }}></div></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    
                </div>
            </div>
        </div>
    );
}