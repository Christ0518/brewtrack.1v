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
  FiClock,
  FiDownload,
  FiPrinter,
  FiPieChart,
  FiSearch,
  FiShoppingCart,
  FiTrendingUp,
} from "react-icons/fi";

type ReportType = "daily" | "weekly" | "monthly" | "yearly" | "custom";
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
  last_edited_at?: string | null;
  total: number;
  discount?: number;
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

type HistoryEntry = {
  key: string;
  date: string;
  kind: "Order" | "Cashflow";
  reference: string;
  description: string;
  status: string;
  amount: number;
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

type IngredientReportItem = {
  id: number;
  ingredient_name: string;
  unit: string;
  quantity: number | null;
  unit_price: number | null;
};

type ReportCategory = {
  id: number;
  name: string;
};

type UsedIngredientReportItem = IngredientReportItem & {
  usedIn: string[];
};

function formatMoney(value: number) {
  return `₱${value.toFixed(2)}`;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getReportMonth(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function htmlEscape(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function getItemDiscount(item: OrderItem) {
  return Math.max(0, Number(item.discount || 0));
}

function getItemRevenue(item: OrderItem) {
  const subtotal = Number(item.subtotal || 0);
  return Math.max(0, subtotal - getItemDiscount(item) * Number(item.quantity || 0));
}

export default function ReportsPage() {
  const router = useRouter();
  const [shopName, setShopName] = useState("Shop");
  const [shopId, setShopId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [reportCategories, setReportCategories] = useState<ReportCategory[]>([]);
  const [reportIngredients, setReportIngredients] = useState<IngredientReportItem[]>([]);
  const [reportProducts, setReportProducts] = useState<any[]>([]);
  const [usedIngredientSearch, setUsedIngredientSearch] = useState("");
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [rangeStartDate, setRangeStartDate] = useState(
    () => formatLocalDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [rangeEndDate, setRangeEndDate] = useState(() => formatLocalDate(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(() => formatLocalMonth(new Date()));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedNetIncomePeriod, setSelectedNetIncomePeriod] = useState<NetIncomePeriod>("monthly");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ show: false, type: "success", message: "" });

  useEffect(() => {
    const storedShopName = localStorage.getItem("shopName");
    const storedShopId = localStorage.getItem("shopId") || "1";
    if (storedShopName) setShopName(storedShopName);
    setShopId(storedShopId);
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

        const [ordersRes, cashflowRes, ingredientsRes, productsRes, categoriesRes] = await Promise.all([
          fetch(api_links.tbl_orders, { headers }),
          fetch(api_links.tbl_cashflow, { headers }),
          fetch(`${api_links.tbl_ingredients}?shop_id=${shopId}`, { headers }),
          fetch(`${api_links.tbl_products}?shop_id=${shopId}`, { headers }),
          fetch(`${api_links.tbl_category}?shop_id=${shopId}`, { headers }),
        ]);

        if (!ordersRes.ok) {
          throw new Error(`Failed to load orders: ${ordersRes.status}`);
        }

        if (!cashflowRes.ok) {
          throw new Error(`Failed to load transactions: ${cashflowRes.status}`);
        }

        if (!ingredientsRes.ok) {
          throw new Error(`Failed to load ingredients: ${ingredientsRes.status}`);
        }

        if (!productsRes.ok) {
          throw new Error(`Failed to load products: ${productsRes.status}`);
        }

        if (!categoriesRes.ok) {
          throw new Error(`Failed to load categories: ${categoriesRes.status}`);
        }
        const ordersData = await ordersRes.json();
        const cashflowData = await cashflowRes.json();
        const ingredientsData = await ingredientsRes.json();
        const productsData = await productsRes.json();
        const categoriesData = await categoriesRes.json();

        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setTransactions(Array.isArray(cashflowData) ? cashflowData : []);
        setReportIngredients(Array.isArray(ingredientsData) ? ingredientsData : []);
        setReportProducts(Array.isArray(productsData?.products) ? productsData.products : []);
        setReportCategories(Array.isArray(categoriesData) ? categoriesData : []);
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

  const allHistory = useMemo<HistoryEntry[]>(() => [
    ...orders.map((order) => ({
      key: `order-${order.id}`,
      date: order.created_at,
      kind: "Order" as const,
      reference: `#${order.id}`,
      description: [
        order.customer_name || "Walk-in",
        ...(order.items || []).map((item) =>
          `${item.product_name || "Item"}${item.variant_name ? ` (${item.variant_name})` : ""} ×${item.quantity}`
        ),
      ].join(" · "),
      status: order.status || "Unknown",
      amount: Number(order.total) || 0,
    })),
    ...transactions.map((transaction) => ({
      key: `cashflow-${transaction.id}`,
      date: transaction.date || transaction.created_at || "",
      kind: "Cashflow" as const,
      reference: `#${transaction.id}`,
      description: `${transaction.type} · ${transaction.category || "Uncategorized"} · ${transaction.description || ""}${transaction.reference ? ` · Ref: ${transaction.reference}` : ""}`,
      status: "Recorded",
      amount: transaction.type === "payout"
        ? -Math.abs(Number(transaction.amount) || 0)
        : Number(transaction.amount) || 0,
    })),
  ].sort((first, second) =>
    (new Date(second.date).getTime() || 0) - (new Date(first.date).getTime() || 0)
  ), [orders, transactions]);

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return allHistory;
    return allHistory.filter((entry) =>
      `${entry.kind} ${entry.reference} ${entry.description} ${entry.status} ${entry.amount}`.toLowerCase().includes(query)
    );
  }, [allHistory, historySearch]);

  const getStockThreshold = (unit: string) => {
    if (unit === "pcs" || unit === "box") return 20;
    if (unit === "ml") return 3000;
    if (unit === "g") return 500;
    if (unit === "L") return 3;
    if (unit === "kg") return 0.5;
    return 100;
  };

  const ingredientsToBuy = reportIngredients
    .map((ingredient) => {
      const currentQuantity = Number(ingredient.quantity) || 0;
      const minimumQuantity = getStockThreshold(ingredient.unit);
      return {
        ...ingredient,
        currentQuantity,
        minimumQuantity,
        suggestedPurchase: Math.max(0, minimumQuantity - currentQuantity),
      };
    })
    .filter((ingredient) => ingredient.currentQuantity < ingredient.minimumQuantity)
    .sort((first, second) => first.currentQuantity - second.currentQuantity);

  const usedIngredients = useMemo(() => {
    const ingredientMap = new Map<number, UsedIngredientReportItem>();
    const ingredientDetails = new Map(
      reportIngredients.map((ingredient) => [Number(ingredient.id), ingredient])
    );

    reportProducts.forEach((product) => {
      (product.variants || []).forEach((variant: any) => {
        (variant.ingredients || []).forEach((ingredient: any) => {
          const ingredientId = Number(ingredient.ingredient_id);
          if (Number.isNaN(ingredientId)) return;

          const existing = ingredientMap.get(ingredientId);
          const usedIn = `${product.product_name} - ${variant.variant_name || variant.name}`;
          if (existing) {
            if (!existing.usedIn.includes(usedIn)) existing.usedIn.push(usedIn);
            return;
          }

          const details = ingredientDetails.get(ingredientId);

          ingredientMap.set(ingredientId, {
            id: ingredientId,
            ingredient_name: ingredient.name || details?.ingredient_name || "Unknown ingredient",
            unit: ingredient.unit || details?.unit || "",
            quantity: ingredient.available ?? details?.quantity ?? null,
            unit_price: details?.unit_price ?? null,
            usedIn: [usedIn],
          });
        });
      });
    });

    return Array.from(ingredientMap.values()).sort((first, second) =>
      first.ingredient_name.localeCompare(second.ingredient_name)
    );
  }, [reportIngredients, reportProducts]);

  const filteredUsedIngredients = useMemo(() => {
    const query = usedIngredientSearch.trim().toLowerCase();
    if (!query) return usedIngredients;

    return usedIngredients.filter((ingredient) =>
      ingredient.ingredient_name.toLowerCase().includes(query) ||
      ingredient.usedIn.some((usage) => usage.toLowerCase().includes(query))
    );
  }, [usedIngredientSearch, usedIngredients]);

  const getDiscountAmount = (order: Order) => {
    const itemDiscount = (order.items || []).reduce((sum, item) => sum + getItemDiscount(item), 0);
    return itemDiscount || Math.max(0, Number(order.discount || 0));
  };

  const filterOrdersByPeriod = useMemo(() => {
    const now = new Date();

    return orders.filter((order) => {
      if (String(order.status || "").trim().toLowerCase() !== "completed") return false;
      const orderDate = new Date(order.created_at);

      switch (reportType) {
        case "daily":
          return formatLocalDate(orderDate) === selectedDate;
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
          return getReportMonth(order.created_at) === selectedMonth;
        }
        case "yearly":
          return orderDate.getFullYear() === Number(selectedYear);
        case "custom": {
          const start = new Date(`${rangeStartDate}T00:00:00`);
          const end = new Date(`${rangeEndDate}T23:59:59.999`);
          return orderDate >= start && orderDate <= end;
        }
        default:
          return true;
      }
    });
  }, [orders, reportType, selectedDate, selectedMonth, selectedYear, rangeStartDate, rangeEndDate]);

  const transactionsByPeriod = useMemo(() => {
    return transactions.filter((transaction) => {
      const dateValue = transaction.date || transaction.created_at;
      if (!dateValue) return false;
      const transactionDate = new Date(dateValue);
      if (Number.isNaN(transactionDate.getTime())) return false;

      switch (reportType) {
        case "daily":
          return formatLocalDate(transactionDate) === selectedDate;
        case "weekly": {
          const now = new Date();
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 7);
          return transactionDate >= weekStart && transactionDate < weekEnd;
        }
        case "monthly": {
          return getReportMonth(dateValue) === selectedMonth;
        }
        case "yearly":
          return transactionDate.getFullYear() === Number(selectedYear);
        case "custom": {
          const start = new Date(`${rangeStartDate}T00:00:00`);
          const end = new Date(`${rangeEndDate}T23:59:59.999`);
          return transactionDate >= start && transactionDate <= end;
        }
      }
    });
  }, [transactions, reportType, selectedDate, selectedMonth, selectedYear, rangeStartDate, rangeEndDate]);

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
        current.revenue += getItemRevenue(item);
        productSales.set(key, current);
      });
    });

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const payIn = transactionsByPeriod.filter((tx) => tx.type === "payin").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const payOut = transactionsByPeriod.filter((tx) => tx.type === "payout").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

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
  }, [filterOrdersByPeriod, transactionsByPeriod]);

  const revenueTrend = useMemo(() => {
    const customStart = new Date(`${rangeStartDate}T00:00:00`);
    const customEnd = new Date(`${rangeEndDate}T00:00:00`);
    const customDays = Math.max(1, Math.floor((customEnd.getTime() - customStart.getTime()) / 86400000) + 1);
    const bucketCount = reportType === "daily"
      ? 12
      : reportType === "weekly"
        ? 7
        : reportType === "monthly"
          ? new Date(
              Number(selectedMonth.split("-")[0]),
              Number(selectedMonth.split("-")[1]),
              0
            ).getDate()
            : reportType === "custom"
              ? Math.min(customDays, 31)
              : 12;
    const buckets = Array.from({ length: bucketCount }, (_, index) => ({
      label: reportType === "daily"
        ? `${String(index * 2).padStart(2, "0")}:00`
        : reportType === "weekly"
          ? new Date(2024, 0, 7 + index).toLocaleDateString("en-US", { weekday: "short" })
          : reportType === "monthly"
            ? String(index + 1)
            : reportType === "custom"
              ? new Date(customStart.getTime() + Math.floor((index * customDays) / bucketCount) * 86400000)
                  .toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : new Date(2024, index, 1).toLocaleDateString("en-US", { month: "short" }),
      revenue: 0,
    }));

    filterOrdersByPeriod.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const bucketIndex = reportType === "daily"
        ? Math.min(11, Math.floor(orderDate.getHours() / 2))
        : reportType === "weekly"
          ? orderDate.getDay()
          : reportType === "monthly"
            ? orderDate.getDate() - 1
            : reportType === "custom"
              ? Math.min(
                  bucketCount - 1,
                  Math.floor(
                    ((orderDate.getTime() - customStart.getTime()) / 86400000) /
                      (customDays / bucketCount)
                  )
                )
              : orderDate.getMonth();
      if (buckets[bucketIndex]) buckets[bucketIndex].revenue += Number(order.total || 0);
    });

    return buckets;
  }, [filterOrdersByPeriod, reportType, selectedMonth, rangeStartDate, rangeEndDate]);

  const revenueChart = useMemo(() => {
    const maxRevenue = Math.max(...revenueTrend.map((point) => point.revenue), 1);
    const points = revenueTrend.map((point, index) => ({
      x: revenueTrend.length === 1 ? 50 : 2 + (index / (revenueTrend.length - 1)) * 96,
      y: 90 - (point.revenue / maxRevenue) * 76,
      ...point,
    }));
    const linePath = points.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      const midpoint = (previous.x + point.x) / 2;
      return `${path} Q ${midpoint} ${previous.y}, ${midpoint} ${(previous.y + point.y) / 2} T ${point.x} ${point.y}`;
    }, "");

    return {
      points,
      linePath,
      areaPath: `${linePath} L 98 100 L 2 100 Z`,
    };
  }, [revenueTrend]);

  const categoryRevenue = useMemo(() => {
    const categoryNames = new Map(
      reportCategories.map((category) => [Number(category.id), category.name])
    );
    const productCategories = new Map(
      reportProducts.map((product) => [
        product.product_name,
        categoryNames.get(Number(product.category_id)) || "Uncategorized",
      ])
    );
    const revenueByCategory = new Map<string, number>();

    filterOrdersByPeriod.forEach((order) => {
      order.items?.forEach((item) => {
        const category = productCategories.get(item.product_name) || "Uncategorized";
        const revenue = getItemRevenue(item);
        revenueByCategory.set(category, (revenueByCategory.get(category) || 0) + revenue);
      });
    });

    return Array.from(revenueByCategory, ([name, revenue]) => ({ name, revenue }))
      .sort((first, second) => second.revenue - first.revenue)
      .slice(0, 5);
  }, [filterOrdersByPeriod, reportCategories, reportProducts]);

  const netIncomeByPeriod = useMemo(() => {
    const now = new Date();

    const getPeriodOrders = (periodType: NetIncomePeriod) => {
      return orders.filter((order) => {
        if (String(order.status || "").toLowerCase() !== "completed") return false;
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

    const getPeriodTransactions = (periodType: NetIncomePeriod, transactionType: Transaction["type"]) => {
      return transactions.filter((tx) => {
        if (tx.type !== transactionType) return false;

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

    const calculateForPeriod = (periodOrders: Order[], periodPayIns: Transaction[], periodExpenses: Transaction[]) => {
      const grossIncome = periodOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      const totalDiscounts = periodOrders.reduce((sum, order) => sum + getDiscountAmount(order), 0);
      const totalPayIns = periodPayIns.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const totalExpenses = periodExpenses.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      return {
        grossIncome,
        discounts: totalDiscounts,
        payIns: totalPayIns,
        expenses: totalExpenses,
        netIncome: grossIncome - totalDiscounts + totalPayIns - totalExpenses,
      };
    };

    return {
      weekly: calculateForPeriod(getPeriodOrders("weekly"), getPeriodTransactions("weekly", "payin"), getPeriodTransactions("weekly", "payout")),
      monthly: calculateForPeriod(getPeriodOrders("monthly"), getPeriodTransactions("monthly", "payin"), getPeriodTransactions("monthly", "payout")),
      quarterly: calculateForPeriod(getPeriodOrders("quarterly"), getPeriodTransactions("quarterly", "payin"), getPeriodTransactions("quarterly", "payout")),
      semiAnnual: calculateForPeriod(getPeriodOrders("semiAnnual"), getPeriodTransactions("semiAnnual", "payin"), getPeriodTransactions("semiAnnual", "payout")),
      annual: calculateForPeriod(getPeriodOrders("annual"), getPeriodTransactions("annual", "payin"), getPeriodTransactions("annual", "payout")),
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
      case "custom":
        return `${new Date(`${rangeStartDate}T00:00:00`).toLocaleDateString()} – ${new Date(`${rangeEndDate}T00:00:00`).toLocaleDateString()}`;
      default:
        return "";
    }
  };

  const exportToCSV = () => {
    try {
      const period = netIncomeByPeriod[selectedNetIncomePeriod];
      const money = (v: number) => Number(v || 0).toFixed(2);

      const rows: string[][] = [
        [`${shopName} - Sales Report`],
        ["Period", getPeriodLabel()],
        ["Generated", new Date().toLocaleString()],
        [],
        ["Financial Summary"],
        ["Gross Income", money(period.grossIncome)],
        ["Discounts", `-${money(period.discounts)}`],
        ["Operating Expenses", `-${money(period.expenses)}`],
        ["Net Income", money(period.netIncome)],
        [],
        ["Top Selling Products"],
        ["Product", "Variant", "Quantity Sold", "Revenue"],
        ...stats.topProducts.map((item) => [item.product, item.variant, String(item.quantity), money(item.revenue)]),
        [],
        ["Order ID", "Date & Time", "Customer", "Items", "Discount", "Total", "Edited"],
        ...filterOrdersByPeriod.map((order) => [
          `#${order.id}`,
          new Date(order.created_at).toLocaleString(),
          order.customer_name || "Walk-in",
          String(order.items?.length || 0),
          getDiscountAmount(order) > 0 ? `-${money(getDiscountAmount(order))}` : money(0),
          money(Number(order.total || 0)),
          order.last_edited_at ? new Date(order.last_edited_at).toLocaleString() : "No",
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
    const generatedAt = new Date().toLocaleString();
    const safeShopName = htmlEscape(shopName);
    const safePeriodLabel = htmlEscape(getPeriodLabel());
    const incomePeriodLabels: Record<NetIncomePeriod, string> = {
      weekly: "This Week",
      monthly: "This Month",
      quarterly: "This Quarter",
      semiAnnual: "Semi-Annual",
      annual: "This Year",
    };
    const safeIncomePeriodLabel = htmlEscape(incomePeriodLabels[selectedNetIncomePeriod]);
    const safeGeneratedAt = htmlEscape(generatedAt);

    const content = `
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${safeShopName} · Sales report · ${safePeriodLabel}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 36px; background: #fff; color: #2d2626; font: 13px/1.5 Arial, Helvetica, sans-serif; }
          .report { max-width: 1100px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 22px; border-bottom: 2px solid #c98a84; }
          .eyebrow { margin: 0 0 6px; color: #a76560; font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
          .header h1 { margin: 0; color: #2d2626; font-size: 26px; letter-spacing: -.03em; }
          .header p { margin: 4px 0 0; color: #796e6b; }
          .meta { min-width: 170px; text-align: right; color: #796e6b; font-size: 11px; }
          .meta strong { display: block; margin-bottom: 3px; color: #514441; font-size: 12px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0 24px; }
          .summary-title { margin: 20px 0 -10px; color: #514441; font-size: 13px; }
          .card { min-height: 84px; padding: 14px; border: 1px solid #e9dfdb; border-radius: 12px; background: #faf6f4; }
          .label { color: #8a7c78; font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
          .value { margin-top: 8px; color: #2d2626; font-size: 19px; font-weight: 800; }
          .section { margin-top: 22px; break-inside: avoid; }
          .section h2 { margin: 0 0 10px; color: #2d2626; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
          th, td { padding: 8px 9px; border-bottom: 1px solid #eee7e3; text-align: left; vertical-align: top; }
          th { background: #f3ece8; color: #625651; font-size: 9px; letter-spacing: .04em; text-transform: uppercase; }
          .bar-track { height: 7px; overflow: hidden; border-radius: 999px; background: #ece6e2; }
          .bar-fill { height: 100%; border-radius: inherit; background: #c98a84; }
          .muted { color: #8a7c78; }
          .footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 28px; padding-top: 12px; border-top: 1px solid #e9dfdb; color: #8a7c78; font-size: 10px; }
          @page { size: A4 portrait; margin: 14mm; }
          @media (max-width: 700px) {
            body { padding: 18px; }
            .header { display: block; }
            .meta { margin-top: 12px; text-align: left; }
            .summary { grid-template-columns: repeat(2, 1fr); }
          }
          @media print {
            body { padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .report { max-width: none; }
            .section { break-inside: auto; }
          }
        </style>
      </head>
      <body>
        <main class="report">
        <header class="header">
          <div>
            <p class="eyebrow">Business performance</p>
            <h1>${safeShopName}</h1>
            <p>Sales &amp; operations report · ${safePeriodLabel}</p>
          </div>
          <div class="meta"><strong>REPORT SUMMARY</strong>Generated ${safeGeneratedAt}<br />${filterOrdersByPeriod.length} orders in selected period</div>
        </header>

        <h2 class="summary-title">Financial summary · ${safeIncomePeriodLabel}</h2>
        <section class="summary">
          <div class="card"><div class="label">Gross income</div><div class="value">${formatMoney(period.grossIncome)}</div></div>
          <div class="card"><div class="label">Discounts</div><div class="value">−${formatMoney(period.discounts)}</div></div>
          <div class="card"><div class="label">Net income</div><div class="value">${formatMoney(period.netIncome)}</div></div>
        </section>

        <section class="section">
          <h2>Top Selling Products</h2>
          <table>
            <thead><tr><th style="width: 40%">Product</th><th>Variant</th><th style="width: 90px">Qty</th><th style="width: 180px">Sales</th></tr></thead>
            <tbody>
              ${stats.topProducts.length > 0 ? stats.topProducts.map((item) => `
                <tr>
                  <td><strong>${htmlEscape(item.product)}</strong></td>
                  <td>${htmlEscape(item.variant)}</td>
                  <td>${item.quantity}</td>
                  <td>
                    <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, (item.quantity / topProductMax) * 100)}%"></div></div>
                    <div class="muted" style="margin-top: 4px">${formatMoney(item.revenue)}</div>
                  </td>
                </tr>
              `).join("") : `<tr><td colspan="4" class="muted">No product data for this period.</td></tr>`}
            </tbody>
          </table>
        </section>

        <section class="section">
          <h2>Orders</h2>
          <table>
            <thead><tr><th>Order</th><th>Date & Time</th><th>Customer</th><th>Items</th><th>Discount</th><th>Total</th><th>Edited</th></tr></thead>
            <tbody>
              ${filterOrdersByPeriod.length > 0 ? filterOrdersByPeriod.map((order) => `
                <tr>
                  <td><strong>#${htmlEscape(order.id)}</strong></td>
                  <td>${htmlEscape(new Date(order.created_at).toLocaleString())}</td>
                  <td>${htmlEscape(order.customer_name || "Walk-in")}</td>
                  <td>${order.items?.length || 0}</td>
                  <td>${getDiscountAmount(order) > 0 ? formatMoney(getDiscountAmount(order)) : "-"}</td>
                  <td><strong>${formatMoney(Number(order.total || 0))}</strong></td>
                  <td>${order.last_edited_at ? htmlEscape(new Date(order.last_edited_at).toLocaleString()) : "No"}</td>
                </tr>
              `).join("") : `<tr><td colspan="7" class="muted">No orders for this period.</td></tr>`}
            </tbody>
          </table>
        </section>

        <footer class="footer"><span>${safeShopName} · Confidential business report</span><span>Net income ${formatMoney(period.netIncome)}</span></footer>
        </main>
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
      <div className="min-h-screen bg-[#FAF6F4] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4 border-[#C98A84]" />
          <p className="text-[#796E6B] font-medium">Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FAF6F4]">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="min-h-screen w-full p-4 lg:p-8">
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 font-medium mb-4 transition-colors text-sm text-[#796E6B] hover:text-[#2D2626]"
            >
              <FiArrowLeft size={18} />
              Back
            </button>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#A76560]">
                  Executive overview · {shopName}
                </p>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#2D2626] flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#C98A84] shadow-sm shadow-[#C98A84]/20">
                    <span className="text-white text-xl inline-flex">
                      <FiTrendingUp />
                    </span>
                  </div>
                  Reports
                </h1>
                <p className="text-[#796E6B] mt-1 text-sm">A clear view of sales performance, transactions, and product mix.</p>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/reports/transactions")}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#E5DCD7] bg-white px-5 text-sm font-semibold text-[#796E6B] shadow-sm transition-colors hover:bg-[#F5EFEC] hover:text-[#2D2626] sm:flex-none"
                >
                  <FiClock size={17} />
                  Transaction History
                </button>
                <button
                  onClick={exportToCSV}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B87772] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A76560] sm:flex-none"
                >
                  <FiDownload size={17} />
                  Export Report (CSV)
                </button>
                <button
                  onClick={printReport}
                  aria-label="Print or save report as PDF"
                  className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-[#E5DCD7] bg-white px-4 text-[#796E6B] shadow-sm transition-colors hover:bg-[#F5EFEC] hover:text-[#2D2626]"
                  title="Print / Save as PDF"
                >
                  <FiPrinter size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-[#E5DCD7] bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#2D2626]">
                <FiCalendar className="text-[#A76560]" size={17} />
                Reporting period
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "daily", label: "Day" },
                  { value: "weekly", label: "Week" },
                  { value: "monthly", label: "Month" },
                  { value: "yearly", label: "Year" },
                  { value: "custom", label: "Custom range" },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setReportType(type.value as ReportType)}
                    aria-pressed={reportType === type.value}
                    className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors ${
                      reportType === type.value
                        ? "bg-[#C98A84] text-white shadow-sm"
                        : "bg-[#ECE6E2] text-[#796E6B] hover:bg-[#E2D9D4] hover:text-[#2D2626]"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:min-w-56">
              {reportType === "daily" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#796E6B]">Select date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-[#E5DCD7] bg-white px-3 text-sm text-[#2D2626] outline-none focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/15"
                  />
                </div>
              )}

              {reportType === "monthly" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#796E6B]">Select month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-[#E5DCD7] bg-white px-3 text-sm text-[#2D2626] outline-none focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/15"
                  />
                </div>
              )}

              {reportType === "yearly" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#796E6B]">Select year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="min-h-11 w-full cursor-pointer rounded-lg border border-[#E5DCD7] bg-white px-3 text-sm text-[#2D2626] outline-none focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/15"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}
              {reportType === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#796E6B]">From</label>
                    <input
                      type="date"
                      value={rangeStartDate}
                      max={rangeEndDate}
                      onChange={(event) => setRangeStartDate(event.target.value)}
                      className="min-h-11 w-full rounded-lg border border-[#E5DCD7] bg-white px-2 text-sm text-[#2D2626] outline-none focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/15"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#796E6B]">To</label>
                    <input
                      type="date"
                      value={rangeEndDate}
                      min={rangeStartDate}
                      onChange={(event) => setRangeEndDate(event.target.value)}
                      className="min-h-11 w-full rounded-lg border border-[#E5DCD7] bg-white px-2 text-sm text-[#2D2626] outline-none focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/15"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <section aria-label="Revenue and category analytics" className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
            <article className="rounded-2xl border border-[#E5DCD7] bg-white p-5 shadow-sm sm:p-6">
              <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#2D2626]">Revenue performance</h2>
                  <p className="mt-1 text-sm text-[#796E6B]">{getPeriodLabel()} · {stats.totalOrders} transactions</p>
                </div>
                <div className="rounded-lg bg-[#F7ECEA] px-3 py-1.5 text-sm font-semibold text-[#A76560]">
                  {formatMoney(stats.totalSales)}
                </div>
              </header>
              <div className="relative h-52 overflow-hidden rounded-xl bg-[#FBF8F6] px-2 pt-2">
                <svg
                  role="img"
                  aria-label={`Revenue trend: ${revenueTrend.map((point) => `${point.label}, ${formatMoney(point.revenue)}`).join("; ")}`}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="h-full w-full overflow-visible"
                >
                  {[15, 40, 65, 90].map((position) => (
                    <line key={position} x1="2" x2="98" y1={position} y2={position} stroke="#EDE4DF" strokeDasharray="1.5 2" vectorEffect="non-scaling-stroke" />
                  ))}
                  <path d={revenueChart.areaPath} fill="#C98A84" fillOpacity="0.12" />
                  <path d={revenueChart.linePath} fill="none" stroke="#C98A84" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  {revenueChart.points.map((point, index) => (
                    <circle
                      key={`${point.label}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={revenueChart.points.length > 16 ? 0.9 : 1.5}
                      fill="#fff"
                      stroke="#B87772"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{`${point.label}: ${formatMoney(point.revenue)}`}</title>
                    </circle>
                  ))}
                </svg>
              </div>
              <div className="mt-2 flex justify-between gap-1 text-[10px] font-medium text-[#9A8D89] sm:text-xs">
                {revenueTrend.map((point, index) => (
                  <span key={`${point.label}-axis-${index}`} className="min-w-0 flex-1 truncate text-center">
                    {index % Math.ceil(revenueTrend.length / 12) === 0 || index === revenueTrend.length - 1 ? point.label : ""}
                  </span>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[#E5DCD7] bg-white p-5 shadow-sm sm:p-6">
              <header className="mb-5">
                <div className="flex items-center gap-2">
                  <FiPieChart className="text-[#A76560]" size={18} />
                  <h2 className="text-lg font-bold text-[#2D2626]">Category breakdown</h2>
                </div>
                <p className="mt-1 text-sm text-[#796E6B]">Revenue mix for {getPeriodLabel()}</p>
              </header>
              {categoryRevenue.length === 0 ? (
                <div className="flex min-h-44 items-center justify-center rounded-xl bg-[#FBF8F6] text-center text-sm text-[#796E6B]">
                  No category sales data for this period.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center py-2">
                    <div
                      role="img"
                      aria-label={`Category revenue breakdown: ${categoryRevenue.map((category) => `${category.name} ${formatMoney(category.revenue)}`).join(", ")}`}
                      className="flex h-40 w-40 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(${categoryRevenue.map((category, index) => {
                          const colors = ["#C98A84", "#A76560", "#D9A782", "#B9A39B", "#82716C"];
                          const total = categoryRevenue.reduce((sum, item) => sum + item.revenue, 0) || 1;
                          const before = categoryRevenue.slice(0, index).reduce((sum, item) => sum + item.revenue, 0);
                          const start = (before / total) * 100;
                          const end = ((before + category.revenue) / total) * 100;
                          return `${colors[index % colors.length]} ${start}% ${end}%`;
                        }).join(", ")})`,
                      }}
                    >
                      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                        <span className="text-xl font-bold text-[#2D2626]">{categoryRevenue.length}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9A8D89]">categories</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {categoryRevenue.map((category, index) => {
                      const colors = ["#C98A84", "#A76560", "#D9A782", "#B9A39B", "#82716C"];
                      return (
                        <div key={category.name} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2 text-slate-600">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                            <span className="truncate">{category.name}</span>
                          </span>
                          <span className="shrink-0 font-semibold text-[#2D2626]">{formatMoney(category.revenue)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </article>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
            <section className="bg-white rounded-2xl border border-[#E5DCD7] p-4 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#2D2626]">Ingredients to Buy</h3>
                  <p className="text-sm text-[#796E6B]">Items below their minimum stock level</p>
                </div>
                <FiAlertCircle className="text-red-600" size={20} />
              </div>
              {ingredientsToBuy.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No ingredients need restocking.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-[#E5DCD7] text-left">
                      <tr>
                        <th className="px-2 py-2 text-xs font-bold uppercase text-slate-600">Ingredient</th>
                        <th className="px-2 py-2 text-xs font-bold uppercase text-slate-600">Current</th>
                        <th className="px-2 py-2 text-xs font-bold uppercase text-slate-600">Buy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ingredientsToBuy.map((ingredient) => (
                        <tr key={ingredient.id}>
                          <td className="px-2 py-2 font-medium text-[#2D2626]">{ingredient.ingredient_name}</td>
                          <td className="px-2 py-2 text-[#A76560]">{ingredient.currentQuantity} {ingredient.unit}</td>
                          <td className="px-2 py-2 font-bold text-[#2D2626]">{ingredient.suggestedPurchase} {ingredient.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-[#E5DCD7] p-4 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#2D2626]">All Ingredients Used</h3>
                  <p className="text-sm text-[#796E6B]">Ingredients included in product recipes</p>
                </div>
                <FiCheckCircle className="text-green-600" size={20} />
              </div>
              <div className="relative mb-4">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="search"
                  value={usedIngredientSearch}
                  onChange={(event) => setUsedIngredientSearch(event.target.value)}
                  placeholder="Search ingredients used..."
                  className="w-full rounded-lg border border-[#E5DCD7] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#C98A84] focus:ring-2 focus:ring-[#C98A84]/15"
                />
              </div>
              {filteredUsedIngredients.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No recipe ingredients found.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-[#E5DCD7] text-left">
                      <tr>
                        <th className="px-2 py-2 text-xs font-bold uppercase text-slate-600">Ingredient</th>
                        <th className="px-2 py-2 text-xs font-bold uppercase text-slate-600">Times Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsedIngredients.map((ingredient) => (
                        <tr key={ingredient.id}>
                          <td className="px-2 py-2 font-medium text-[#2D2626]">{ingredient.ingredient_name}</td>
                          <td className="px-2 py-2 text-slate-600">
                            {ingredient.usedIn.length} {ingredient.usedIn.length === 1 ? "recipe" : "recipes"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5DCD7] p-4 lg:p-6 mb-4 shadow-sm">
            <h3 className="text-lg font-bold text-[#2D2626] mb-4">Net Income Breakdown</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="border border-[#E5DCD7] rounded-xl p-4 bg-[#FBF8F6]">
                <div className="text-xs font-semibold text-[#796E6B] uppercase mb-2">Gross Income</div>
                <div className="text-2xl font-bold text-[#A76560]">{formatMoney(stats.totalSales)}</div>
              </div>
              <div className="border border-[#E5DCD7] rounded-xl p-4 bg-[#F7F0EA]">
                <div className="text-xs font-semibold text-[#796E6B] uppercase mb-2">Discounts</div>
                <div className="text-2xl font-bold text-[#A7774E]">-{formatMoney(stats.totalDiscount).replace("₱", "")}</div>
              </div>
              <div className="border border-[#E5DCD7] rounded-xl p-4 bg-[#F3F0EA]">
                <div className="text-xs font-semibold text-[#796E6B] uppercase mb-2">Pay-ins</div>
                <div className="text-2xl font-bold text-[#6F765A]">+{formatMoney(stats.payIn).replace("₱", "")}</div>
              </div>
              <div className="border border-[#E5DCD7] rounded-xl p-4 bg-[#F3F0EA]">
                <div className="text-xs font-semibold text-[#796E6B] uppercase mb-2">Net Income</div>
                <div className="text-2xl font-bold text-[#6F765A]">
                  {formatMoney(stats.totalSales - stats.totalDiscount + stats.payIn - stats.payOut)}
                </div>
              </div>
            </div>

            {stats.topProducts.length > 0 && (
              <div className="bg-[#FBF8F6] rounded-xl p-4">
                <h4 className="text-base font-bold text-[#2D2626] mb-4">Top Ordered Products</h4>
                <div className="space-y-3">
                  {stats.topProducts.map((item) => (
                    <div key={`${item.product}-${item.variant}`} className="flex items-center gap-3">
                      <div className="w-44 text-sm text-[#514441] truncate">{item.product} - {item.variant}</div>
                      <div className="flex-1 h-3 bg-[#ECE6E2] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(8, (item.quantity / topProductMax) * 100)}%`, backgroundColor: "#C98A84" }}
                        />
                      </div>
                      <div className="w-14 text-right text-sm font-bold text-[#514441]">{item.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#E5DCD7] p-4 lg:p-6 mb-4 shadow-sm">
            <h3 className="text-lg font-bold text-[#2D2626] mb-4">Orders for {getPeriodLabel()} ({filterOrdersByPeriod.length})</h3>

            {filterOrdersByPeriod.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-[#ECE6E2] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-[#9A8D89] text-2xl inline-flex">
                    <FiShoppingCart />
                  </span>
                </div>
                <p className="text-base text-[#796E6B] font-medium">No orders found for this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F5EFEC] border-b border-[#E5DCD7]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#796E6B] uppercase">Order ID</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#796E6B] uppercase">Date & Time</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#796E6B] uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#796E6B] uppercase">Items Ordered</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-[#796E6B] uppercase">Discount</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-[#796E6B] uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[#796E6B] uppercase">Edited</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EAE6]">
                    {filterOrdersByPeriod.map((order) => {
                      const discountedItems = order.items?.filter((item) => getItemDiscount(item) > 0) || [];

                      return (
                        <tr key={order.id} className="hover:bg-[#FBF8F6] align-top">
                          <td className="px-4 py-3">
                            <div className="font-bold text-sm text-[#A76560]">#{order.id}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm">{new Date(order.created_at).toLocaleString()}</td>
                          <td className="px-4 py-3 text-slate-700 text-sm">{order.customer_name || "Walk-in"}</td>
                          <td className="px-4 py-3 text-slate-600 text-sm">
                            <div className="space-y-1.5">
                              {order.items?.length > 0 ? order.items.map((item, idx) => (
                                <div key={idx} className="flex flex-col gap-1 rounded-lg border border-[#E5DCD7] bg-[#FBF8F6] p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-[#2D2626] text-xs sm:text-sm">
                                      {item.product_name} ({item.variant_name || "Default"})
                                    </span>
                                    <span className="rounded-full bg-[#C98A84] px-2 py-1 text-xs font-semibold text-white">
                                      x{item.quantity}
                                    </span>
                                  </div>
                                  {getItemDiscount(item) > 0 && (
                                    <div className="text-xs font-bold text-red-600">
                                      {item.discount_type ? `${String(item.discount_type).toUpperCase()} discount applied` : "Discount applied"}
                                    </div>
                                  )}
                                </div>
                              )) : <span className="text-slate-400">No items</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            {getDiscountAmount(order) > 0 ? (
                              <div className="flex flex-col items-center gap-1">
                                {discountedItems.length > 0 && (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {discountedItems.map((item, idx) => (
                                      <span key={idx} className="inline-block bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold uppercase">
                                        {item.discount_type || "discount"}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <span className="text-red-600 font-bold">-{formatMoney(getDiscountAmount(order))}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#2D2626] text-sm">{formatMoney(Number(order.total || 0))}</td>
                          <td className="px-4 py-3 text-slate-600 text-sm">
                            {order.last_edited_at ? new Date(order.last_edited_at).toLocaleString() : "No"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#E5DCD7] p-4 lg:p-6 mb-4 shadow-sm">
            <h3 className="text-lg font-bold text-[#2D2626] mb-4">Cashflow Transactions</h3>
            {transactions.length === 0 ? (
              <div className="text-center py-10 text-slate-500">No transactions found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F5EFEC] border-b border-[#E5DCD7]">
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
                      <tr key={transaction.id} className="hover:bg-[#FBF8F6]">
                        <td className="px-4 py-3 text-slate-600 text-sm">{new Date(transaction.date || transaction.created_at || new Date().toISOString()).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-semibold capitalize">
                          <span className={`rounded-full px-2 py-1 text-xs ${transaction.type === "payin" ? "bg-[#F3F0EA] text-[#6F765A]" : "bg-[#F8EFED] text-[#A76560]"}`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{transaction.category}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{transaction.description}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-[#2D2626]">{formatMoney(Number(transaction.amount || 0))}</td>
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
