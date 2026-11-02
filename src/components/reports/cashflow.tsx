"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiHash,
  FiMinus,
  FiPrinter,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiUser,
} from "react-icons/fi";
import Sidebar from "@/components/sidebar";
import api_links from "@/config/fetch_links/api_links.json";
import { getShopTheme } from "@/lib/theme";
import { Fetch_to } from "@/utilities";

type ModalState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

type CashflowFormData = {
  type: "payin" | "payout";
  category: string;
  description: string;
  amount: string;
  date: string;
  reference: string;
};

type CashflowFormProps = {
  transactionId?: string;
};

type CashflowTransaction = {
  id: number;
  type: "payin" | "payout" | string;
  category: string;
  description: string;
  amount: number;
  date: string;
  reference?: string | null;
  created_at?: string;
};

type HistoryOrderItem = {
  id: number;
  product_name?: string;
  variant_name?: string;
  quantity: number;
  subtotal?: number;
  price?: number;
};

type HistoryOrder = {
  id: number;
  created_at: string;
  order_type?: string;
  status?: string;
  total: number;
  discount?: number;
  paid?: number;
  change?: number;
  customer_name?: string;
  notes?: string | null;
  items: HistoryOrderItem[];
};

type OrderStatus = "completed" | "refunded" | "pending" | "cancelled";

function todayLocalDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function getOrderStatus(status?: string): OrderStatus {
  const normalizedStatus = status?.trim().toLowerCase();
  if (normalizedStatus === "completed") return "completed";
  if (normalizedStatus === "refunded") return "refunded";
  if (normalizedStatus === "cancelled" || normalizedStatus === "canceled") return "cancelled";
  return "pending";
}

function formatCurrency(value: number) {
  return `₱${Number(value || 0).toFixed(2)}`;
}

function formatOrderDate(value: string, options: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString(undefined, options);
}

export function TransactionHistory() {
  const router = useRouter();
  const [shopId, setShopId] = useState("1");
  const [shopName, setShopName] = useState("Shop");
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  useEffect(() => {
    setShopId(localStorage.getItem("shopId") || "1");
    setShopName(localStorage.getItem("shopName") || "Shop");

    const verify = async () => {
      const response = await Fetch_to(api_links.jwt.verify);
      if (!response.success) router.push("/");
    };
    void verify();
  }, [router]);

  const loadOrders = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(
        `${api_links.tbl_orders}?shop_id=${encodeURIComponent(shopId)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json", "x-shop-id": shopId },
          signal,
        }
      );
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data)) {
        throw new Error(
          (data as { message?: string } | null)?.message ||
            `Failed to load transaction history (${response.status})`
        );
      }
      setOrders(data as HistoryOrder[]);
      setSelectedOrderId((current) => current ?? (data[0] as HistoryOrder | undefined)?.id ?? null);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      console.error("Failed to load transaction history:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load transaction history.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadOrders(controller.signal);
    return () => controller.abort();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || getOrderStatus(order.status) === statusFilter;
      const searchableText = [
        order.id,
        order.customer_name,
        order.order_type,
        order.status,
        ...order.items.flatMap((item) => [item.product_name, item.variant_name]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [orders, search, statusFilter]);

  const selectedOrder =
    filteredOrders.find((order) => order.id === selectedOrderId) || filteredOrders[0] || null;
  const completedOrders = orders.filter((order) => getOrderStatus(order.status) === "completed");
  const completedSales = completedOrders.reduce((total, order) => total + Number(order.total || 0), 0);
  const statusTabs: { id: "all" | OrderStatus; label: string; count: number }[] = [
    { id: "all", label: "All transactions", count: orders.length },
    { id: "completed", label: "Completed", count: completedOrders.length },
    {
      id: "refunded",
      label: "Refunded",
      count: orders.filter((order) => getOrderStatus(order.status) === "refunded").length,
    },
    {
      id: "pending",
      label: "Pending",
      count: orders.filter((order) => getOrderStatus(order.status) === "pending").length,
    },
  ];

  const exportHistory = () => {
    const csvCell = (value: unknown) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = [
      ["Order", "Date", "Customer", "Type", "Status", "Items", "Total"],
      ...filteredOrders.map((order) => [
        `#${order.id}`,
        order.created_at,
        order.customer_name || "Walk-in",
        order.order_type || "POS",
        order.status || "pending",
        order.items.map((item) => `${item.quantity}x ${item.product_name || "Item"}`).join("; "),
        Number(order.total || 0).toFixed(2),
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transaction-history-${todayLocalDate()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const statusStyle: Record<OrderStatus, string> = {
    completed: "bg-[#E5F1E9] text-[#477259]",
    refunded: "bg-[#F5E7E5] text-[#A65F58]",
    pending: "bg-[#F7EEDC] text-[#967544]",
    cancelled: "bg-[#EAE5E2] text-[#766B67]",
  };

  return (
    <div className="flex min-h-screen bg-[#FAF6F4] text-[#2D2626]">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-8 pt-20 sm:px-6 lg:px-8 lg:pt-8">
          <header className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between print:hidden">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A46F69]">{shopName} · Point of sale</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2D2626] sm:text-4xl">Transaction history</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#847773]">
                Review sales, check payment details, and print a customer receipt.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                onClick={() => router.push("/dashboard/reports")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#DED4CF] bg-white px-4 text-sm font-semibold text-[#655955] transition hover:bg-[#FAF6F4]"
              >
                <FiArrowLeft size={16} />
                Reports
              </button>
              <button
                type="button"
                onClick={() => void loadOrders()}
                disabled={loading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#DED4CF] bg-[#FAF6F4] px-4 text-sm font-semibold text-[#655955] transition hover:bg-white disabled:opacity-50"
              >
                <FiRefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                type="button"
                onClick={exportHistory}
                disabled={filteredOrders.length === 0}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#B97973] disabled:opacity-50"
              >
                <FiDownload size={16} />
                Export
              </button>
            </div>
          </header>

          <section aria-label="Transaction summary" className="mb-6 grid gap-3 sm:grid-cols-3 print:hidden">
            {[
              { label: "Total transactions", value: orders.length.toLocaleString(), note: "All recorded orders" },
              { label: "Completed sales", value: formatCurrency(completedSales), note: `${completedOrders.length} completed orders` },
              { label: "Average order", value: formatCurrency(completedOrders.length ? completedSales / completedOrders.length : 0), note: "Based on completed sales" },
            ].map((summary) => (
              <article key={summary.label} className="rounded-2xl border border-[#E7DEDA] bg-[#ECE6E2] p-4 sm:p-5">
                <p className="text-sm font-semibold text-[#82736F]">{summary.label}</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-[#2D2626]">{summary.value}</p>
                <p className="mt-1 text-xs text-[#948681]">{summary.note}</p>
              </article>
            ))}
          </section>

          <label className="mb-5 flex min-h-[60px] items-center gap-3 rounded-2xl border border-[#E7DEDA] bg-white px-4 shadow-sm transition focus-within:border-[#C98A84] focus-within:ring-4 focus-within:ring-[#C98A84]/10 sm:px-5 print:hidden">
            <FiSearch aria-hidden="true" className="h-5 w-5 shrink-0 text-[#A28F89]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order number, customer, or item..."
              aria-label="Search transactions"
              className="min-w-0 flex-1 bg-transparent text-base text-[#2D2626] outline-none placeholder:text-[#A99A95]"
            />
            <span className="hidden text-xs font-medium text-[#A99A95] sm:block">Search transactions</span>
          </label>

          <nav aria-label="Filter transactions by status" className="mb-5 flex gap-2 overflow-x-auto pb-1 print:hidden">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                aria-pressed={statusFilter === tab.id}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                  statusFilter === tab.id
                    ? "bg-[#2D2626] text-white shadow-sm"
                    : "border border-[#E7DEDA] bg-white text-[#766965] hover:bg-[#F1EBE8]"
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusFilter === tab.id ? "bg-white/15 text-white" : "bg-[#F1EBE8] text-[#887A75]"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>

          {error && (
            <div role="alert" className="mb-5 rounded-xl border border-[#E7C7C3] bg-[#F9ECEA] p-4 text-sm text-[#8D4C46]">
              {error}
            </div>
          )}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <section aria-label="Transaction timeline" className="min-w-0 rounded-2xl border border-[#E7DEDA] bg-white p-4 shadow-sm sm:p-5 print:hidden">
              <header className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#2D2626]">Recent transactions</h2>
                  <p className="mt-1 text-sm text-[#92837E]">{filteredOrders.length} results</p>
                </div>
                <span className="rounded-lg bg-[#F4EEEB] px-3 py-2 text-xs font-semibold text-[#887A75]">Newest first</span>
              </header>

              {loading ? (
                <div className="flex min-h-72 items-center justify-center text-sm font-medium text-[#887A75]">
                  <FiRefreshCw className="mr-2 animate-spin" />
                  Loading transactions...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EEEB] text-[#A28F89]">
                    <FiShoppingBag size={21} />
                  </span>
                  <p className="font-semibold text-[#554946]">{search || statusFilter !== "all" ? "No matching transactions" : "No transactions yet"}</p>
                  <p className="mt-1 max-w-sm text-sm leading-5 text-[#92837E]">
                    {search || statusFilter !== "all" ? "Try another search or status filter." : "Completed POS orders will appear here."}
                  </p>
                </div>
              ) : (
                <div className="relative space-y-3 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-px before:bg-[#E8DEDA]">
                  {filteredOrders.map((order) => {
                    const orderStatus = getOrderStatus(order.status);
                    const isSelected = selectedOrder?.id === order.id;
                    return (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        aria-pressed={isSelected}
                        className={`relative flex w-full gap-3 rounded-xl border p-3 text-left transition sm:gap-4 sm:p-4 ${
                          isSelected
                            ? "border-[#D5A29D] bg-[#FBF4F2] shadow-sm"
                            : "border-transparent bg-white hover:border-[#E7DEDA] hover:bg-[#FCFAF9]"
                        }`}
                      >
                        <span className={`relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
                          orderStatus === "completed" ? "bg-[#E5F1E9] text-[#477259]" : orderStatus === "refunded" ? "bg-[#F5E7E5] text-[#A65F58]" : "bg-[#F7EEDC] text-[#967544]"
                        }`}>
                          {orderStatus === "completed" ? <FiCheckCircle size={17} /> : <FiClock size={17} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <span className="font-bold text-[#342B29]">Order #{order.id}</span>
                            <span className="text-sm font-bold text-[#342B29]">{formatCurrency(order.total)}</span>
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#857671]">
                            <span className="truncate">{order.customer_name || "Walk-in customer"}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatOrderDate(order.created_at, { hour: "numeric", minute: "2-digit" })}</span>
                          </span>
                          <span className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle[orderStatus]}`}>
                              {orderStatus}
                            </span>
                            <span className="rounded-full bg-[#F1EBE8] px-2.5 py-1 text-xs font-medium capitalize text-[#81736F]">
                              {(order.order_type || "POS").replace("-", " ")}
                            </span>
                            <span className="text-xs text-[#9A8D88]">{order.items.length} {order.items.length === 1 ? "item" : "items"}</span>
                          </span>
                        </span>
                        <FiChevronRight aria-hidden="true" className="mt-3 hidden shrink-0 text-[#B19D97] sm:block" />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section aria-label="Receipt preview" className="min-w-0 rounded-2xl border border-[#E7DEDA] bg-[#ECE6E2] p-4 shadow-sm sm:p-5 print:border-0 print:bg-white print:p-0 print:shadow-none">
              {!selectedOrder ? (
                <div className="flex min-h-96 flex-col items-center justify-center text-center">
                  <FiShoppingBag size={28} className="mb-3 text-[#A28F89]" />
                  <h2 className="font-bold text-[#554946]">Receipt preview</h2>
                  <p className="mt-1 text-sm text-[#92837E]">Select a transaction to view its receipt.</p>
                </div>
              ) : (
                <>
                  <header className="mb-4 flex items-center justify-between gap-3 print:hidden">
                    <div>
                      <h2 className="text-lg font-bold text-[#2D2626]">Receipt preview</h2>
                      <p className="mt-1 text-sm text-[#92837E]">Order #{selectedOrder.id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D8CCC7] bg-[#FAF6F4] px-4 text-sm font-semibold text-[#625551] transition hover:bg-white"
                    >
                      <FiPrinter size={16} />
                      Print receipt
                    </button>
                  </header>

                  <article className="mx-auto max-w-[440px] rounded-2xl border border-[#E7DEDA] bg-white p-5 shadow-sm sm:p-6 print:max-w-none print:rounded-none print:border-0 print:p-4 print:shadow-none">
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EEEB] text-[#A46F69] print:hidden">
                        <FiShoppingBag size={22} />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A46F69]">Sales receipt</p>
                      <h3 className="mt-1 text-xl font-bold text-[#2D2626]">{shopName}</h3>
                      <p className="mt-1 text-sm text-[#92837E]">Order #{selectedOrder.id}</p>
                    </div>

                    <div className="my-5 grid grid-cols-2 gap-3 border-y border-dashed border-[#E7DEDA] py-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#A2928D]">Date</p>
                        <p className="mt-1 font-semibold text-[#4D413E]">{formatOrderDate(selectedOrder.created_at, { month: "short", day: "numeric", year: "numeric" })}</p>
                        <p className="mt-0.5 text-xs text-[#8D7E79]">{formatOrderDate(selectedOrder.created_at, { hour: "numeric", minute: "2-digit" })}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#A2928D]">Status</p>
                        <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle[getOrderStatus(selectedOrder.status)]}`}>
                          {getOrderStatus(selectedOrder.status)}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <FiUser aria-hidden="true" className="shrink-0 text-[#A2928D]" />
                        <span className="truncate font-medium text-[#4D413E]">{selectedOrder.customer_name || "Walk-in customer"}</span>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <FiCalendar aria-hidden="true" className="shrink-0 text-[#A2928D]" />
                        <span className="capitalize text-[#6F625E]">{(selectedOrder.order_type || "POS").replace("-", " ")}</span>
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-[#A2928D]">
                        <span>Item</span>
                        <span>Amount</span>
                      </div>
                      <div className="space-y-3">
                        {selectedOrder.items.map((item) => (
                          <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#4D413E]">{item.product_name || "Product"}</p>
                              {item.variant_name && <p className="mt-0.5 text-xs text-[#92837E]">{item.variant_name}</p>}
                              <p className="mt-0.5 text-xs text-[#92837E]">Qty {item.quantity}</p>
                            </div>
                            <p className="shrink-0 font-medium text-[#4D413E]">
                              {formatCurrency(Number(item.subtotal ?? Number(item.price || 0) * item.quantity))}
                            </p>
                          </div>
                        ))}
                        {selectedOrder.items.length === 0 && (
                          <p className="text-sm text-[#92837E]">No item details available for this order.</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 space-y-2 border-t border-dashed border-[#E7DEDA] pt-4 text-sm">
                      {Number(selectedOrder.discount || 0) > 0 && (
                        <div className="flex justify-between text-[#857671]">
                          <span>Discount</span>
                          <span>−{formatCurrency(Number(selectedOrder.discount))}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 text-base font-bold text-[#2D2626]">
                        <span>Total</span>
                        <span>{formatCurrency(selectedOrder.total)}</span>
                      </div>
                      <div className="flex justify-between text-[#857671]">
                        <span>Paid</span>
                        <span>{formatCurrency(Number(selectedOrder.paid ?? selectedOrder.total))}</span>
                      </div>
                      <div className="flex justify-between text-[#857671]">
                        <span>Change</span>
                        <span>{formatCurrency(Number(selectedOrder.change || 0))}</span>
                      </div>
                    </div>

                    {selectedOrder.notes && (
                      <div className="mt-4 rounded-xl bg-[#F8F4F2] p-3 text-xs leading-5 text-[#766965] print:bg-white print:p-0">
                        <span className="inline-flex items-center gap-1 font-semibold"><FiHash size={12} /> Note</span>
                        <p className="mt-1">{selectedOrder.notes}</p>
                      </div>
                    )}
                    <p className="mt-6 text-center text-xs text-[#A2928D]">Thank you for your purchase</p>
                  </article>
                </>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CashflowForm({ transactionId }: CashflowFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(transactionId);

  const [shopId, setShopId] = useState("1");
  const [shopName, setShopName] = useState("Shop");
  const [shopColor, setShopColor] = useState("#6c3030");
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [transactions, setTransactions] = useState<CashflowTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState("");
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [modal, setModal] = useState<ModalState>({ show: false, type: "success", message: "" });
  const [formData, setFormData] = useState<CashflowFormData>({
    type: "payout",
    category: "supplies",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    reference: "",
  });


  useEffect(() => {
    const storedShopId = localStorage.getItem("shopId") || "1";
    const storedShopName = localStorage.getItem("shopName");
    const storedShopColor = localStorage.getItem("shopColor");
    const resolvedTheme = getShopTheme(storedShopId);

    setShopId(storedShopId);
    if (storedShopName) setShopName(storedShopName);
    setShopColor(storedShopColor || resolvedTheme.accentColor);
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      setTransactionsLoading(true);
      setTransactionsError("");
      const response = await fetch(
        `${api_links.tbl_cashflow}?shop_id=${encodeURIComponent(shopId)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json", "x-shop-id": shopId },
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data)) {
        throw new Error(data?.message || `Failed to load cash transactions (${response.status})`);
      }
      setTransactions(data);
    } catch (error) {
      console.error("Failed to fetch cash transactions:", error);
      setTransactionsError(error instanceof Error ? error.message : "Failed to load cash transactions.");
    } finally {
      setTransactionsLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    const verify = async () => {
      const response = await Fetch_to(api_links.jwt.verify);
      if (!response.success) {
        router.push("/");
      }
    };

    verify();
  }, [router]);

  useEffect(() => {
    if (isEditMode && transactionId) {
      fetchTransaction(transactionId);
    } else if (shopId) {
      loadTransactions();
    }
  }, [isEditMode, transactionId, shopId, loadTransactions]);

  const showModal = (type: "success" | "error", message: string) => {
    setModal({ show: true, type, message });
  };

  const closeModal = () => {
    setModal((current) => ({ ...current, show: false }));
  };

  const backToReports = () => {
    router.push("/dashboard/reports");
  };

  const fetchTransaction = async (id: string) => {
    try {
      setLoading(true);

      const response = await fetch(`${api_links.tbl_cashflow}?id=${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-shop-id": shopId,
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data) {
        throw new Error(data?.message || `Failed to load transaction (${response.status})`);
      }

      setFormData({
        type: data.type === "payin" ? "payin" : "payout",
        category: data.category || "",
        description: data.description || "",
        amount: String(data.amount ?? ""),
        date: data.date || new Date().toISOString().split("T")[0],
        reference: data.reference || "",
      });
    } catch (error) {
      console.error("Failed to fetch transaction:", error);
      showModal("error", "Failed to load transaction details.");
      setTimeout(() => backToReports(), 1300);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const updateType = (type: "payin" | "payout") => {
    setFormData((previous) => ({ ...previous, type }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.description || !formData.amount || !formData.category) {
      showModal("error", "Please fill in all required fields.");
      return;
    }

    if (parseFloat(formData.amount) <= 0) {
      showModal("error", "Amount must be greater than 0.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        ...(isEditMode && transactionId ? { id: Number(transactionId) } : {}),
        type: formData.type,
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: formData.date,
        reference: formData.reference || null,
      };

      const result = await Fetch_to(
        api_links.tbl_cashflow,
        payload,
        {
          "x-shop-id": shopId,
          "Content-Type": "application/json",
        },
        1,
        0,
        isEditMode ? "PUT" : "POST"
      );

      if (!result.success) {
        showModal("error", result.message || "Failed to save transaction.");
        return;
      }

      if (isEditMode) {
        showModal("success", "Transaction updated successfully!");
        setTimeout(() => backToReports(), 1000);
      } else {
        setShowMovementForm(false);
        setFormData({
          type: "payout",
          category: "Vendor Petty Cash",
          description: "",
          amount: "",
          date: todayLocalDate(),
          reference: "",
        });
        await loadTransactions();
        showModal("success", "Cash transaction recorded successfully.");
      }
    } catch (error) {
      console.error("Failed to save transaction:", error);
      showModal("error", "Failed to save transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  const today = todayLocalDate();
  const todayMovements = useMemo(
    () => transactions.filter((transaction) => String(transaction.date || "").slice(0, 10) === today),
    [transactions, today]
  );
  const cashflowSummary = useMemo(() => {
    const cashIn = todayMovements
      .filter((transaction) => transaction.type === "payin")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const payouts = todayMovements
      .filter((transaction) => transaction.type === "payout")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const ascending = [...todayMovements].sort(
      (first, second) =>
        new Date(first.created_at || first.date).getTime() -
        new Date(second.created_at || second.date).getTime()
    );
    return {
      cashIn,
      payouts,
      netMovement: cashIn - payouts,
      chronological: ascending.reverse(),
    };
  }, [todayMovements]);

  const openMovementForm = (type: "payin" | "payout") => {
    setFormData({
      type,
      category: type === "payin" ? "Change Float" : "Vendor Petty Cash",
      description: "",
      amount: "",
      date: todayLocalDate(),
      reference: "",
    });
    setModal((current) => ({ ...current, show: false }));
    setShowMovementForm(true);
  };

  const closeMovementForm = () => {
    if (submitting) return;
    setShowMovementForm(false);
  };

  const exportMovementLog = () => {
    const csvCell = (value: unknown) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = [
      ["Date", "Type", "Category", "Description", "Reference", "Amount"],
      ...cashflowSummary.chronological.map((transaction) => [
        transaction.created_at || transaction.date,
        transaction.type,
        transaction.category,
        transaction.description,
        transaction.reference || "",
        Number(transaction.amount || 0).toFixed(2),
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cashflow-${today}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!isEditMode) {
    const summaryCards = [
      { label: "Cash in", value: `₱${cashflowSummary.cashIn.toFixed(2)}`, note: "Pay-in transactions today", color: "#059669", icon: FiPlus },
      { label: "Cash out", value: `₱${cashflowSummary.payouts.toFixed(2)}`, note: "Pay-out transactions today", color: "#DC2626", icon: FiMinus },
      { label: "Net movement", value: `₱${cashflowSummary.netMovement.toFixed(2)}`, note: "Cash in minus cash out today", color: "#4F46E5", icon: FiRefreshCw },
    ];

    return (
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full px-4 py-6 sm:px-6 lg:px-8">
            <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <button
                  onClick={backToReports}
                  className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <FiArrowLeft size={16} />
                  Back to Reports
                </button>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">{shopName} · {today}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Cash flow</h1>
                <p className="mt-1 text-sm text-slate-500">Review today&apos;s cash-in and cash-out transactions.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => openMovementForm("payin")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#059669] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#047857]"
                >
                  <FiPlus size={17} />
                  Cash In
                </button>
                <button
                  onClick={() => openMovementForm("payout")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#B91C1C]"
                >
                  <FiMinus size={17} />
                  Cash Out
                </button>
              </div>
            </header>

            <section aria-label="Cash flow summary" className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {summaryCards.map((card) => {
                const CardIcon = card.icon;
                return (
                  <article key={card.label} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-500">{card.label}</span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ color: card.color, backgroundColor: `${card.color}14` }}>
                        <CardIcon size={17} />
                      </span>
                    </div>
                    <p className="truncate text-xl font-bold tracking-tight text-slate-950">{card.value}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{card.note}</p>
                  </article>
                );
              })}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Cash transactions</h2>
                  <p className="mt-1 text-sm text-slate-500">Pay-ins and pay-outs for {today}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={loadTransactions}
                    disabled={transactionsLoading}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <FiRefreshCw size={15} className={transactionsLoading ? "animate-spin" : ""} />
                    Refresh
                  </button>
                  <button
                    onClick={exportMovementLog}
                    disabled={todayMovements.length === 0}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <FiDownload size={15} />
                    Export CSV
                  </button>
                </div>
              </header>

              {transactionsError && (
                <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {transactionsError}
                </div>
              )}

              {transactionsLoading ? (
                <div className="flex min-h-48 items-center justify-center text-sm font-medium text-slate-500">
                  <FiRefreshCw className="mr-2 animate-spin" />
                  Loading transactions...
                </div>
              ) : todayMovements.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <FiClock size={21} />
                  </span>
                  <p className="font-semibold text-slate-800">No cash transactions recorded today</p>
                  <p className="mt-1 text-sm text-slate-500">Cash-in and cash-out transactions will appear here after they are saved.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Date & time", "Type / category", "Description", "Amount", "Reference"].map((heading) => (
                          <th key={heading} className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cashflowSummary.chronological.map((transaction) => {
                        const isCashIn = transaction.type === "payin";
                        const timestamp = transaction.created_at || transaction.date;
                        return (
                          <tr key={transaction.id} className="transition-colors hover:bg-slate-50/80">
                            <td className="whitespace-nowrap px-5 py-4">
                              <div className="text-sm font-semibold text-slate-800">{new Date(timestamp).toLocaleDateString()}</div>
                              <div className="mt-0.5 text-xs text-slate-500">{new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${isCashIn ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                {isCashIn ? "Cash In" : "Cash Out"}
                              </span>
                              <p className="mt-1.5 text-xs font-medium text-slate-500">{transaction.category}</p>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">{transaction.description}
                            </td>
                            <td className={`whitespace-nowrap px-5 py-4 text-sm font-bold ${isCashIn ? "text-emerald-700" : "text-red-700"}`}>
                              {isCashIn ? "+" : "−"}₱{Number(transaction.amount || 0).toFixed(2)}
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-500">{transaction.reference || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>

        {showMovementForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <section role="dialog" aria-modal="true" aria-labelledby="movement-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
              <header className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className={`text-sm font-semibold ${formData.type === "payin" ? "text-emerald-700" : "text-red-700"}`}>
                    {formData.type === "payin" ? "Record a cash-in transaction" : "Record a cash-out transaction"}
                  </p>
                  <h2 id="movement-title" className="mt-1 text-xl font-bold text-slate-950">
                    {formData.type === "payin" ? "Cash In" : "Cash Out"}
                  </h2>
                </div>
                <button onClick={closeMovementForm} disabled={submitting} aria-label="Close movement form" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50">×</button>
              </header>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {(["payin", "payout"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateType(type)}
                      className={`min-h-11 rounded-lg border text-sm font-semibold ${
                        formData.type === type
                          ? type === "payin"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                            : "border-red-600 bg-red-50 text-red-800"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {type === "payin" ? "Cash in" : "Cash out"}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Reason</label>
                  <input
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    list="cashflow-reasons"
                    placeholder="e.g., Vendor Petty Cash, Supplies"
                    className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    required
                  />
                  <datalist id="cashflow-reasons">
                    <option value="Vendor Petty Cash" />
                    <option value="Supplies" />
                  </datalist>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description</label>
                  <input name="description" value={formData.description} onChange={handleFormChange} placeholder="Add details for this movement" className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Amount (₱)</label>
                    <input type="number" name="amount" min="0.01" step="0.01" value={formData.amount} onChange={handleFormChange} placeholder="0.00" className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date</label>
                    <input type="date" name="date" value={formData.date} onChange={handleFormChange} className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" required />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Reference (optional)</label>
                  <input name="reference" value={formData.reference} onChange={handleFormChange} placeholder="Receipt or note" className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" />
                </div>
                <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                  <button type="button" onClick={closeMovementForm} disabled={submitting} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                  <button type="submit" disabled={submitting} className={`min-h-11 rounded-lg px-5 text-sm font-semibold text-white disabled:opacity-50 ${formData.type === "payin" ? "bg-[#059669] hover:bg-[#047857]" : "bg-[#DC2626] hover:bg-[#B91C1C]"}`}>
                    {submitting ? "Saving..." : "Record movement"}
                  </button>
                </footer>
              </form>
            </section>
          </div>
        )}

        {modal.show && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
            <section role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <span className={`mb-3 inline-flex ${modal.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                {modal.type === "success" ? <FiCheckCircle size={24} /> : <FiAlertCircle size={24} />}
              </span>
              <h2 className="text-lg font-bold text-slate-950">{modal.type === "success" ? "Success" : "Could not save"}</h2>
              <p className="mt-2 text-sm text-slate-600">{modal.message}</p>
              <button onClick={closeModal} className="mt-5 min-h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">Close</button>
            </section>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f1e8] flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: shopColor }}
          />
          <p className="text-[#8a6245] font-medium">Loading transaction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8f1e8]">
      <Sidebar />

      <div className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mb-6">
            <button
              onClick={backToReports}
              className="flex items-center gap-2 font-medium mb-4 transition-colors text-sm"
              style={{ color: shopColor }}
            >
              <FiArrowLeft size={18} />
              Back to Reports
            </button>

            <h1 className="text-3xl font-bold text-[#6c3030] mb-2">{isEditMode ? "Edit Transaction" : "New Transaction"}</h1>
            <p className="text-[#8a6245]">
              {isEditMode ? "Update the transaction details below" : "Record a new cash in or cash out transaction"}
            </p>
          </div>

          <div className="max-w-2xl mx-auto bg-white rounded-lg border border-[#d6c3af] p-6 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-[#6c3030] mb-3">
                  Transaction Type <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {["payin", "payout"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateType(type as "payin" | "payout")}
                      className={`p-4 rounded-lg border-2 transition-all font-medium ${
                        formData.type === type
                          ? type === "payin"
                            ? "border-green-600 bg-green-50 text-green-900"
                            : "border-red-600 bg-red-50 text-red-900"
                          : "border-[#d6c3af] bg-white text-[#8a6245] hover:border-[#bc9b7a]"
                      }`}
                    >
                      {type === "payin" ? "Pay In" : "Pay Out"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6c3030] mb-3">
                  Category <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                  placeholder="e.g., Petty Cash, Supplies, Payroll"
                  className="w-full px-4 py-3 border border-[#d6c3af] rounded-lg transition-all outline-none text-sm font-medium focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5]"
                  style={{ borderColor: "#cbd5e1" }}
                />
                <p className="text-xs text-slate-500 mt-2">Enter any category name</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6c3030] mb-3">
                  Description <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="e.g., Coffee beans purchase, Daily sales, Employee salary"
                  className="w-full px-4 py-3 border border-[#d6c3af] rounded-lg transition-all outline-none text-sm focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5]"
                />
                <p className="text-xs text-slate-500 mt-2">Provide a clear description of the transaction</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6c3030] mb-3">
                  Amount (PHP) <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">PHP</span>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleFormChange}
                    placeholder="0.00"
                    min="0"
                    className="w-full pl-12 pr-4 py-3 border border-[#d6c3af] rounded-lg transition-all outline-none text-sm font-medium focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6c3030] mb-3">Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                  className="w-full px-4 py-3 border border-[#d6c3af] rounded-lg transition-all outline-none text-sm font-medium focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6c3030] mb-3">Reference / Notes</label>
                <input
                  type="text"
                  name="reference"
                  value={formData.reference}
                  onChange={handleFormChange}
                  placeholder="e.g., Invoice 12345, Check 001, Receipt 789"
                  className="w-full px-4 py-3 border border-[#d6c3af] rounded-lg transition-all outline-none text-sm focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5]"
                />
                <p className="text-xs text-slate-500 mt-2">Optional: Add invoice number, check number, or any reference</p>
              </div>

              <div
                className={`p-4 rounded-lg ${
                  formData.type === "payin" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                }`}
              >
                <div className="text-sm font-medium text-slate-600 mb-2">Summary</div>
                <div className={`text-2xl font-bold ${formData.type === "payin" ? "text-green-600" : "text-red-600"}`}>
                  {formData.type === "payin" ? "+" : "-"}PHP{(parseFloat(formData.amount) || 0).toFixed(2)}
                </div>
                <div className="text-xs text-slate-600 mt-2">{formData.description || "No description provided"}</div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={backToReports}
                  className="flex-1 bg-[#f3e3cf] hover:bg-[#ead8c5] text-[#6c3030] px-6 py-3 rounded-lg transition-all font-medium text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 text-white px-6 py-3 rounded-lg transition-all font-medium text-base disabled:bg-slate-400"
                  style={{ backgroundColor: shopColor }}
                >
                  {submitting ? "Saving..." : isEditMode ? "Update Transaction" : "Record Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>

      {modal.show && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  modal.type === "success" ? "bg-green-100" : "bg-red-100"
                }`}
              >
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
                className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                  modal.type === "success" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
