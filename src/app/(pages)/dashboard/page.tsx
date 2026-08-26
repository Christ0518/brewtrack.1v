"use client";

import {Fetch_to} from "@/utilities";
import { useEffect, useMemo, useState } from "react";
import {useRouter} from "next/navigation";
import api_links from "@/config/fetch_links/api_links.json";
import Sidebar from "@/components/sidebar";
import { getShopTheme } from "@/lib/theme";


export default function Dashboard() {
    const router = useRouter();
    const [shopName, setShopName] = useState("Shop");
    const [shopId, setShopId] = useState("1");
    const [shopColor, setShopColor] = useState("#6c3030");
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
        setShopColor(storedShopId === "1" ? getShopTheme(storedShopId).accentColor : storedShopColor || getShopTheme(storedShopId).accentColor);
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

    const [todayLabel, setTodayLabel] = useState("");

    useEffect(() => {
        setTodayLabel(new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
    }, []);

    return (
        <div className="flex h-screen bg-cream">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6">
                    

                    <div className="rounded-3xl border border-beige bg-white p-6 mb-8 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-sm uppercase tracking-[0.24em] text-primary mb-2">Welcome back</p>
                                <h2 className="text-3xl font-bold text-primary">Hello, {shopName} !</h2>
                                <p className="mt-3 max-w-2xl text-primary">Here is your latest store overview with inventory health, top sales, and order performance.</p>
                            </div>
                            <div className="rounded-3xl bg-cream p-4 text-primary">
                                <p className="text-xs uppercase tracking-[0.24em] text-[#6e5338]">Today</p>
                                <p className="mt-2 text-lg font-semibold">{todayLabel || "Loading..."}</p>
                            </div>
                        </div>
                    </div>

                    {/* Data Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                        <div className="rounded-3xl p-5 shadow-lg bg-sales">
                            <p className="text-sm uppercase tracking-[0.2em] opacity-80">Sales</p>
                            <p className="mt-4 text-3xl font-black">{formatMoney(todayRevenue)}</p>
                            <p className="mt-3 text-xs opacity-80">Today</p>
                        </div>
                        <div className="rounded-3xl p-5 shadow-lg bg-sales">
                            <p className="text-sm uppercase tracking-[0.2em] opacity-80">Completed Orders</p>
                            <p className="mt-4 text-3xl font-black">{todayCompletedOrdersCount}</p>
                            <p className="mt-3 text-xs opacity-80">Today</p>
                        </div>
                        <div className="rounded-3xl p-5 shadow-lg bg-lowstock">
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
                            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-primary">
                                <span className="inline-flex items-center gap-2 rounded-full border border-beige bg-pale px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-tan" /> Revenue
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-beige bg-pale px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Orders
                                </span>
                            </div>
                            <p className="mt-4 text-sm text-primary">Daily revenue and order volume for the past week. The line shows revenue changes over time and points show each day's sales.</p>
                            <div className="mt-4 rounded-3xl bg-[#f8f1e8] p-4">
                                <div className="relative h-40">
                                    <svg viewBox="0 0 320 160" className="h-full w-full">
                                        <defs>
                                            <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" stopColor="#bc9b7a" stopOpacity="0.9" />
                                                <stop offset="100%" stopColor="#bc9b7a" stopOpacity="0.1" />
                                            </linearGradient>
                                        </defs>
                                        <path
                                            d={(() => {
                                                const maxTotal = Math.max(...weeklyTrend.map((trendDay) => trendDay.total), 1);
                                                const chartWidth = 320;
                                                const chartHeight = 120;
                                                const points = weeklyTrend.map((day, index) => {
                                                    const x = index * (chartWidth / Math.max(weeklyTrend.length - 1, 1));
                                                    const y = chartHeight - (day.total / maxTotal) * chartHeight + 20;
                                                    return { x, y };
                                                });
                                                return points.reduce(
                                                    (path, point, index) =>
                                                        index === 0
                                                            ? `M ${point.x} ${point.y}`
                                                            : `${path} L ${point.x} ${point.y}`,
                                                    ""
                                                );
                                            })()}
                                            fill="none"
                                            stroke="#6c3030"
                                            strokeWidth="3"
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                        />
                                        {weeklyTrend.map((day, index) => {
                                            const maxTotal = Math.max(...weeklyTrend.map((trendDay) => trendDay.total), 1);
                                            const chartWidth = 320;
                                            const chartHeight = 120;
                                            const x = index * (chartWidth / Math.max(weeklyTrend.length - 1, 1));
                                            const y = chartHeight - (day.total / maxTotal) * chartHeight + 20;
                                            return (
                                                <g key={day.label}>
                                                    <circle cx={x} cy={y} r="4" fill="#6c3030" />
                                                    <circle cx={x} cy={y} r="10" fill="transparent" />
                                                </g>
                                            );
                                        })}
                                        <path
                                            d={(() => {
                                                const maxTotal = Math.max(...weeklyTrend.map((trendDay) => trendDay.total), 1);
                                                const chartWidth = 320;
                                                const chartHeight = 120;
                                                const points = weeklyTrend.map((day, index) => {
                                                    const x = index * (chartWidth / Math.max(weeklyTrend.length - 1, 1));
                                                    const y = chartHeight - (day.total / maxTotal) * chartHeight + 20;
                                                    return `${x},${y}`;
                                                });
                                                return `M0,160 L${points.join(" L ")} L320,160 Z`;
                                            })()}
                                            fill="url(#trendGradient)"
                                            opacity="0.4"
                                        />
                                    </svg>
                                </div>
                                <div className="mt-4 grid grid-cols-7 gap-2 text-[10px] text-primary">
                                    {weeklyTrend.map((day) => (
                                        <div key={day.label} className="text-center">
                                            <div>{day.label}</div>
                                            <div>{day.count} orders</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-beige bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-base font-semibold text-primary">Order status</h2>
                                    <p className="text-sm text-primary">Current breakdown</p>
                                </div>
                                <span className="rounded-full chip-bg px-3 py-1 text-xs font-semibold text-primary">{orders.length} total</span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2 text-xs text-primary">
                                <span className="inline-flex items-center gap-2 rounded-full border border-beige bg-pale px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-tan" /> Pending / open
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-beige bg-pale px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Preparing
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-beige bg-pale px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-deep" /> Completed
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-beige bg-pale px-3 py-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-deep" /> Cancelled
                                </span>
                            </div>
                            <p className="mt-4 text-sm text-primary">This chart shows where orders currently stand, from pending to preparing to completed and cancelled.</p>
                            <div className="mt-6 space-y-4">
                                {Object.entries(statusCounts).map(([key, value]) => (
                                    <div key={key} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm text-primary"><span>{key.charAt(0).toUpperCase() + key.slice(1)}</span><span>{value}</span></div>
                                        <div className="h-3 rounded-full bg-pale">
                                            <div className={`h-3 rounded-full ${key === 'completed' ? 'bg-deep' : key === 'cancelled' ? 'bg-deep' : key === 'preparing' ? 'bg-primary' : 'bg-tan'}`} style={{ width: `${orders.length ? (value / orders.length) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-beige bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-base font-semibold text-primary">Top Sales</h2>
                                    <p className="text-sm text-primary">Best-selling products</p>
                                </div>
                                <span className="rounded-full chip-bg px-3 py-1 text-xs font-semibold text-primary">{topSellingProducts.length} items</span>
                            </div>
                            <div className="mt-6 space-y-4 text-sm text-[#6e5338]">
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

                            <div className="rounded-3xl border border-beige bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-base font-semibold text-primary">Inventory health</h2>
                                    <p className="text-sm text-primary">Low stock items</p>
                                </div>
                                <span className="rounded-full chip-bg px-3 py-1 text-xs font-semibold text-primary">{lowStockCount} low</span>
                            </div>
                            <div className="mt-6 space-y-4 text-sm text-[#6e5338]">
                                {topLowStockItems.map((item) => (
                                    <div key={item.id}>
                                        <div className="flex justify-between mb-2"><span>{item.ingredient_name || item.name || "Item"}</span><span>{Number(item.quantity || 0)}</span></div>
                                        <div className="h-3 rounded-full bg-pale"><div className="h-3 rounded-full bg-deep" style={{ width: `${Math.min(100, (Number(item.quantity || 0) / 10) * 100)}%` }}></div></div>
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