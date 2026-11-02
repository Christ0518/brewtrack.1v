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
        quantity: form.quantity,
        unit_price: form.unit_price || undefined,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2626]/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#E9DFDB] bg-[#FAF6F4] p-6 shadow-2xl">
          <h2 className="mb-2 text-xl font-bold text-[#2D2626]">Delete Ingredient</h2>
          <p className="mb-6 text-sm leading-6 text-[#796E6B]">
            Are you sure you want to delete "{ingredient?.ingredient_name}"? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="min-h-12 flex-1 rounded-xl border border-[#E0D4CF] px-4 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#ECE6E2]"
            >
              Cancel
            </button>
            <button
              onClick={handleFormSubmit}
              disabled={loading}
              className="min-h-12 flex-1 rounded-xl bg-[#A76560] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#8F514C] disabled:opacity-50"
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
      <main className="min-h-screen bg-[#FAF6F4] px-4 pb-8 pt-20 text-[#2D2626] sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:flex-row sm:items-center sm:p-6">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9B7773]">Inventory · Ingredients</p>
              <h1 className="text-2xl font-bold tracking-tight text-[#2D2626] sm:text-3xl">
                {mode === "edit" ? "Edit ingredient" : "Add ingredient"}
              </h1>
              <p className="mt-1 text-sm text-[#8A7C78]">
                {mode === "edit" ? "Update ingredient details and stock information." : "Add a raw material to your inventory."}
              </p>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="min-h-12 shrink-0 rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-4 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#ECE6E2] disabled:opacity-50"
              >
                Back to inventory
              </button>
            )}
          </header>

          <section className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_10px_32px_rgba(69,47,39,0.05)] sm:p-7">
            <div className="mb-6 border-b border-[#F0E9E6] pb-5">
              <h2 className="text-lg font-bold text-[#2D2626]">Ingredient details</h2>
              <p className="mt-1 text-sm text-[#8A7C78]">Fields marked with <span className="text-[#A76560]">*</span> are required.</p>
            </div>

            {formError && (
              <div className="mb-5 rounded-xl border border-[#E5C7C2] bg-[#F8EDEA] p-3 text-sm text-[#8F514C]">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#514441]">
                  Ingredient Name <span className="text-[#A76560]">*</span>
                </label>
                <input
                  type="text"
                  value={form.ingredient_name}
                  onChange={(e) => setForm({ ...form, ingredient_name: e.target.value })}
                  placeholder="e.g., Ground Coffee"
                  className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none transition placeholder:text-[#A39490] focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/15"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#514441]">
                  Unit <span className="text-[#A76560]">*</span>
                </label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="min-h-12 w-full cursor-pointer rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/15"
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
                <label className="mb-2 block text-sm font-semibold text-[#514441]">
                  Quantity <span className="text-[#A76560]">*</span>
                </label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="Current stock"
                  className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none transition placeholder:text-[#A39490] focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/15"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#514441]">Cost per unit</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#8A7C78]">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                    placeholder="0.00"
                    className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] pl-9 pr-3.5 text-sm text-[#2D2626] outline-none transition placeholder:text-[#A39490] focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/15"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#514441]">
                  Expiration Date {mode === "create" && <span className="text-[#A76560]">*</span>}
                </label>
                <input
                  type="date"
                  value={form.expiration_date}
                  onChange={(e) => setForm({ ...form, expiration_date: e.target.value })}
                  className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/15 md:max-w-[calc(50%-0.625rem)]"
                  required={mode === "create"}
                  disabled={loading}
                />
              </div>

              <div className="mt-2 flex flex-col-reverse gap-3 border-t border-[#F0E9E6] pt-5 sm:flex-row sm:justify-end md:col-span-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="min-h-12 rounded-xl border border-[#E0D4CF] px-5 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#ECE6E2] disabled:opacity-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-12 rounded-xl bg-[#C98A84] px-6 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(201,138,132,0.2)] transition-colors hover:bg-[#B97973] disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Saving..." : mode === "edit" ? "Update" : "Add"} Ingredient
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
