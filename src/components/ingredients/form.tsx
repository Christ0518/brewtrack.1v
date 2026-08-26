"use client";

import { useState } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { useAlertModal } from "@/hooks/useAlertModal";

interface Ingredient {
  id: number;
  ingredient_name: string;
  unit: string;
  unit_price: number | null;
  quantity: number | null;
  expiration_date?: string | null;
}

interface IngredientFormProps {
  mode: "create" | "edit" | "delete";
  shopId: string;
  ingredient?: Ingredient;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function IngredientForm({
  mode,
  shopId,
  ingredient,
  onSuccess,
  onCancel
}: IngredientFormProps) {
  const formatExpirationDate = (date?: string | null) => {
    if (!date) return "";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().split("T")[0];
  };

  const [form, setForm] = useState({
    ingredient_name: ingredient?.ingredient_name || "",
    unit: ingredient?.unit || "",
    quantity: ingredient?.quantity?.toString() || "",
    unit_price: ingredient?.unit_price?.toString() || "",
    expiration_date: formatExpirationDate(ingredient?.expiration_date)
  });
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const { showAlert, AlertModal } = useAlertModal();

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);

    try {
      if (!form.ingredient_name || !form.unit) {
        throw new Error("Ingredient name and unit are required");
      }

      if (!form.quantity || form.quantity === "") {
        throw new Error("Quantity is required");
      }

      if (mode === "create" && !form.expiration_date) {
        throw new Error("Expiration date is required for each ingredient batch");
      }

      const payload = {
        ingredient_name: form.ingredient_name,
        unit: form.unit,
        quantity: Number(form.quantity),
        unit_price: form.unit_price ? Number(form.unit_price) : undefined,
        expiration_date: form.expiration_date ? form.expiration_date : null
      };

      console.log("DEBUG - Form payload:", payload);

      let response;
      if (mode === "create") {
        response = await Fetch_to(
          `${api_links.tbl_ingredients}?shop_id=${shopId}`,
          payload,
          {},
          3,
          1000,
          "POST"
        );
      } else if (mode === "edit") {
        response = await Fetch_to(
          `${api_links.tbl_ingredients}?shop_id=${shopId}&id=${ingredient?.id}`,
          payload,
          {},
          3,
          1000,
          "PUT"
        );
      } else if (mode === "delete") {
        response = await Fetch_to(
          `${api_links.tbl_ingredients}?shop_id=${shopId}&id=${ingredient?.id}`,
          {},
          {},
          3,
          1000,
          "DELETE"
        );
      }

      if (!response?.success) {
        throw new Error(response?.message || "Operation failed");
      }

      showAlert(
        `Ingredient ${
          mode === "delete"
            ? "deleted"
            : mode === "edit"
            ? "updated"
            : "added"
        } successfully!`,
        { variant: "success", title: "Ingredient Saved" }
      );
      onSuccess?.();
    } catch (err: any) {
      setFormError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Delete confirmation dialog
  if (mode === "delete") {
    return (
      <>
        <AlertModal />
        <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-lg shadow-xl border border-[#d6c3af] p-6">
          <h2 className="text-xl font-bold text-[#6c3030] mb-2">Delete Ingredient</h2>
          <p className="text-slate-600 mb-6">
            Are you sure you want to delete "{ingredient?.ingredient_name}"? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleFormSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              {loading ? "Deleting..." : "Delete"}
            </button>
          </div>
          </div>
        </div>
      </>
    );
  }

  // Add/Edit form
  return (
    <>
      <AlertModal />
      <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex justify-center items-center p-4 z-50 overflow-y-auto">
        <div className="bg-white w-full max-w-md rounded-lg shadow-xl border border-[#d6c3af] p-6 my-8">
        <h2 className="text-xl font-bold text-[#6c3030] mb-4">
          {mode === "edit" ? "Edit Ingredient" : "Add Ingredient"}
        </h2>

        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {formError}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Ingredient Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={form.ingredient_name}
              onChange={(e) => setForm({ ...form, ingredient_name: e.target.value })}
              placeholder="e.g., Ground Coffee"
              className="w-full px-3.5 py-2.5 border border-[#d6c3af] rounded-lg text-[#6c3030] bg-white focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5] transition-all outline-none"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Unit <span className="text-red-600">*</span>
            </label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-[#d6c3af] rounded-lg text-[#6c3030] bg-white focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5] transition-all outline-none cursor-pointer"
              required
              disabled={loading}
            >
              <option value="">Select Unit</option>
              <option value="kg">Kilogram (kg)</option>
              <option value="g">Gram (g)</option>
              <option value="L">Liter (L)</option>
              <option value="ml">Milliliter (ml)</option>
              <option value="pcs">Pieces (pcs)</option>
              <option value="box">Box</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Quantity <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="Current stock"
              className="w-full px-3.5 py-2.5 border border-[#d6c3af] rounded-lg text-[#6c3030] bg-white focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5] transition-all outline-none"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Unit Price
            </label>
            <input
              type="number"
              step="0.01"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              placeholder="Cost per unit"
              className="w-full px-3.5 py-2.5 border border-[#d6c3af] rounded-lg text-[#6c3030] bg-white focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5] transition-all outline-none"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Expiration Date {mode === "create" && <span className="text-red-600">*</span>}
            </label>
            <input
              type="date"
              value={form.expiration_date}
              onChange={(e) => setForm({ ...form, expiration_date: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-[#d6c3af] rounded-lg text-[#6c3030] bg-white focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5] transition-all outline-none"
              required={mode === "create"}
              disabled={loading}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-[#6c3030] hover:bg-[#522424] text-white rounded-lg transition-colors font-medium disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Saving..." : mode === "edit" ? "Update" : "Add"} Ingredient
            </button>
          </div>
        </form>
        </div>
      </div>
    </>
  );
}
