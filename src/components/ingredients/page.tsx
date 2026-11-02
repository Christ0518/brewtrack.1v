"use client";

import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import IngredientForm from "./form";
import {
  FiAlertCircle,
  FiEdit,
  FiPackage,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiCheckCircle,
  FiX,
} from "react-icons/fi";

interface Ingredient {
  id: number;
  ingredient_name: string;
  unit: string;
  unit_price: number | null;
  quantity: number | null;
  expiration_date?: string | null;
  batches?: {
    id: number;
    remaining_quantity: number | null;
    expiration_date: string | null;
  }[];
}

interface AddOn {
  id: number | string;
  ingredient_id?: number | string | null;
  name: string;
  quantity: number | null;
  unit: string;
  price: number | null;
  unit_price: number | null;
  quantity_per_item: number | null;
}

interface IngredientsPageProps {
  shopId?: string;
}

export default function IngredientsPage({ shopId = "1" }: IngredientsPageProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addonSearchQuery, setAddonSearchQuery] = useState("");
  const [filterStock, setFilterStock] = useState("all");
  const [loading, setLoading] = useState(true);
  const [addOnLoading, setAddOnLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "delete">("create");
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | undefined>();
  const [quantityIngredient, setQuantityIngredient] = useState<Ingredient | null>(null);
  const [quantityForm, setQuantityForm] = useState({ quantity: "", unit_price: "", expiration_date: "" });
  const [quantityFormError, setQuantityFormError] = useState("");
  const [submittingQuantity, setSubmittingQuantity] = useState(false);
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  const [editingAddOnId, setEditingAddOnId] = useState<number | string | null>(null);
  const [submittingAddOn, setSubmittingAddOn] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; id: number | string | null; name: string; isAddOn: boolean }>({
    show: false,
    id: null,
    name: "",
    isAddOn: false,
  });
  const [addOnForm, setAddOnForm] = useState({
    name: "",
    quantity: "",
    unit: "ml",
    unit_price: "",
    price: "",
    quantity_per_item: "1",
    ingredient_id: "",
  });

  const getLowStockThreshold = (unit: string) => {
    if (unit === "pcs" || unit === "box") return 20;
    if (unit === "ml") return 3000;
    if (unit === "g") return 500;
    if (unit === "L") return 3;
    if (unit === "kg") return 0.5;
    return 100;
  };

  const hasStockData = (ingredient: Ingredient) =>
    ingredient.quantity !== null &&
    ingredient.quantity !== undefined &&
    Number.isFinite(Number(ingredient.quantity));

  const parseCalendarDate = (date: string) => {
    const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatCalendarDate = (date?: string | null) => {
    if (!date) return "—";
    const parsed = parseCalendarDate(date);
    return parsed ? parsed.toLocaleDateString() : "—";
  };

  const isExpired = (expiration_date?: string | null) => {
    if (!expiration_date) return false;
    const today = new Date();
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    const expirationKey = expiration_date.slice(0, 10);
    return expirationKey <= todayKey;
  };

  const isNearExpiration = (expiration_date?: string | null) => {
    if (!expiration_date) return false;
    const expiration = parseCalendarDate(expiration_date);
    if (!expiration) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMillis = expiration.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMillis / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const response = await Fetch_to(
        `${api_links.tbl_ingredients}?shop_id=${shopId}`,
        {},
        {},
        3,
        1000,
        "GET"
      );

      if (response.success && Array.isArray(response.data)) {
        setIngredients(response.data);
      }
    } catch (error) {
      console.error("Error fetching ingredients:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAddOns = async () => {
    try {
      setAddOnLoading(true);
      const response = await Fetch_to(
        api_links.tbl_toppings,
        {},
        {},
        3,
        1000,
        "GET"
      );

      if (response.success && Array.isArray(response.data)) {
        setAddOns(response.data as AddOn[]);
      }
    } catch (error) {
      console.error("Error fetching add-ons:", error);
    } finally {
      setAddOnLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
    fetchAddOns();
  }, [shopId]);

  const handleCreateClick = () => {
    setFormMode("create");
    setSelectedIngredient(undefined);
    setShowForm(true);
  };

  const handleEditClick = (ingredient: Ingredient) => {
    setFormMode("edit");
    setSelectedIngredient(ingredient);
    setShowForm(true);
  };

  const handleDeleteClick = (ingredient: Ingredient) => {
    setFormMode("delete");
    setSelectedIngredient(ingredient);
    setShowForm(true);
  };

  const openAddQuantity = (ingredient: Ingredient) => {
    setQuantityIngredient(ingredient);
    setQuantityForm({
      quantity: "",
      unit_price: ingredient.unit_price?.toString() ?? "",
      expiration_date: "",
    });
    setQuantityFormError("");
  };

  const closeAddQuantity = () => {
    if (submittingQuantity) return;
    setQuantityIngredient(null);
    setQuantityFormError("");
  };

  const handleSubmitQuantity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quantityIngredient) return;

    setQuantityFormError("");
    setSubmittingQuantity(true);
    try {
      const response = await Fetch_to(
        `${api_links.tbl_ingredients}/batches?shop_id=${shopId}`,
        {
          ingredient_id: quantityIngredient.id,
          quantity: quantityForm.quantity,
          unit_price: quantityForm.unit_price,
          expiration_date: quantityForm.expiration_date,
        },
        {},
        1,
        1000,
        "POST"
      );

      if (!response.success) {
        setQuantityFormError(response.message);
        return;
      }

      setQuantityIngredient(null);
      await fetchIngredients();
    } catch (error) {
      console.error("Failed to add ingredient quantity:", error);
      setQuantityFormError("Could not add stock. Please try again.");
    } finally {
      setSubmittingQuantity(false);
    }
  };

  const openDeleteModal = (id: number | string, name: string, isAddOn = false) => {
    setDeleteModal({ show: true, id, name, isAddOn });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ show: false, id: null, name: "", isAddOn: false });
  };

  const openAddOnModal = (ingredient?: Ingredient) => {
    setEditingAddOnId(null);
    setSelectedIngredient(ingredient);
    if (ingredient) {
      setAddOnForm({
        name: ingredient.ingredient_name,
        quantity: String(ingredient.quantity ?? ""),
        unit: ingredient.unit || "ml",
        unit_price: String(ingredient.unit_price ?? ""),
        price: "",
        quantity_per_item: "1",
        ingredient_id: String(ingredient.id),
      });
    }
    setShowAddOnModal(true);
  };

  const openEditAddOnModal = (addOn: AddOn) => {
    setEditingAddOnId(addOn.id);
    setAddOnForm({
      name: addOn.name,
      quantity: String(addOn.quantity ?? ""),
      unit: addOn.unit || "ml",
      unit_price: String(addOn.unit_price ?? ""),
      price: String(addOn.price ?? ""),
      quantity_per_item: String(addOn.quantity_per_item ?? 1),
      ingredient_id: String(addOn.ingredient_id ?? ""),
    });
    setSelectedIngredient(undefined);
    setShowAddOnModal(true);
  };

  const closeAddOnModal = () => {
    setShowAddOnModal(false);
    setEditingAddOnId(null);
    setAddOnForm({
      name: "",
      quantity: "",
      unit: "ml",
      unit_price: "",
      price: "",
      quantity_per_item: "1",
      ingredient_id: "",
    });
  };

  const handleAddOnChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAddOnForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitAddOn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addOnForm.name || !addOnForm.quantity || !addOnForm.unit_price || !addOnForm.price) {
      return;
    }

    try {
      setSubmittingAddOn(true);
      const response = await Fetch_to(
        api_links.tbl_toppings,
        {
          ...(editingAddOnId ? { id: editingAddOnId } : {}),
          ...(addOnForm.ingredient_id ? { ingredient_id: Number(addOnForm.ingredient_id) } : {}),
          name: addOnForm.name,
          quantity: Number(addOnForm.quantity),
          unit: addOnForm.unit,
          unit_price: Number(addOnForm.unit_price),
          price: Number(addOnForm.price),
          quantity_per_item: Number(addOnForm.quantity_per_item) || 1,
        },
        {},
        3,
        1000,
        editingAddOnId ? "PUT" : "POST"
      );

      if (response.success) {
        closeAddOnModal();
        await fetchAddOns();
      }
    } catch (error) {
      console.error("Failed to create add-on:", error);
    } finally {
      setSubmittingAddOn(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (!deleteModal.id) return;

      if (deleteModal.isAddOn) {
        await Fetch_to(
          api_links.tbl_toppings,
          { id: deleteModal.id },
          {},
          3,
          1000,
          "DELETE"
        );
        await fetchAddOns();
      } else {
        await Fetch_to(
          `${api_links.tbl_ingredients}?shop_id=${shopId}&id=${deleteModal.id}`,
          {},
          {},
          3,
          1000,
          "DELETE"
        );
        await fetchIngredients();
      }

      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete item:", error);
      closeDeleteModal();
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedIngredient(undefined);
    fetchIngredients();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setSelectedIngredient(undefined);
  };

  const filteredIngredients = ingredients.filter((ing) =>
    ing.ingredient_name.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter((ing) => {
    if (!hasStockData(ing)) return filterStock === "all";
    const threshold = getLowStockThreshold(ing.unit);
    const quantity = Number(ing.quantity) || 0;

    if (filterStock === "low") return quantity < threshold;
    if (filterStock === "normal") return quantity >= threshold;
    return true;
  });

  const lowStockCount = ingredients.filter((ing) => {
    if (!hasStockData(ing)) return false;
    const threshold = getLowStockThreshold(ing.unit);
    return (Number(ing.quantity) || 0) < threshold;
  }).length;

  const nearExpirationItems = ingredients.filter((ing) => {
    if (!ing.expiration_date) return false;
    const expiration = parseCalendarDate(ing.expiration_date);
    if (!expiration) return false;
    const today = new Date();
    const diffMillis = expiration.getTime() - today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(diffMillis / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  const nearExpirationCount = nearExpirationItems.length;

  const totalInventoryValue = ingredients.reduce((sum, ing) => {
    const qty = Number(ing.quantity) || 0;
    const price = Number(ing.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  const filteredAddOns = addOns.filter((addon) =>
    addon.name.toLowerCase().includes(addonSearchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF6F4]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#ECE6E2] border-t-[#C98A84]"></div>
          <p className="font-medium text-[#796E6B]">Loading ingredients...</p>
        </div>
      </div>
    );
  }

  // Delete confirmation dialog
  // Add/Edit form
  if (showForm) {
    return (
      <>
        <IngredientForm
          mode={formMode}
          shopId={shopId}
          ingredient={selectedIngredient}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </>
    );
  }

  if (showAddOnModal) {
    return (
      <main className="min-h-screen bg-[#FAF6F4] px-4 pb-8 pt-20 text-[#2D2626] sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:flex-row sm:items-center sm:p-6">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9B7773]">Inventory · Add-ons</p>
              <h1 className="text-2xl font-bold tracking-tight text-[#2D2626] sm:text-3xl">{editingAddOnId ? "Edit add-on" : "Add new add-on"}</h1>
              <p className="mt-1 text-sm text-[#8A7C78]">Set the add-on stock, usage, and pricing details.</p>
            </div>
            <button
              type="button"
              onClick={closeAddOnModal}
              disabled={submittingAddOn}
              className="min-h-12 shrink-0 rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-4 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#ECE6E2] disabled:opacity-50"
            >
              Back to inventory
            </button>
          </header>

          <section className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_10px_32px_rgba(69,47,39,0.05)] sm:p-7">
            <div className="mb-6 border-b border-[#F0E9E6] pb-5">
              <h2 className="text-lg font-bold text-[#2D2626]">Add-on details</h2>
              <p className="mt-1 text-sm text-[#8A7C78]">Complete all required fields to add this item.</p>
            </div>

            <form onSubmit={handleSubmitAddOn} className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#514441]">
                  Add-on name <span className="text-[#A76560]">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={addOnForm.name}
                  onChange={handleAddOnChange}
                  placeholder="e.g., Brown Sugar Syrup"
                  className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none placeholder:text-[#A39490] focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/15"
                  required
                  disabled={submittingAddOn}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#514441]">
                  Quantity <span className="text-[#A76560]">*</span>
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={addOnForm.quantity}
                  onChange={handleAddOnChange}
                  placeholder="0"
                  step="0.01"
                  min="0"
                  className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none placeholder:text-[#A39490] focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/15"
                  required
                  disabled={submittingAddOn}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#514441]">
                  Unit <span className="text-[#A76560]">*</span>
                </label>
                <select
                  name="unit"
                  value={addOnForm.unit}
                  onChange={handleAddOnChange}
                  className="min-h-12 w-full cursor-pointer rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/15"
                  required
                  disabled={submittingAddOn}
                >
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#514441]">
                  Usage per product <span className="text-[#A76560]">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="quantity_per_item"
                    value={addOnForm.quantity_per_item}
                    onChange={handleAddOnChange}
                    placeholder="1"
                    step="0.01"
                    min="0"
                    className="min-h-12 flex-1 rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none placeholder:text-[#A39490] focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/15"
                    required
                    disabled={submittingAddOn}
                  />
                  <div className="flex min-h-12 min-w-fit items-center justify-center rounded-xl border border-[#E5C7C2] bg-[#F8EDEA] px-3 text-sm font-semibold text-[#A76560]">
                    {addOnForm.unit || "ml"}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#514441]">
                  Cost per unit (₱) <span className="text-[#A76560]">*</span>
                </label>
                <input
                  type="number"
                  name="unit_price"
                  value={addOnForm.unit_price}
                  onChange={handleAddOnChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none placeholder:text-[#A39490] focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/15"
                  required
                  disabled={submittingAddOn}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#514441]">
                  Selling price (₱) <span className="text-[#A76560]">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={addOnForm.price}
                  onChange={handleAddOnChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none placeholder:text-[#A39490] focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/15"
                  required
                  disabled={submittingAddOn}
                />
              </div>

              <div className="mt-2 flex flex-col-reverse gap-3 border-t border-[#F0E9E6] pt-5 sm:flex-row sm:justify-end md:col-span-2">
                <button
                  type="button"
                  onClick={closeAddOnModal}
                  className="min-h-12 rounded-xl border border-[#E0D4CF] px-5 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#ECE6E2] disabled:opacity-50"
                  disabled={submittingAddOn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-6 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(201,138,132,0.2)] transition-colors hover:bg-[#B97973] disabled:opacity-50"
                  disabled={submittingAddOn}
                >
                  {submittingAddOn ? "Saving..." : <><FiPlus size={16} /> {editingAddOnId ? "Save Changes" : "Add New Add-On"}</>}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F4] px-4 pb-8 pt-20 text-[#2D2626] sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:p-6">
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9B7773]">Inventory · POS</p>
              <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-[#2D2626] lg:text-3xl">
                <div className="rounded-xl bg-[#F8EDEA] p-2.5 text-[#B97973]">
                  <span className="inline-flex">
                    <FiPackage aria-hidden="true" />
                  </span>
                </div>
                Ingredients
              </h1>
              <p className="mt-1 text-sm text-[#8A7C78]">
                Track stock levels, costs, and expiration dates across your inventory.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <button
                onClick={handleCreateClick}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(201,138,132,0.24)] transition-colors hover:bg-[#B97973] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A76560]"
              >
                <FiPlus size={18} />
                Add Ingredient
              </button>
              <button
                onClick={() => openAddOnModal()}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-5 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#ECE6E2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84]"
              >
                <FiPlus size={18} />
                Add New Add-On
              </button>
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_24px_rgba(69,47,39,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-xl bg-[#F8EDEA] p-2.5">
                <span className="inline-flex text-[#B97973]">
                  <FiPackage size={20} />
                </span>
              </div>
            </div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8A7C78]">Total ingredients</div>
            <div className="text-2xl font-bold text-[#2D2626]">{ingredients.length}</div>
          </div>

          <div className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_24px_rgba(69,47,39,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-xl bg-[#EAF3EC] p-2.5">
                <span className="inline-flex text-[#5E8B68]">
                  <FiCheckCircle size={20} />
                </span>
              </div>
            </div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8A7C78]">Healthy stock</div>
            <div className="text-2xl font-bold text-[#2D2626]">
              {ingredients.filter((ing) => hasStockData(ing) && (Number(ing.quantity) || 0) >= getLowStockThreshold(ing.unit)).length}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_24px_rgba(69,47,39,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-xl bg-[#FBF1DF] p-2.5">
                <span className="inline-flex text-[#B1843F]">
                  <FiAlertCircle size={20} />
                </span>
              </div>
            </div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8A7C78]">Near expiration</div>
            <div className="text-2xl font-bold text-[#2D2626]">{nearExpirationCount}</div>
            <div className="mt-2 text-xs text-[#8A7C78]">
              {nearExpirationCount > 0
                ? `${nearExpirationCount} item${nearExpirationCount === 1 ? "" : "s"} expiring within 7 days`
                : "No items near expiration"}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_24px_rgba(69,47,39,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-xl bg-[#F8EDEA] p-2.5">
                <span className="inline-flex text-[#A76560]">
                  <FiAlertCircle size={20} />
                </span>
              </div>
            </div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8A7C78]">Low stock alerts</div>
            <div className="text-2xl font-bold text-[#A76560]">{lowStockCount}</div>
            <p className="mt-1 text-xs text-[#8A7C78]">
              {ingredients.filter((ingredient) => !hasStockData(ingredient)).length} without stock records
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-[#E9DFDB] bg-white p-4 shadow-[0_8px_24px_rgba(69,47,39,0.04)] sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="relative w-full">
              <span className="absolute left-3.5 top-1/2 inline-flex -translate-y-1/2 text-[#A39490]">
                <FiSearch size={18} />
              </span>
              <input
                type="text"
                placeholder="Search ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] py-2 pl-11 pr-4 text-sm text-[#2D2626] outline-none transition placeholder:text-[#A39490] focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/15"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter ingredients by stock level">
              {([
                ["all", `All stock · ${ingredients.length}`],
                ["low", `Low stock · ${lowStockCount}`],
                ["normal", "In stock"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilterStock(value)}
                  aria-pressed={filterStock === value}
                  className={`min-h-12 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84] ${
                    filterStock === value
                      ? "bg-[#C98A84] text-white shadow-sm"
                      : "bg-[#ECE6E2] text-[#796E6B] hover:bg-[#E2D9D4] hover:text-[#2D2626]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 text-sm text-[#8A7C78]">
            <span className="font-semibold text-[#A76560]">{filteredIngredients.length}</span>{" "}
            {filteredIngredients.length === 1 ? "ingredient" : "ingredients"} found
          </div>
        </div>

        {lowStockCount > 0 && filterStock !== "low" && (
          <div className="mb-5 rounded-2xl border border-[#E8D6B8] bg-[#FBF1DF] p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex shrink-0 text-[#A77B3F]">
                <FiAlertCircle />
              </span>
              <div className="flex-1">
                <h4 className="mb-2 text-sm font-bold text-[#72552E]">Low stock alert</h4>
                <div className="mb-3 space-y-1 text-sm text-[#72552E]">
                  <p>
                    {lowStockCount} ingredient{lowStockCount !== 1 ? "s" : ""} need
                    {lowStockCount === 1 ? "s" : ""} to be restocked:
                  </p>
                  <ul className="ml-4 space-y-1 text-xs">
                    {ingredients
                      .filter((item) => (Number(item.quantity) || 0) < getLowStockThreshold(item.unit))
                      .slice(0, 5)
                      .map((item) => {
                        const threshold = getLowStockThreshold(item.unit);
                        return (
                          <li key={item.id}>
                            • {item.ingredient_name}: {Number(item.quantity)} {item.unit} (threshold: {threshold} {item.unit})
                          </li>
                        );
                      })}
                  </ul>
                  {lowStockCount > 5 && <p className="ml-4 text-xs">• ... and {lowStockCount - 5} more</p>}
                </div>
              </div>
              <button
                onClick={() => setFilterStock("low")}
                className="min-h-11 shrink-0 rounded-xl bg-[#C98A84] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#B97973]"
              >
                View Items
              </button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#0F172A]">
              <span className="h-6 w-1 rounded bg-[#4F46E5]"></span>
              Add-Ons
            </h2>
          </div>

          <div className="mb-4 rounded-2xl border border-[#E9DFDB] bg-white p-4 shadow-[0_8px_24px_rgba(69,47,39,0.04)]">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 inline-flex -translate-y-1/2 text-[#A39490]">
                <FiSearch size={18} />
              </span>
              <input
                type="text"
                placeholder="Search add-ons..."
                value={addonSearchQuery}
                onChange={(e) => setAddonSearchQuery(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] py-2 pl-11 pr-4 text-sm text-[#2D2626] outline-none transition placeholder:text-[#A39490] focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/15"
              />
            </div>
          </div>

          {addOnLoading ? (
            <div className="rounded-2xl border border-[#E9DFDB] bg-white p-8 text-center">
                <p className="text-sm text-[#8A7C78]">Loading add-ons...</p>
            </div>
          ) : filteredAddOns.length === 0 ? (
            <div className="mb-4 rounded-2xl border border-[#E9DFDB] bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ECE6E2]">
                <span className="inline-flex text-2xl text-[#A39490]">
                  <FiPackage />
                </span>
              </div>
              <h3 className="mb-2 text-lg font-bold text-[#2D2626]">No Add-Ons Yet</h3>
              <p className="mb-6 text-sm text-[#8A7C78]">
                {addonSearchQuery ? "Try adjusting your search" : "Create add-ons for cashier selections"}
              </p>
              <button
                onClick={() => openAddOnModal()}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#B97973]"
              >
                <FiPlus size={16} />
                Add New Add-On
              </button>
            </div>
          ) : (
              <div className="mb-4 overflow-hidden rounded-2xl border border-[#E9DFDB] bg-white shadow-[0_8px_24px_rgba(69,47,39,0.05)]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-[#E9DFDB] bg-[#F5EFEC]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">Add-On Name</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">Usage per Product</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">Total Stock</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">Price (₱)</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">Servings Left</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-[#64748B]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E9E6]">
                    {filteredAddOns.map((addon) => {
                      const quantity = Number(addon.quantity) || 0;
                      const quantityPerItem = Number(addon.quantity_per_item) || 1;
                      const price = Number(addon.price) || 0;
                      const servingsLeft = Math.floor(quantity / quantityPerItem);
                      const percentageLeft = quantityPerItem > 0 && servingsLeft > 0
                        ? Math.min(100, (quantity / (quantityPerItem * servingsLeft)) * 100)
                        : 0;

                      return (
                        <tr key={addon.id} className="transition-colors hover:bg-[#FAF6F4]">
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-[#2D2626]">{addon.name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-[#A76560]">{quantityPerItem.toFixed(2)} {addon.unit}</div>
                            <div className="text-xs text-[#8A7C78]">per serving</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-[#2D2626]">{quantity.toFixed(2)}</div>
                            <div className="text-xs text-[#8A7C78]">{addon.unit}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-[#796E6B]">{addon.unit}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-[#2D2626]">₱{price.toFixed(1)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="text-sm font-bold text-[#2D2626]">{servingsLeft}</div>
                                <div className="h-2 w-full rounded-full bg-[#F0E9E6]">
                                  <div
                                    className="h-2 rounded-full bg-[#78A184] transition-all"
                                    style={{ width: `${percentageLeft}%` }}
                                  ></div>
                                </div>
                                <div className="mt-1 text-xs text-[#8A7C78]">{Math.round(percentageLeft)}% left</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => openEditAddOnModal(addon)}
                                className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-[#796E6B] transition-colors hover:bg-[#ECE6E2]"
                              >
                                <FiEdit size={14} />
                                Edit
                              </button>
                              <button
                                onClick={() => openDeleteModal(addon.id, addon.name, true)}
                                className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-[#A76560] transition-colors hover:bg-[#F8EDEA]"
                              >
                                <FiTrash2 size={14} />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {filteredIngredients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DCCFC9] bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ECE6E2]">
              <span className="inline-flex text-2xl text-[#A39490]">
                <FiPackage />
              </span>
            </div>
            <h3 className="mb-2 text-lg font-bold text-[#2D2626]">No Ingredients Found</h3>
            <p className="mb-6 text-sm text-[#8A7C78]">
              {searchQuery ? "Try adjusting your search" : "Start by adding your first ingredient"}
            </p>
            <button
              onClick={handleCreateClick}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#B97973]"
            >
              <FiPlus size={16} />
              Add Ingredient
            </button>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:hidden">
            {filteredIngredients.map((item) => {
              const threshold = getLowStockThreshold(item.unit);
              const quantity = Number(item.quantity) || 0;
              const stockRecorded = hasStockData(item);
              const isLowStock = stockRecorded && quantity < threshold;
              const stockPercent = stockRecorded ? Math.min(100, Math.max(0, (quantity / threshold) * 100)) : 0;
              const statusLabel = !stockRecorded
                ? "No stock record"
                : isExpired(item.expiration_date)
                  ? "Expired"
                  : quantity <= 0
                    ? "Out of stock"
                    : isLowStock
                      ? "Low stock"
                      : "In stock";

              return (
                <article key={item.id} className="rounded-2xl border border-[#E9DFDB] bg-white p-4 shadow-[0_8px_24px_rgba(69,47,39,0.05)] sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3ECE8] text-[#A76560]">
                        <FiPackage aria-hidden="true" size={18} />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate font-bold text-[#2D2626]">{item.ingredient_name}</h2>
                        <span className="mt-1 inline-flex rounded-lg bg-[#ECE6E2] px-2.5 py-1 text-xs font-semibold text-[#796E6B]">{item.unit}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide sm:text-xs ${
                      !stockRecorded || quantity <= 0 || isExpired(item.expiration_date)
                        ? "bg-[#F8EDEA] text-[#A76560]"
                        : isLowStock
                          ? "bg-[#FBF1DF] text-[#9A7138]"
                          : "bg-[#EAF3EC] text-[#527B5B]"
                    }`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-end justify-between gap-2">
                      <span className="text-xs font-medium text-[#8A7C78]">Current stock</span>
                      <span className={`text-xl font-bold tabular-nums ${isLowStock ? "text-[#A76560]" : "text-[#2D2626]"}`}>
                        {stockRecorded ? quantity : "—"} <span className="text-sm font-semibold text-[#8A7C78]">{stockRecorded ? item.unit : ""}</span>
                      </span>
                    </div>
                    <div
                      className="h-2.5 overflow-hidden rounded-full bg-[#F0E9E6]"
                      role="progressbar"
                      aria-label={`${item.ingredient_name} stock level`}
                      aria-valuemin={0}
                      aria-valuemax={threshold}
                      aria-valuenow={stockRecorded ? Math.min(quantity, threshold) : 0}
                    >
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${
                          isLowStock ? "bg-[#D4AC68]" : "bg-[#78A184]"
                        }`}
                        style={{ width: `${stockPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#FAF6F4] p-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#A39490]">Unit cost</p>
                      <p className="mt-1 text-sm font-semibold text-[#514441]">{item.unit_price !== null ? `₱${Number(item.unit_price).toFixed(2)}` : "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#A39490]">Stock value</p>
                      <p className="mt-1 text-sm font-semibold text-[#514441]">{stockRecorded ? `₱${(quantity * (Number(item.unit_price) || 0)).toFixed(2)}` : "—"}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#8A7C78]">
                    <span>
                      {item.batches?.length
                        ? `${item.batches.length} batch${item.batches.length === 1 ? "" : "es"}`
                        : "Expiration"}
                    </span>
                    <span className={isExpired(item.expiration_date) ? "font-semibold text-[#A76560]" : ""}>
                      {item.expiration_date ? formatCalendarDate(item.expiration_date) : "No expiry date"}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-[#F0E9E6] pt-3">
                    <button
                      type="button"
                      onClick={() => openAddQuantity(item)}
                      className="min-h-11 rounded-xl bg-[#C98A84] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#B97973] sm:text-sm"
                    >
                      <FiPlus aria-hidden="true" className="mr-1 inline h-4 w-4" />
                      Restock
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditClick(item)}
                      className="min-h-11 rounded-xl border border-[#E0D4CF] px-3 text-xs font-semibold text-[#514441] transition-colors hover:bg-[#ECE6E2] sm:text-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(item)}
                      aria-label={`Delete ${item.ingredient_name}`}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#E5C7C2] text-[#A76560] transition-colors hover:bg-[#F8EDEA]"
                    >
                      <FiTrash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-[#E9DFDB] bg-white shadow-[0_8px_24px_rgba(69,47,39,0.05)] xl:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead className="border-b border-[#E9DFDB] bg-[#F5EFEC]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#8A7C78]">Ingredient Name</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#8A7C78]">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#8A7C78]">Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#8A7C78]">Expiration</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#8A7C78]">Cost per Unit (₱)</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#8A7C78]">Total Value (₱)</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#8A7C78]">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-[#8A7C78]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {filteredIngredients.map((item) => {
                    const threshold = getLowStockThreshold(item.unit);
                    const quantity = Number(item.quantity) || 0;
                    const stockRecorded = hasStockData(item);
                    const isLowStock = stockRecorded && quantity < threshold;
                    const price = Number(item.unit_price) || 0;
                    const itemValue = quantity * price;

                    return (
                      <tr key={item.id} className="transition-colors hover:bg-[#FAF6F4]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-[#F8EDEA] p-2">
                              <span className="inline-flex text-[#B97973]">
                                <FiPackage size={16} />
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-[#2D2626]">{item.ingredient_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {stockRecorded ? (
                            <div className="min-w-28">
                            <span className={`text-base font-bold ${isLowStock ? "text-[#A76560]" : "text-[#2D2626]"}`}>
                              {quantity}
                            </span>
                            <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-[#F0E9E6]">
                              <div
                                className={`h-full rounded-full ${isLowStock ? "bg-[#D4AC68]" : "bg-[#78A184]"}`}
                                style={{ width: `${stockRecorded ? Math.min(100, Math.max(0, (quantity / threshold) * 100)) : 0}%` }}
                              />
                            </div>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-[#8A7C78]">Not recorded</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-lg bg-[#ECE6E2] px-2.5 py-1.5 text-xs font-semibold text-[#796E6B]">{item.unit}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {item.batches && item.batches.length > 0 ? (
                              <div className="space-y-1">
                                {item.batches.map((batch) => (
                                  <div key={batch.id} className="text-sm">
                                    <span className="font-semibold text-[#514441]">Batch #{batch.id}</span>
                                    <span className="ml-2 text-[#514441]">
                                      {batch.expiration_date ? formatCalendarDate(batch.expiration_date) : "No expiry"}
                                    </span>
                                    <span className="ml-2 text-xs text-[#8A7C78]">
                                      ({batch.remaining_quantity ?? 0} left)
                                    </span>
                                    {isExpired(batch.expiration_date) && Number(batch.remaining_quantity) > 0 && (
                                      <span className="ml-2 rounded-full bg-[#F8EDEA] px-2 py-1 text-xs font-semibold text-[#A76560]">Expired</span>
                                    )}
                                    {!isExpired(batch.expiration_date) && isNearExpiration(batch.expiration_date) && Number(batch.remaining_quantity) > 0 && (
                                      <span className="ml-2 rounded-full bg-[#FBF1DF] px-2 py-1 text-xs font-semibold text-[#9A7138]">Near expiry</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className={`text-sm font-medium text-[#514441] ${isExpired(item.expiration_date) || isNearExpiration(item.expiration_date) ? "text-[#A76560]" : ""}`}>
                                {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : "—"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <span className="block text-sm font-medium text-[#514441]">
                              {item.unit_price !== null ? `₱${item.unit_price}` : "-"}
                            </span>
                            <span className="text-xs text-[#8A7C78]">per unit</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-[#2D2626]">{stockRecorded ? `₱${itemValue}` : "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          {!stockRecorded ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ECE6E2] px-2.5 py-1.5 text-xs font-semibold text-[#796E6B]">
                              <FiAlertCircle size={12} />
                              NO STOCK RECORD
                            </span>
                          ) : isExpired(item.expiration_date) ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F8EDEA] px-2.5 py-1.5 text-xs font-semibold text-[#A76560]">
                              <FiAlertCircle size={12} />
                              EXPIRED
                            </span>
                          ) : quantity <= 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F8EDEA] px-2.5 py-1.5 text-xs font-semibold text-[#A76560]">
                              <FiAlertCircle size={12} />
                              OUT OF STOCK
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#FBF1DF] px-2.5 py-1.5 text-xs font-semibold text-[#9A7138]">
                              <FiAlertCircle size={12} />
                              LOW STOCK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF3EC] px-2.5 py-1.5 text-xs font-semibold text-[#527B5B]">
                              <FiCheckCircle size={12} />
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleEditClick(item)}
                              aria-label={`Edit ${item.ingredient_name}`}
                              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[#A76560] transition-colors hover:bg-[#F8EDEA]"
                            >
                              <FiEdit size={14} />
                            </button>
                            <button
                              onClick={() => openAddQuantity(item)}
                              aria-label={`Add quantity to ${item.ingredient_name}`}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#EAF3EC] px-3 text-xs font-semibold text-[#527B5B] transition-colors hover:bg-[#DCEBDD]"
                            >
                              <FiPlus size={14} />
                              Add Quantity
                            </button>
                            <button
                              onClick={() => openAddOnModal(item)}
                              aria-label={`Add ${item.ingredient_name} as an add-on`}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#FBF1DF] px-3 text-xs font-semibold text-[#9A7138] transition-colors hover:bg-[#F6E8C9]"
                            >
                              <FiPlus size={14} />
                              Add as Add-On
                            </button>
                            <button
                              onClick={() => handleDeleteClick(item)}
                              aria-label={`Delete ${item.ingredient_name}`}
                              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[#A76560] transition-colors hover:bg-[#F8EDEA]"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}
      </div>

      {showForm && (
        <IngredientForm
          mode={formMode}
          shopId={shopId}
          ingredient={selectedIngredient}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {quantityIngredient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAddQuantity();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-quantity-title"
            className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xl sm:p-6"
          >
            <header className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#64748B]">New inventory batch</p>
                <h2 id="add-quantity-title" className="mt-1 text-xl font-bold text-[#0F172A]">
                  Add quantity
                </h2>
                <p className="mt-1 text-sm text-[#475569]">
                  {quantityIngredient.ingredient_name} · {quantityIngredient.unit}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddQuantity}
                disabled={submittingQuantity}
                aria-label="Close add quantity form"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#64748B] transition-colors hover:bg-[#F1F5F9] disabled:opacity-50"
              >
                <FiX size={20} />
              </button>
            </header>

            {quantityFormError && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {quantityFormError}
              </div>
            )}

            <form onSubmit={handleSubmitQuantity} className="space-y-4">
              <div>
                <label htmlFor="batch-quantity" className="mb-2 block text-sm font-medium text-[#334155]">
                  Quantity ({quantityIngredient.unit}) <span className="text-red-600">*</span>
                </label>
                <input
                  id="batch-quantity"
                  type="number"
                  inputMode="decimal"
                  min="0.000001"
                  step="any"
                  value={quantityForm.quantity}
                  onChange={(event) => setQuantityForm((form) => ({ ...form, quantity: event.target.value }))}
                  className="min-h-12 w-full rounded-xl border border-[#CBD5E1] px-3.5 text-sm text-[#0F172A] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                  required
                  disabled={submittingQuantity}
                />
              </div>
              <div>
                <label htmlFor="batch-unit-price" className="mb-2 block text-sm font-medium text-[#334155]">
                  Cost per {quantityIngredient.unit} (₱) <span className="text-red-600">*</span>
                </label>
                <input
                  id="batch-unit-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={quantityForm.unit_price}
                  onChange={(event) => setQuantityForm((form) => ({ ...form, unit_price: event.target.value }))}
                  className="min-h-12 w-full rounded-xl border border-[#CBD5E1] px-3.5 text-sm text-[#0F172A] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                  required
                  disabled={submittingQuantity}
                />
              </div>
              <div>
                <label htmlFor="batch-expiration" className="mb-2 block text-sm font-medium text-[#334155]">
                  Expiration date <span className="text-red-600">*</span>
                </label>
                <input
                  id="batch-expiration"
                  type="date"
                  value={quantityForm.expiration_date}
                  onChange={(event) => setQuantityForm((form) => ({ ...form, expiration_date: event.target.value }))}
                  className="min-h-12 w-full rounded-xl border border-[#CBD5E1] px-3.5 text-sm text-[#0F172A] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                  required
                  disabled={submittingQuantity}
                />
              </div>
              <footer className="flex flex-col-reverse gap-3 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeAddQuantity}
                  disabled={submittingQuantity}
                  className="min-h-12 rounded-xl border border-[#CBD5E1] px-5 text-sm font-semibold text-[#334155] hover:bg-[#F1F5F9] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingQuantity}
                  className="min-h-12 rounded-xl bg-[#059669] px-5 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-50"
                >
                  {submittingQuantity ? "Adding..." : "Add batch"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FEF2F2]">
              <span className="inline-flex text-[#DC2626]">
                  <FiAlertCircle size={24} />
                </span>
              </div>
              <h3 className="text-xl font-bold text-[#0F172A]">Confirm Delete</h3>
            </div>

            <p className="mb-2 text-sm text-[#475569]">
              Are you sure you want to delete <span className="font-semibold text-[#0F172A]">"{deleteModal.name}"</span>?
            </p>
            <p className="mb-6 text-sm text-[#64748B]">This action cannot be undone.</p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDeleteModal}
                className="min-h-12 rounded-xl border border-[#CBD5E1] px-4 text-sm font-semibold text-[#334155] transition-colors hover:bg-[#F1F5F9]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="min-h-12 rounded-xl bg-[#DC2626] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#B91C1C]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddOnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#0F172A]">{editingAddOnId ? "Edit Add-On" : "Add New Add-On"}</h3>
              <button
                onClick={closeAddOnModal}
                aria-label="Close add-on form"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#64748B] transition-colors hover:bg-[#F1F5F9]"
                disabled={submittingAddOn}
              >
                <FiX size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmitAddOn} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#334155]">
                  Add-On Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={addOnForm.name}
                  onChange={handleAddOnChange}
                  placeholder="e.g., Brown Sugar Syrup"
                  className="min-h-12 w-full rounded-xl border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                  required
                  disabled={submittingAddOn}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#334155]">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={addOnForm.quantity}
                    onChange={handleAddOnChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className="min-h-12 w-full rounded-xl border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                    required
                    disabled={submittingAddOn}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#334155]">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="unit"
                    value={addOnForm.unit}
                    onChange={handleAddOnChange}
                    className="min-h-12 w-full cursor-pointer rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                    required
                    disabled={submittingAddOn}
                  >
                    <option value="ml">ml</option>
                    <option value="L">L</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#334155]">
                  Usage per Product <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="quantity_per_item"
                    value={addOnForm.quantity_per_item}
                    onChange={handleAddOnChange}
                    placeholder="1"
                    step="0.01"
                    min="0"
                    className="min-h-12 flex-1 rounded-xl border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                    required
                    disabled={submittingAddOn}
                  />
                  <div className="flex min-h-12 min-w-fit items-center justify-center rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] px-3 text-sm font-semibold text-[#4F46E5]">
                    {addOnForm.unit || "ml"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#334155]">
                    Cost per Unit (₱) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="unit_price"
                    value={addOnForm.unit_price}
                    onChange={handleAddOnChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="min-h-12 w-full rounded-xl border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                    required
                    disabled={submittingAddOn}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#334155]">
                    Selling Price (₱) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={addOnForm.price}
                    onChange={handleAddOnChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="min-h-12 w-full rounded-xl border border-[#CBD5E1] px-3 text-sm text-[#0F172A] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                    required
                    disabled={submittingAddOn}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddOnModal}
                  className="min-h-12 flex-1 rounded-xl border border-[#CBD5E1] px-4 text-sm font-semibold text-[#334155] transition-colors hover:bg-[#F1F5F9]"
                  disabled={submittingAddOn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#059669] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-50"
                  disabled={submittingAddOn}
                >
                  {submittingAddOn ? "Saving..." : <><FiPlus size={16} /> {editingAddOnId ? "Save Changes" : "Add"}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
