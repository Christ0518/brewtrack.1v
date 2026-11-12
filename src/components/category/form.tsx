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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2626]/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-[#E9DFDB] bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F8EDEA] text-[#A76560]">
              <span className="text-lg font-bold">#</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2D2626]">
            Add New Category
              </h2>
              <p className="mt-1 text-sm text-[#796E6B]">Create a category to organize your product catalog.</p>
            </div>
          </div>

        {categoryError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {categoryError}
          </div>
        )}

        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-[#514441]">
            Category Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="e.g., Hot Beverages, Pastries"
            className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
            autoFocus
            disabled={loading}
          />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={handleCancel}
            className="min-h-12 flex-1 rounded-xl border border-[#E0D4CF] px-4 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#F5EFEC] disabled:opacity-50 sm:flex-none"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleAddCategory}
            className="min-h-12 flex-1 rounded-xl bg-[#C98A84] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#B97872] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
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
