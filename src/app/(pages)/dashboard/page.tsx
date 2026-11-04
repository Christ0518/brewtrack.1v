"use client";

import {Fetch_to} from "@/utilities";
import { useEffect, useMemo, useState } from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import api_links from "@/config/fetch_links/api_links.json";
import Sidebar from "@/components/sidebar";
import {
    FiAlertCircle,
    FiArrowUpRight,
    FiBarChart2,
    FiBox,
    FiCheckCircle,
    FiClock,
    FiCoffee,
    FiDollarSign,
    FiLayers,
    FiShoppingBag,
} from "react-icons/fi";


export default function Dashboard() {
    const router = useRouter();
    const [shopName, setShopName] = useState("Shop");
    const [shopId, setShopId] = useState("1");
    const [orders, setOrders] = useState<any[]>([]);
    const [cashflow, setCashflow] = useState<any[]>([]);
    const [ingredients, setIngredients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState("");

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
        const storedUser = localStorage.getItem("user");

        if (storedShopName) setShopName(storedShopName);
        setShopId(storedShopId);
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser) as { role?: string; user_role?: string; userRole?: string };
                setUserRole(String(user.role || user.user_role || user.userRole || "").trim().toLowerCase());
            } catch (error) {
                console.error("Failed to parse dashboard user data:", error);
            }
        }
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
        () => todayOrders
            .filter((order) => String(order.status || "").toLowerCase() === "completed")
            .reduce((sum, order) => sum + Number(order.total || 0), 0),
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

        orders
            .filter((order) => String(order.status || "").toLowerCase() === "completed")
            .forEach((order) => {
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
        <div className="flex min-h-screen bg-[#FAF6F4] text-[#2D2626]" aria-busy={loading}>
            <Sidebar />
            <main className="min-h-screen min-w-0 flex-1 px-4 pb-8 pt-20 sm:px-6 lg:px-8 lg:py-8">
                <div className="mx-auto max-w-[1600px] space-y-7">
                    <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#9B7773]">Point of sale · Overview</p>
                            <h1 className="text-3xl font-bold tracking-tight text-[#2D2626] sm:text-4xl">Good day, {shopName}</h1>
                            <p className="mt-2 text-sm text-[#796E6B] sm:text-base">Here’s what’s happening in your shop today.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {(userRole === "admin" || userRole === "cashier") && (
                                <a
                                    href="/order"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 rounded-2xl bg-[#C98A84] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#B97872] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A65F58]"
                                >
                                    <FiShoppingBag aria-hidden="true" className="h-5 w-5" />
                                    Mobile Order
                                    <FiArrowUpRight aria-hidden="true" className="h-4 w-4" />
                                </a>
                            )}
                            <div className="rounded-2xl border border-[#E9DFDB] bg-white/80 px-4 py-3 shadow-sm">
                                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9B8883]">Today</p>
                                <p className="mt-1 text-sm font-semibold text-[#2D2626]">{todayLabel || "Loading date…"}</p>
                            </div>

                        </div>
                    </header>

                    <section aria-label="Today's key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                        <article className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#796E6B]">Sales today</p>
                                    <p className="mt-3 text-3xl font-bold tracking-tight text-[#2D2626]">{formatMoney(todayRevenue)}</p>
                                </div>
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F8EDEA] text-[#B97973]"><FiDollarSign aria-hidden="true" className="h-5 w-5" /></span>
                            </div>
                            <p className="mt-3 text-xs text-[#968984]">Completed orders only</p>
                        </article>
                        <article className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#796E6B]">Completed orders</p>
                                    <p className="mt-3 text-3xl font-bold tracking-tight text-[#2D2626]">{todayCompletedOrdersCount}</p>
                                </div>
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EC] text-[#5E8B68]"><FiCheckCircle aria-hidden="true" className="h-5 w-5" /></span>
                            </div>
                            <p className="mt-3 text-xs text-[#968984]">Today</p>
                        </article>
                        <article className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#796E6B]">Pending orders</p>
                                    <p className="mt-3 text-3xl font-bold tracking-tight text-[#2D2626]">{pendingOrdersCount}</p>
                                </div>
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FBF1DF] text-[#B1843F]"><FiClock aria-hidden="true" className="h-5 w-5" /></span>
                            </div>
                            <p className="mt-3 text-xs text-[#968984]">Need attention</p>
                        </article>
                        <article className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#796E6B]">Low stock</p>
                                    <p className="mt-3 text-3xl font-bold tracking-tight text-[#2D2626]">{lowStockCount}</p>
                                </div>
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F8EDEA] text-[#B97973]"><FiAlertCircle aria-hidden="true" className="h-5 w-5" /></span>
                            </div>
                            <p className="mt-3 text-xs text-[#968984]">Ingredients at 5 or less</p>
                        </article>
                    </section>

                    <section aria-label="Quick actions">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-[#2D2626]">Quick actions</h2>
                                <p className="mt-0.5 text-sm text-[#8A7C78]">Jump back into your daily workflow.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            {[
                                { label: "Product catalog", detail: "Manage menu items", href: "/dashboard/products", icon: FiCoffee, tint: "bg-[#F8EDEA] text-[#B97973]" },
                                { label: "Ingredients", detail: "Check stock levels", href: "/dashboard/ingredients", icon: FiLayers, tint: "bg-[#F1EAE4] text-[#8C6F5C]" },
                                { label: "Sales reports", detail: "Review performance", href: "/dashboard/reports", icon: FiBarChart2, tint: "bg-[#EAF3EC] text-[#5E8B68]" },
                                { label: "Transactions", detail: "View recent orders", href: "/dashboard/transactions", icon: FiBox, tint: "bg-[#FBF1DF] text-[#B1843F]" },
                            ].map((action) => (
                                <Link
                                    key={action.label}
                                    href={action.href}
                                    className="group flex min-h-[92px] items-center gap-3 rounded-2xl border border-[#E9DFDB] bg-[#ECE6E2] p-4 transition hover:-translate-y-0.5 hover:border-[#D6B4AE] hover:bg-white hover:shadow-[0_12px_28px_rgba(69,47,39,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84] sm:gap-4 sm:p-5"
                                >
                                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.tint}`}><action.icon aria-hidden="true" className="h-5 w-5" /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-bold text-[#382F2D]">{action.label}</span>
                                        <span className="mt-1 block truncate text-xs text-[#8A7C78]">{action.detail}</span>
                                    </span>
                                    <FiArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#AE9690] transition group-hover:text-[#B97973]" />
                                </Link>
                            ))}
                        </div>
                    </section>

                    <section aria-label="Business performance" className="grid grid-cols-1 gap-5 2xl:grid-cols-3">
                        <article className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:p-6 2xl:col-span-2">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-[#2D2626]">Sales trend</h2>
                                    <p className="mt-1 text-sm text-[#8A7C78]">Revenue over the last 7 days</p>
                                </div>
                                <div className="rounded-xl bg-[#F5EFEC] px-4 py-2 text-right">
                                    <p className="text-xs font-medium text-[#8A7C78]">7-day total</p>
                                    <p className="mt-0.5 text-base font-bold text-[#2D2626]">{formatMoney(weeklyTrend.reduce((sum, day) => sum + day.total, 0))}</p>
                                </div>
                            </div>
                            <div className="mt-7 grid h-52 grid-cols-7 items-end gap-2 sm:gap-4" role="img" aria-label="Bar chart of daily revenue for the past seven days">
                                {weeklyTrend.map((day) => {
                                    const maxTotal = Math.max(...weeklyTrend.map((trendDay) => trendDay.total), 1);
                                    const barHeight = day.total > 0 ? Math.max((day.total / maxTotal) * 100, 6) : 3;
                                    return (
                                        <div key={day.label} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                                            <span className="text-[11px] font-medium text-[#968984] sm:text-xs">{day.count}</span>
                                            <div className="flex h-36 w-full items-end rounded-lg bg-[#F5EFEC]">
                                                <div className="w-full rounded-lg bg-[#C98A84] transition-[height] duration-300" style={{ height: `${barHeight}%` }} title={`${day.label}: ${formatMoney(day.total)} · ${day.count} orders`} />
                                            </div>
                                            <span className="text-xs font-medium text-[#796E6B]">{day.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="mt-4 text-xs text-[#968984]">Order count shown above each bar.</p>
                        </article>

                        <article className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-[#2D2626]">Order status</h2>
                                    <p className="mt-1 text-sm text-[#8A7C78]">Current breakdown</p>
                                </div>
                                <span className="rounded-full bg-[#F5EFEC] px-3 py-1 text-sm font-semibold text-[#75615C]">{orders.length} total</span>
                            </div>
                            <div className="mt-7 space-y-5">
                                {Object.entries(statusCounts).map(([key, value]) => (
                                    <div key={key}>
                                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                                            <span className="font-medium capitalize text-[#796E6B]">{key}</span>
                                            <span className="font-semibold tabular-nums text-[#2D2626]">{value}</span>
                                        </div>
                                        <div className="h-2.5 overflow-hidden rounded-full bg-[#F0E9E6]" role="progressbar" aria-label={`${key} orders`} aria-valuemin={0} aria-valuemax={orders.length} aria-valuenow={value}>
                                            <div
                                                className={`h-full rounded-full ${key === "completed" ? "bg-[#78A184]" : key === "cancelled" ? "bg-[#B9AAA5]" : key === "preparing" ? "bg-[#C98A84]" : "bg-[#D4AC68]"}`}
                                                style={{ width: `${orders.length ? (value / orders.length) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </article>
                    </section>

                    <section aria-label="Product and inventory details" className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
                        <article className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-[#2D2626]">Top-selling products</h2>
                                    <p className="mt-1 text-sm text-[#8A7C78]">Ranked by revenue</p>
                                </div>
                                <span className="rounded-full bg-[#F5EFEC] px-3 py-1 text-sm font-semibold text-[#75615C]">{topSellingProducts.length} items</span>
                            </div>
                            {topSellingProducts.length > 0 ? (
                                <ul className="mt-5 divide-y divide-[#F0E9E6]">
                                    {topSellingProducts.map((item, index) => (
                                        <li key={`${item.product}-${item.variant}`} className="flex min-h-16 items-center justify-between gap-4 py-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F8EDEA] text-sm font-bold text-[#B97973]">{index + 1}</span>
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-[#382F2D]">{item.product}</p>
                                                    <p className="truncate text-sm text-[#8A7C78]">{item.variant}</p>
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="font-semibold text-[#382F2D]">{item.quantity} sold</p>
                                                <p className="text-sm text-[#8A7C78]">{formatMoney(item.revenue)}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-5 rounded-xl bg-[#F8F4F2] px-4 py-6 text-sm text-[#8A7C78]">Sales data will appear here once orders are placed.</p>
                            )}
                        </article>

                        <article className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-[#2D2626]">Inventory health</h2>
                                    <p className="mt-1 text-sm text-[#8A7C78]">Ingredients needing attention</p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${lowStockCount ? "bg-[#F8EDEA] text-[#A76560]" : "bg-[#EAF3EC] text-[#527B5B]"}`}>
                                    {lowStockCount ? `${lowStockCount} low` : "All stocked"}
                                </span>
                            </div>
                            <div className="mt-5">
                                <div className="mb-2 flex items-center justify-between text-sm">
                                    <span className="font-medium text-[#796E6B]">Healthy stock</span>
                                    <span className="font-semibold text-[#2D2626]">{stockHealthPercent}%</span>
                                </div>
                                <div className="h-2.5 overflow-hidden rounded-full bg-[#F0E9E6]" role="progressbar" aria-label="Healthy stock" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stockHealthPercent}>
                                    <div className="h-full rounded-full bg-[#78A184]" style={{ width: `${stockHealthPercent}%` }} />
                                </div>
                            </div>
                            {topLowStockItems.length > 0 ? (
                                <ul className="mt-5 divide-y divide-[#F0E9E6]">
                                    {topLowStockItems.map((item) => (
                                        <li key={item.id} className="flex min-h-14 items-center justify-between gap-4 py-3">
                                            <span className="min-w-0 truncate font-medium text-[#796E6B]">{item.ingredient_name || item.name || "Item"}</span>
                                            <span className="shrink-0 rounded-lg bg-[#F8EDEA] px-3 py-1.5 text-sm font-semibold tabular-nums text-[#A76560]">{Number(item.quantity || 0)} left</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-5 rounded-xl bg-[#F8F4F2] px-4 py-6 text-sm text-[#8A7C78]">No low-stock ingredients to show.</p>
                            )}
                        </article>
                    </section>
                </div>
            </main>
        </div>
    );
}