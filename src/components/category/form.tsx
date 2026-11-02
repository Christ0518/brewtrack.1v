"use client";

import { useState } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { useAlertModal } from "@/hooks/useAlertModal";

interface CategoryFormProps {
  shopId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CategoryForm({
  shopId,
  onSuccess,
  onCancel
}: CategoryFormProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [loading, setLoading] = useState(false);
  const { showAlert, AlertModal } = useAlertModal();

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryError("Category name is required!");
      return;
    }

    try {
      setLoading(true);
      setCategoryError("");

      const response = await Fetch_to(
        `${api_links.tbl_category}?shop_id=${shopId}`,
        { name: newCategoryName.trim() },
        {},
        3,
        1000,
        "POST"
      );

      if (response.success) {
        setNewCategoryName("");
        onSuccess?.();
        showAlert("Category added successfully!", {
          variant: "success",
          title: "Category Added",
        });
      } else {
        setCategoryError(response.message || "Failed to add category");
      }
    } catch (err: any) {
      setCategoryError(err.message || "Failed to add category");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNewCategoryName("");
    setCategoryError("");
    onCancel?.();
  };

  return (
    <>
      <AlertModal />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl">
          <h2 className="mb-2 text-xl font-bold text-[#0F172A]">
            Add New Category
          </h2>
          <p className="mb-5 text-sm text-[#64748B]">Create a category to organize your product catalog.</p>

        {categoryError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {categoryError}
          </div>
        )}

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-[#334155]">
            Category Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="e.g., Hot Beverages, Pastries"
            className="min-h-12 w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-sm text-[#0F172A] outline-none transition focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
            autoFocus
            disabled={loading}
          />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={handleCancel}
            className="min-h-12 flex-1 rounded-xl border border-[#CBD5E1] px-4 text-sm font-semibold text-[#334155] transition-colors hover:bg-[#F1F5F9] disabled:opacity-50 sm:flex-none"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleAddCategory}
            className="min-h-12 flex-1 rounded-xl bg-[#059669] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            disabled={loading}
          >
            {loading ? "Adding..." : "Add category"}
          </button>
        </div>
        </div>
      </div>
    </>
  );
}
