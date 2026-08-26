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
      <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex justify-center items-center p-4 z-50">
        <div className="bg-white w-full max-w-md rounded-lg shadow-xl border border-[#d6c3af] p-6">
          <h2 className="text-xl font-bold text-[#6c3030] mb-4">
            Add New Category
          </h2>

        {categoryError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {categoryError}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Category Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="e.g., Hot Beverages, Pastries"
            className="w-full px-3.5 py-2.5 border border-[#d6c3af] rounded-lg text-[#6c3030] bg-white focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5] transition-all outline-none"
            autoFocus
            disabled={loading}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2.5 bg-[#f3e3cf] text-[#6e5338] rounded-lg hover:bg-[#ead8c5] transition-colors font-medium disabled:opacity-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleAddCategory}
            className="flex-1 px-4 py-2.5 bg-[#6c3030] hover:bg-[#522424] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? "Adding..." : "Add Category"}
          </button>
        </div>
        </div>
      </div>
    </>
  );
}
