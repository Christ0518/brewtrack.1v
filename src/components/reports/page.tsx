"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import Sidebar from "@/components/sidebar";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiDownload,
  FiPrinter,
  FiShoppingCart,
  FiTrendingUp,
} from "react-icons/fi";

type ReportType = "daily" | "weekly" | "monthly" | "yearly";
type NetIncomePeriod = "weekly" | "monthly" | "quarterly" | "semiAnnual" | "annual";

type OrderItem = {
  product_name: string;
  variant_name?: string;
  quantity: number;
  subtotal?: number;
  discount_type?: string | null;
  discount?: number;
};

type Order = {
  id: number;
  created_at: string;
  total: number;
  customer_name?: string;
  status?: string;
  notes?: string | null;
  items: OrderItem[];
};

type Transaction = {
  id: number;
  type: "payin" | "payout" | string;
  category: string;
  description: string;
  amount: number;
  date: string;
  reference?: string | null;
  created_at?: string;
};

type ModalState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

type SalesItemStat = {
  product: string;
  variant: string;
  quantity: number;
  revenue: number;
};

function formatMoney(value: number) {
  return `₱${value.toFixed(2)}`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function ReportsPage() {
  const router = useRouter();
  const [shopName, setShopName] = useState("Shop");
  const [shopColor, setShopColor] = useState("#073dbe");
  const [shopId, setShopId] = useState("1");
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedNetIncomePeriod, setSelectedNetIncomePeriod] = useState<NetIncomePeriod>("monthly");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ show: false, type: "success", message: "" });

  useEffect(() => {
    const storedShopName = localStorage.getItem("shopName");
    const storedShopId = localStorage.getItem("shopId") || "1";
    const storedShopColor = localStorage.getItem("shopColor");

    if (storedShopName) setShopName(storedShopName);
    setShopId(storedShopId);
    setShopColor(storedShopColor || (storedShopId === "2" ? "#fec107" : "#073dbe"));
  }, []);

  useEffect(() => {
    const verify = async () => {
      const response = await Fetch_to(api_links.jwt.verify);
      if (!response.success) router.push("/");
    };

    verify();
  }, [router]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const headers = { "x-shop-id": shopId };

        const [ordersRes, cashflowRes] = await Promise.all([
          fetch(api_links.tbl_orders, { headers }),
          fetch(api_links.tbl_cashflow, { headers }),
        ]);

        if (!ordersRes.ok) {
          throw new Error(`Failed to load orders: ${ordersRes.status}`);
        }

        if (!cashflowRes.ok) {
          throw new Error(`Failed to load transactions: ${cashflowRes.status}`);
        }

        const ordersData = await ordersRes.json();
        const cashflowData = await cashflowRes.json();

        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setTransactions(Array.isArray(cashflowData) ? cashflowData : []);
      } catch (error) {
        console.error("Failed to load report data:", error);
        setModal({ show: true, type: "error", message: "Failed to load report data. Please try again." });
      } finally {
        setLoading(false);
      }
    };

    if (shopId) {
      loadData();
    }
  }, [shopId]);

  const showModal = (type: "success" | "error", message: string) => {
    setModal({ show: true, type, message });
  };

  const closeModal = () => setModal((current) => ({ ...current, show: false }));

  const getDiscountAmount = (order: Order) => {
    return (order.items || []).reduce((sum, item) => {
      if (item.discount_type === "senior" || item.discount_type === "pwd") {
        return sum + 5;
      }
      return sum;
    }, 0);
  };

  const filterOrdersByPeriod = useMemo(() => {
    const now = new Date();

    return orders.filter((order) => {
      const orderDate = new Date(order.created_at);

      switch (reportType) {
        case "daily": {
          const selected = new Date(selectedDate);
          return orderDate.toDateString() === selected.toDateString();
        }
        case "weekly": {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          return orderDate >= weekStart && orderDate <= weekEnd;
        }
        case "monthly": {
          const [year, month] = selectedMonth.split("-");
          return orderDate.getFullYear() === Number(year) && orderDate.getMonth() === Number(month) - 1;
        }
        case "yearly":
          return orderDate.getFullYear() === Number(selectedYear);
        default:
          return true;
      }
    });
  }, [orders, reportType, selectedDate, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    const totalSales = filterOrdersByPeriod.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const totalOrders = filterOrdersByPeriod.length;
    const totalDiscount = filterOrdersByPeriod.reduce((sum, order) => sum + getDiscountAmount(order), 0);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    const productSales = new Map<string, SalesItemStat>();
    filterOrdersByPeriod.forEach((order) => {
      order.items?.forEach((item) => {
        const key = `${item.product_name} - ${item.variant_name || "Default"}`;
        const current = productSales.get(key) || {
          product: item.product_name,
          variant: item.variant_name || "Default",
          quantity: 0,
          revenue: 0,
        };

        current.quantity += Number(item.quantity || 0);
        current.revenue += Number(item.subtotal || item.quantity * (order.total || 0));
        productSales.set(key, current);
      });
    });

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const payIn = transactions.filter((tx) => tx.type === "payin").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const payOut = transactions.filter((tx) => tx.type === "payout").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    return {
      totalSales,
      totalOrders,
      totalDiscount,
      averageOrderValue,
      topProducts,
      payIn,
      payOut,
      balance: payIn - payOut,
    };
  }, [filterOrdersByPeriod, transactions]);

  const netIncomeByPeriod = useMemo(() => {
    const now = new Date();

    const getPeriodOrders = (periodType: NetIncomePeriod) => {
      return orders.filter((order) => {
        const orderDate = new Date(order.created_at);

        switch (periodType) {
          case "weekly": {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            return orderDate >= weekStart && orderDate <= weekEnd;
          }
          case "monthly":
            return orderDate.getFullYear() === now.getFullYear() && orderDate.getMonth() === now.getMonth();
          case "quarterly": {
            const quarter = Math.floor(now.getMonth() / 3);
            return orderDate.getFullYear() === now.getFullYear() && Math.floor(orderDate.getMonth() / 3) === quarter;
          }
          case "semiAnnual": {
            const half = now.getMonth() < 6 ? 0 : 1;
            return orderDate.getFullYear() === now.getFullYear() && (orderDate.getMonth() < 6 ? 0 : 1) === half;
          }
          case "annual":
            return orderDate.getFullYear() === now.getFullYear();
          default:
            return true;
        }
      });
    };

    const getPeriodExpenses = (periodType: NetIncomePeriod) => {
      return transactions.filter((tx) => {
        if (tx.type !== "payout") return false;

        const txDate = new Date(tx.date || tx.created_at || new Date().toISOString());

        switch (periodType) {
          case "weekly": {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            return txDate >= weekStart && txDate <= weekEnd;
          }
          case "monthly":
            return txDate.getFullYear() === now.getFullYear() && txDate.getMonth() === now.getMonth();
          case "quarterly": {
            const quarter = Math.floor(now.getMonth() / 3);
            return txDate.getFullYear() === now.getFullYear() && Math.floor(txDate.getMonth() / 3) === quarter;
          }
          case "semiAnnual": {
            const half = now.getMonth() < 6 ? 0 : 1;
            return txDate.getFullYear() === now.getFullYear() && (txDate.getMonth() < 6 ? 0 : 1) === half;
          }
          case "annual":
            return txDate.getFullYear() === now.getFullYear();
          default:
            return true;
        }
      });
    };

    const calculateForPeriod = (periodOrders: Order[], periodExpenses: Transaction[]) => {
      const grossIncome = periodOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      const totalDiscounts = periodOrders.reduce((sum, order) => sum + getDiscountAmount(order), 0);
      const totalExpenses = periodExpenses.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      return {
        grossIncome,
        discounts: totalDiscounts,
        expenses: totalExpenses,
        netIncome: grossIncome - totalDiscounts - totalExpenses,
      };
    };

    return {
      weekly: calculateForPeriod(getPeriodOrders("weekly"), getPeriodExpenses("weekly")),
      monthly: calculateForPeriod(getPeriodOrders("monthly"), getPeriodExpenses("monthly")),
      quarterly: calculateForPeriod(getPeriodOrders("quarterly"), getPeriodExpenses("quarterly")),
      semiAnnual: calculateForPeriod(getPeriodOrders("semiAnnual"), getPeriodExpenses("semiAnnual")),
      annual: calculateForPeriod(getPeriodOrders("annual"), getPeriodExpenses("annual")),
    };
  }, [orders, transactions]);

  const getPeriodLabel = () => {
    switch (reportType) {
      case "daily":
        return new Date(selectedDate).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      case "weekly": {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `Week of ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
      }
      case "monthly": {
        const [year, month] = selectedMonth.split("-");
        return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        });
      }
      case "yearly":
        return `Year ${selectedYear}`;
      default:
        return "";
    }
  };

  const exportToCSV = () => {
    try {
      const period = netIncomeByPeriod[selectedNetIncomePeriod];
      const rows: string[][] = [
        [`${shopName} - Sales Report`],
        ["Period", getPeriodLabel()],
        ["Generated", new Date().toLocaleString()],
        [],
        ["Financial Summary"],
        ["Gross Income", formatMoney(period.grossIncome)],
        ["Discounts", `-${formatMoney(period.discounts).replace("₱", "")}`],
        ["Operating Expenses", `-${formatMoney(period.expenses).replace("₱", "")}`],
        ["Net Income", formatMoney(period.netIncome)],
        [],
        ["Top Selling Products"],
        ["Product", "Variant", "Quantity Sold", "Revenue"],
        ...stats.topProducts.map((item) => [item.product, item.variant, String(item.quantity), formatMoney(item.revenue)]),
        [],
        ["Order ID", "Date & Time", "Customer", "Items", "Discount", "Total"],
        ...filterOrdersByPeriod.map((order) => [
          `#${order.id}`,
          new Date(order.created_at).toLocaleString(),
          order.customer_name || "Walk-in",
          String(order.items?.length || 0),
          getDiscountAmount(order) > 0 ? formatMoney(getDiscountAmount(order)) : "-",
          formatMoney(Number(order.total || 0)),
        ]),
      ];

      const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sales_report_${reportType}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showModal("success", "Report exported successfully.");
    } catch (error) {
      console.error("Export failed:", error);
      showModal("error", "Failed to export report. Please try again.");
    }
  };

  const printReport = () => {
    const period = netIncomeByPeriod[selectedNetIncomePeriod];
    const printWindow = window.open("", "_blank", "height=800,width=900");

    if (!printWindow) {
      showModal("error", "Popup blocked. Please allow popups to print.");
      return;
    }

    const topProductMax = Math.max(...stats.topProducts.map((item) => item.quantity), 1);

    const content = `
      <html>
      <head>
        <title>Sales Report - ${getPeriodLabel()}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          .header { text-align: center; margin-bottom: 18px; border-bottom: 3px solid ${shopColor}; padding-bottom: 12px; }
          .header h1 { margin: 0; font-size: 24px; color: ${shopColor}; }
          .header p { margin: 4px 0 0; color: #64748b; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
          .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #f8fafc; }
          .label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; }
          .value { margin-top: 6px; font-size: 18px; font-weight: 800; }
          .section { margin-top: 18px; }
          .section h2 { font-size: 16px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
          th { background: #f1f5f9; }
          .bar-track { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
          .bar-fill { height: 100%; background: ${shopColor}; }
          .muted { color: #64748b; }
          .footer { margin-top: 22px; text-align: center; color: #64748b; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          @media print { body { padding: 18mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${shopName}</h1>
          <p>Sales Report - ${getPeriodLabel()}</p>
          <p class="muted">Generated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="grid">
          <div class="card"><div class="label">Gross Income</div><div class="value" style="color:${shopColor}">${formatMoney(period.grossIncome)}</div></div>
          <div class="card"><div class="label">Discounts</div><div class="value" style="color:#dc2626">-${formatMoney(period.discounts).replace("₱", "")}</div></div>
          <div class="card"><div class="label">Expenses</div><div class="value" style="color:#b45309">-${formatMoney(period.expenses).replace("₱", "")}</div></div>
          <div class="card"><div class="label">Net Income</div><div class="value" style="color:#16a34a">${formatMoney(period.netIncome)}</div></div>
        </div>

        <div class="section">
          <h2>Top Selling Products</h2>
          <table>
            <thead><tr><th style="width: 40%">Product</th><th>Variant</th><th style="width: 90px">Qty</th><th style="width: 180px">Sales</th></tr></thead>
            <tbody>
              ${stats.topProducts.length > 0 ? stats.topProducts.map((item) => `
                <tr>
                  <td><strong>${item.product}</strong></td>
                  <td>${item.variant}</td>
                  <td>${item.quantity}</td>
                  <td>
                    <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, (item.quantity / topProductMax) * 100)}%"></div></div>
                    <div class="muted" style="margin-top: 4px">${formatMoney(item.revenue)}</div>
                  </td>
                </tr>
              `).join("") : `<tr><td colspan="4" class="muted">No product data for this period.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Orders</h2>
          <table>
            <thead><tr><th>Order</th><th>Date & Time</th><th>Customer</th><th>Items</th><th>Discount</th><th>Total</th></tr></thead>
            <tbody>
              ${filterOrdersByPeriod.length > 0 ? filterOrdersByPeriod.map((order) => `
                <tr>
                  <td><strong>#${order.id}</strong></td>
                  <td>${new Date(order.created_at).toLocaleString()}</td>
                  <td>${order.customer_name || "Walk-in"}</td>
                  <td>${order.items?.length || 0}</td>
                  <td>${getDiscountAmount(order) > 0 ? formatMoney(getDiscountAmount(order)) : "-"}</td>
                  <td><strong>${formatMoney(Number(order.total || 0))}</strong></td>
                </tr>
              `).join("") : `<tr><td colspan="6" class="muted">No orders for this period.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="footer">${shopName} | Net Income: ${formatMoney(period.netIncome)}</div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const period = netIncomeByPeriod[selectedNetIncomePeriod];
  const topProductMax = Math.max(...stats.topProducts.map((item) => item.quantity), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: shopColor }} />
          <p className="text-slate-600 font-medium">Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 font-medium mb-4 transition-colors text-sm"
              style={{ color: shopColor }}
            >
              <FiArrowLeft size={18} />
              Back
            </button>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg" style={{ backgroundColor: shopColor }}>
                    <span className="text-white text-xl inline-flex">
                      <FiTrendingUp />
                    </span>
                  </div>
                  Sales Report
                </h1>
                <p className="text-slate-600 mt-1 text-sm">View sales, orders, and cashflow for {shopName}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-6 mb-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span style={{ color: shopColor, display: "inline-flex" }}>
                <FiCalendar size={18} />
              </span>
              Report Period
            </h3>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "yearly", label: "Yearly" },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setReportType(type.value as ReportType)}
                  className={`px-4 py-2.5 rounded-lg font-medium transition-all text-sm ${
                    reportType === type.value ? "text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  style={reportType === type.value ? { backgroundColor: shopColor } : undefined}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {reportType === "daily" && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none text-sm"
                  />
                </div>
              )}

              {reportType === "monthly" && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none text-sm"
                  />
                </div>
              )}

              {reportType === "yearly" && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none cursor-pointer text-sm"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="rounded-lg p-2.5 text-white font-bold text-lg" style={{ backgroundColor: shopColor }}>₱</div>
              </div>
              <div className="text-xs font-semibold text-slate-600 uppercase mb-1">Total Sales</div>
              <div className="text-2xl font-bold text-slate-900">{formatMoney(stats.totalSales)}</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-red-50 p-2.5 rounded-lg">
                  <span className="text-red-600 inline-flex">
                    <FiTrendingUp size={20} />
                  </span>
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-600 uppercase mb-1">Total Discounts</div>
              <div className="text-2xl font-bold text-slate-900">{formatMoney(stats.totalDiscount)}</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-blue-50 p-2.5 rounded-lg text-blue-600 font-bold text-lg">#</div>
              </div>
              <div className="text-xs font-semibold text-slate-600 uppercase mb-1">Total Orders</div>
              <div className="text-2xl font-bold text-slate-900">{stats.totalOrders}</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-green-50 p-2.5 rounded-lg text-green-600 font-bold text-lg">₱</div>
              </div>
              <div className="text-xs font-semibold text-slate-600 uppercase mb-1">Cash Balance</div>
              <div className="text-2xl font-bold text-slate-900">{formatMoney(stats.balance)}</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <button
              onClick={exportToCSV}
              className="flex-1 text-white px-5 py-3 rounded-xl transition-all font-medium flex items-center justify-center gap-2 text-sm shadow-sm"
              style={{ backgroundColor: "#16a34a" }}
            >
              <FiDownload size={18} />
              Export CSV
            </button>
            <button
              onClick={printReport}
              className="flex-1 text-white px-5 py-3 rounded-xl transition-all font-medium flex items-center justify-center gap-2 text-sm shadow-sm"
              style={{ backgroundColor: shopColor }}
            >
              <FiPrinter size={18} />
              Print Report
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-6 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Net Income Breakdown</h3>
              <select
                value={selectedNetIncomePeriod}
                onChange={(e) => setSelectedNetIncomePeriod(e.target.value as NetIncomePeriod)}
                className="px-3 py-2 border border-slate-300 rounded-lg outline-none cursor-pointer text-sm"
              >
                <option value="weekly">This Week</option>
                <option value="monthly">This Month</option>
                <option value="quarterly">This Quarter</option>
                <option value="semiAnnual">Semi-Annual</option>
                <option value="annual">This Year</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="border border-slate-200 rounded-xl p-4 bg-blue-50">
                <div className="text-xs font-semibold text-slate-600 uppercase mb-2">Gross Income</div>
                <div className="text-2xl font-bold" style={{ color: shopColor }}>{formatMoney(period.grossIncome)}</div>
              </div>
              <div className="border border-slate-200 rounded-xl p-4 bg-orange-50">
                <div className="text-xs font-semibold text-slate-600 uppercase mb-2">Discounts</div>
                <div className="text-2xl font-bold text-orange-600">-{formatMoney(period.discounts).replace("₱", "")}</div>
              </div>
              <div className="border border-slate-200 rounded-xl p-4 bg-red-50">
                <div className="text-xs font-semibold text-slate-600 uppercase mb-2">Operating Expenses</div>
                <div className="text-2xl font-bold text-red-600">-{formatMoney(period.expenses).replace("₱", "")}</div>
              </div>
              <div className="border border-slate-200 rounded-xl p-4 bg-green-50">
                <div className="text-xs font-semibold text-slate-600 uppercase mb-2">Net Income</div>
                <div className="text-2xl font-bold text-green-600">{formatMoney(period.netIncome)}</div>
              </div>
            </div>

            {stats.topProducts.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-4">
                <h4 className="text-base font-bold text-slate-900 mb-4">Top Ordered Products</h4>
                <div className="space-y-3">
                  {stats.topProducts.map((item) => (
                    <div key={`${item.product}-${item.variant}`} className="flex items-center gap-3">
                      <div className="w-44 text-sm text-slate-800 truncate">{item.product} - {item.variant}</div>
                      <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(8, (item.quantity / topProductMax) * 100)}%`, backgroundColor: shopColor }}
                        />
                      </div>
                      <div className="w-14 text-right text-sm font-bold text-slate-700">{item.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-6 mb-4 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Orders for {getPeriodLabel()} ({filterOrdersByPeriod.length})</h3>

            {filterOrdersByPeriod.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-slate-400 text-2xl inline-flex">
                    <FiShoppingCart />
                  </span>
                </div>
                <p className="text-base text-slate-600 font-medium">No orders found for this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Order ID</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Date & Time</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Items Ordered</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">Discount</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterOrdersByPeriod.map((order) => {
                      const discountedItems = order.items?.filter((item) => item.discount_type === "senior" || item.discount_type === "pwd") || [];

                      return (
                        <tr key={order.id} className="hover:bg-slate-50 align-top">
                          <td className="px-4 py-3">
                            <div className="font-bold text-sm" style={{ color: shopColor }}>#{order.id}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm">{new Date(order.created_at).toLocaleString()}</td>
                          <td className="px-4 py-3 text-slate-700 text-sm">{order.customer_name || "Walk-in"}</td>
                          <td className="px-4 py-3 text-slate-600 text-sm">
                            <div className="space-y-1.5">
                              {order.items?.length > 0 ? order.items.map((item, idx) => (
                                <div key={idx} className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-slate-900 text-xs sm:text-sm">
                                      {item.product_name} ({item.variant_name || "Default"})
                                    </span>
                                    <span className="rounded-full px-2 py-1 text-xs font-semibold text-white" style={{ backgroundColor: shopColor }}>
                                      x{item.quantity}
                                    </span>
                                  </div>
                                  {item.discount_type && (item.discount ?? 0) > 0 && (
                                    <div className="text-xs font-bold text-red-600">
                                      {String(item.discount_type).toUpperCase()} discount applied
                                    </div>
                                  )}
                                </div>
                              )) : <span className="text-slate-400">No items</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            {discountedItems.length > 0 ? (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {discountedItems.map((item, idx) => (
                                    <span key={idx} className="inline-block bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold uppercase">
                                      {item.discount_type}
                                    </span>
                                  ))}
                                </div>
                                <span className="text-red-600 font-bold">-{formatMoney(getDiscountAmount(order))}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 text-sm">{formatMoney(Number(order.total || 0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-6 mb-4 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Cashflow Transactions</h3>
            {transactions.length === 0 ? (
              <div className="text-center py-10 text-slate-500">No transactions found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600 text-sm">{new Date(transaction.date || transaction.created_at || new Date().toISOString()).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-semibold capitalize">
                          <span className={`rounded-full px-2 py-1 text-xs ${transaction.type === "payin" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{transaction.category}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{transaction.description}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">{formatMoney(Number(transaction.amount || 0))}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{transaction.reference || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {modal.show && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${modal.type === "success" ? "bg-green-100" : "bg-red-100"}`}>
                    {modal.type === "success" ? (
                      <span className="text-green-600 inline-flex">
                        <FiCheckCircle size={24} />
                      </span>
                    ) : (
                      <span className="text-red-600 inline-flex">
                        <FiAlertCircle size={24} />
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{modal.type === "success" ? "Success" : "Error"}</h3>
                </div>

                <p className="text-slate-600 mb-6">{modal.message}</p>

                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className={`px-4 py-2 rounded-lg transition-colors font-medium text-white ${modal.type === "success" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
