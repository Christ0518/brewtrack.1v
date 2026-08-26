"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiAlertCircle, FiArrowLeft, FiCheckCircle } from "react-icons/fi";
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

export default function CashflowForm({ transactionId }: CashflowFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(transactionId);

  const [shopId, setShopId] = useState("1");
  const [shopColor, setShopColor] = useState("#6c3030");
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
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
    const storedShopColor = localStorage.getItem("shopColor");
    const resolvedTheme = getShopTheme(storedShopId);

    setShopId(storedShopId);
    setShopColor(storedShopColor || resolvedTheme.accentColor);
  }, []);

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
    }
  }, [isEditMode, transactionId]);

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

      showModal("success", isEditMode ? "Transaction updated successfully!" : "Transaction recorded successfully!");
      setTimeout(() => backToReports(), 1000);
    } catch (error) {
      console.error("Failed to save transaction:", error);
      showModal("error", "Failed to save transaction.");
    } finally {
      setSubmitting(false);
    }
  };

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
