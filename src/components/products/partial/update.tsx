// src/components/products/partial/edit.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import {
  FiCheckCircle,
  FiImage,
  FiPackage,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { useAlertModal } from "@/hooks/useAlertModal";

interface Ingredient {
  ingredient_id: number | string;
  name?: string;
  ingredient_name?: string;
  unit?: string;
  amount: number | string;
}

interface IngredientItem {
  id: number | string;
  ingredient_name: string;
  unit: string;
  quantity?: number | null;
}

interface Variant {
  id?: number;
  name: string;
  price: number | string;
  calculated_cost?: number | string;
  ingredients: Ingredient[];
}

interface EditProductProps {
  productId: number | string;
  shopId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EditProduct({
  productId,
  shopId,
  onSuccess,
  onCancel,
}: EditProductProps) {
  const router = useRouter();

  const [form, setForm] = useState({
    category_id: "",
    product_name: "",
    product_description: "",
    image: "",
  });

  const [variants, setVariants] = useState<Variant[]>([]);
  const [imagePreview, setImagePreview] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({});
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    ingredient_name: "",
    quantity: "",
    unit: "g",
    expiration_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { showAlert, AlertModal } = useAlertModal();

  const unitOptions = [
    { value: "g", label: "Grams (g)" },
    { value: "kg", label: "Kilograms (kg)" },
    { value: "ml", label: "Milliliters (ml)" },
    { value: "l", label: "Liters (l)" },
    { value: "pcs", label: "Pieces (pcs)" },
  ];

  const convertToBaseUnit = (quantity: string, unit: string) => {
    const value = Number(quantity);
    if (Number.isNaN(value)) return { quantity: 0, unit };

    switch (unit) {
      case "kg":
        return { quantity: value * 1000, unit: "g" };
      case "l":
        return { quantity: value * 1000, unit: "ml" };
      case "pcs":
        return { quantity: value * 60, unit: "g" };
      default:
        return { quantity: value, unit };
    }
  };

  /* =========================
     LOAD PRODUCT DATA
  ========================= */
  useEffect(() => {
    const loadData = async () => {
      try {
        setFetching(true);

        // Fetch product, categories, ingredients in parallel
        const [productRes, categoryRes, ingredientRes] = await Promise.all([
          Fetch_to(`${api_links.tbl_products}?shop_id=${shopId}&id=${productId}`, {}, {}, 3, 1000, "GET"),
          Fetch_to(`${api_links.tbl_category}?shop_id=${shopId}`, {}, {}, 3, 1000, "GET"),
          Fetch_to(`${api_links.tbl_ingredients}?shop_id=${shopId}`, {}, {}, 3, 1000, "GET"),
        ]);

        // ── Categories ──────────────────────────────────────────────────
        if (categoryRes.success && Array.isArray(categoryRes.data)) {
          setCategories(categoryRes.data);
        }

        // ── Ingredients ─────────────────────────────────────────────────
        if (ingredientRes.success && Array.isArray(ingredientRes.data)) {
          setIngredients(ingredientRes.data);
        }

        // ── Product ─────────────────────────────────────────────────────
        const productData = productRes.data as
          | { product?: any; data?: any; variants?: any[] }
          | undefined;
        const product = productData?.product ?? productData?.data ?? productData ?? {};
        const productVariants: Variant[] = (productData?.variants ?? product?.variants ?? []).map(
          (v: any) => ({
            id:              v.id,
            name:            v.name || "",
            price:           v.price ?? "",
            calculated_cost: v.calculated_cost ?? 0,
            ingredients:     (v.ingredients ?? []).map((i: any) => ({
              ingredient_id: i.ingredient_id ?? i.id,
              name:          i.name ?? i.ingredient_name,
              amount:        i.amount ?? "",
            })),
          })
        );

        setForm((prev) => ({
          ...prev,
          category_id: String(product?.category_id || ""),
          product_name: product?.product_name || "",
          product_description: product?.product_description || "",
          image: product?.image || "",
        }));

        if (product?.image) {
          setImagePreview(product.image);
        } else {
          setImagePreview("");
        }

        setVariants(productVariants);
      } catch (err) {
        console.error("Error loading product:", err);
        showAlert("Failed to load product data", { variant: "error", title: "Load Failed" });
        onCancel();
      } finally {
        setFetching(false);
      }
    };

    loadData();
  }, [productId, shopId]);

  /* =========================
     FORM HANDLERS
  ========================= */
  const handleChange = (e: any) => {
    const { name, value, files } = e.target;
    if (name === "image" && files?.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setForm({ ...form, image: result });
        setImagePreview(result);
      };
      reader.readAsDataURL(file);
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  // ── Variant handlers ─────────────────────────────────────────────────
  const addVariant = () => {
    setVariants([...variants, { name: "", price: "", calculated_cost: 0, ingredients: [] }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof Variant, value: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  // ── Ingredient handlers ──────────────────────────────────────────────
  const addIngredient = (variantIndex: number, ingredient: any) => {
    const updated = [...variants];
    updated[variantIndex].ingredients.push({
      ingredient_id: ingredient.id,
      name: ingredient.ingredient_name,
      amount: "",
    });
    setVariants(updated);
  };

  const removeIngredient = (variantIndex: number, ingredientId: number | string) => {
    const updated = [...variants];
    updated[variantIndex].ingredients = updated[variantIndex].ingredients.filter(
      (ing) => String(ing.ingredient_id) !== String(ingredientId)
    );
    setVariants(updated);
  };

  const updateIngredient = (
    variantIndex: number,
    ingredientId: number | string,
    field: keyof Ingredient,
    value: any
  ) => {
    const updated = [...variants];
    const ingredientIndex = updated[variantIndex].ingredients.findIndex(
      (ing) => String(ing.ingredient_id) === String(ingredientId)
    );

    if (ingredientIndex === -1) return;

    updated[variantIndex].ingredients[ingredientIndex] = {
      ...updated[variantIndex].ingredients[ingredientIndex],
      [field]: value,
    };
    setVariants(updated);
  };

  const handleSearchChange = (variantIndex: number, query: string) => {
    setSearchQueries({ ...searchQueries, [variantIndex]: query });
  };

  const getFilteredIngredients = (variantIndex: number) => {
    const query = searchQueries[variantIndex] || "";
    if (!query.trim()) return ingredients;

    return ingredients.filter((ing) =>
      ing.ingredient_name.toLowerCase().includes(query.toLowerCase())
    );
  };

  const handleAddIngredient = async () => {
    if (
      !newIngredient.ingredient_name ||
      !newIngredient.quantity ||
      !newIngredient.unit ||
      !newIngredient.expiration_date
    ) {
      showAlert("All ingredient fields are required", { variant: "error", title: "Validation Error" });
      return;
    }

    try {
      setAddingIngredient(true);
      const converted = convertToBaseUnit(newIngredient.quantity, newIngredient.unit);
      const response = await Fetch_to<{ ingredient_id?: number }>(
        `${api_links.tbl_ingredients}?shop_id=${shopId}`,
        {
          ingredient_name: newIngredient.ingredient_name,
          quantity: converted.quantity,
          unit: converted.unit,
          expiration_date: newIngredient.expiration_date,
        },
        {},
        3,
        1000,
        "POST"
      );

      if (!response.success) {
        showAlert(response.message || "Failed to add ingredient", { variant: "error", title: "Ingredient Error" });
        return;
      }

      setShowAddIngredient(false);
      setNewIngredient({ ingredient_name: "", quantity: "", unit: "g", expiration_date: "" });
      const ingredientResponse = await Fetch_to<IngredientItem[]>(
        `${api_links.tbl_ingredients}?shop_id=${shopId}`,
        {},
        {},
        3,
        1000,
        "GET"
      );
      if (ingredientResponse.success && Array.isArray(ingredientResponse.data)) {
        setIngredients(ingredientResponse.data);
      }

      if (response.data?.ingredient_id) {
        const ingredientId = response.data.ingredient_id;
        setVariants((current) =>
          current.map((variant, index) =>
            index === 0 && !variant.ingredients.some(
              (ingredient) => String(ingredient.ingredient_id) === String(ingredientId)
            )
              ? {
                  ...variant,
                  ingredients: [...variant.ingredients, { ingredient_id: ingredientId, amount: "" }],
                }
              : variant
          )
        );
      }
      showAlert(`Ingredient added (${converted.quantity} ${converted.unit})`, {
        variant: "success",
        title: "Ingredient Added - Enter Its Recipe Amount",
      });
    } catch (err) {
      console.error("Add ingredient error:", err);
      showAlert("Failed to add ingredient", { variant: "error", title: "Ingredient Error" });
    } finally {
      setAddingIngredient(false);
    }
  };

  /* =========================
     SUBMIT
  ========================= */
  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!form.category_id || !form.product_name) {
      showAlert("Category and Product Name are required", { variant: "error", title: "Validation Error" });
      return;
    }

    if (variants.some((variant) =>
      variant.ingredients.some((ingredient) => !Number.isFinite(Number(ingredient.amount)) || Number(ingredient.amount) <= 0)
    )) {
      showAlert("Enter a recipe amount greater than zero for every selected ingredient", {
        variant: "error",
        title: "Recipe Amount Required",
      });
      return;
    }

    try {
      setLoading(true);

      const imageValue = form.image || imagePreview || null;

      const payload = {
        id:                  productId,
        shop_id:             shopId,
        category_id:         form.category_id,
        product_name:        form.product_name,
        product_description: form.product_description?.trim() || "",
        image:               imageValue,
        variants:            variants.map((v) => ({
          id:              v.id, // existing variants keep their id
          name:            v.name,
          price:           v.price,
          calculated_cost: v.calculated_cost ?? 0,
          ingredients:     v.ingredients.filter(
            (i) => i.ingredient_id && i.amount !== ""
          ),
        })),
      };

      const response = await Fetch_to(
        api_links.tbl_products,
        payload,
        {},
        3,
        1000,
        "PUT"
      );

      if (response.success) {
        showAlert("Product updated successfully", {
          variant: "success",
          title: "Product Updated",
          onClose: () => {
            onSuccess();
            router.refresh();
          },
        });
      } else {
        showAlert(response.message || "Failed to update product", { variant: "error", title: "Update Failed" });
      }
    } catch (err: any) {
      console.error(err);
      showAlert(err?.message || "Error updating product", { variant: "error", title: "Update Failed" });
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     LOADING STATE
  ========================= */
  if (fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF6F4]">
        <AlertModal />
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#F8EDEA] border-t-[#A76560]" />
          <p className="font-medium text-[#796E6B]">Loading product…</p>
        </div>
      </div>
    );
  }

  /* =========================
     UI
  ========================= */
  return (
    <div className="min-h-screen bg-[#FAF6F4] px-4 pb-10 pt-20 text-[#2D2626] sm:px-6 lg:px-8 lg:py-8">
      <AlertModal />
      <div className="mx-auto w-full max-w-5xl">
        {showAddIngredient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2626]/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-[#E9DFDB] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E9DFDB] p-5">
                <h3 className="text-lg font-bold text-[#2D2626]">Add New Ingredient</h3>
                <button
                  type="button"
                  onClick={() => setShowAddIngredient(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-[#796E6B] transition-colors hover:bg-[#F5EFEC]"
                  disabled={addingIngredient}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#514441]">
                    Ingredient Name <span className="text-[#A76560]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Coffee Beans"
                    value={newIngredient.ingredient_name}
                    onChange={(event) => setNewIngredient({ ...newIngredient, ingredient_name: event.target.value })}
                    className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                    disabled={addingIngredient}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#514441]">
                      Quantity <span className="text-[#A76560]">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g., 1000"
                      value={newIngredient.quantity}
                      onChange={(event) => setNewIngredient({ ...newIngredient, quantity: event.target.value })}
                      className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                      disabled={addingIngredient}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#514441]">
                      Unit <span className="text-[#A76560]">*</span>
                    </label>
                    <select
                      value={newIngredient.unit}
                      onChange={(event) => setNewIngredient({ ...newIngredient, unit: event.target.value })}
                      className="min-h-12 w-full cursor-pointer rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                      disabled={addingIngredient}
                    >
                      {unitOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#514441]">
                    Batch Expiration Date <span className="text-[#A76560]">*</span>
                  </label>
                  <input
                    type="date"
                    value={newIngredient.expiration_date}
                    onChange={(event) => setNewIngredient({ ...newIngredient, expiration_date: event.target.value })}
                    className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                    disabled={addingIngredient}
                  />
                </div>
              </div>

              <div className="flex gap-2 border-t border-[#F0E9E6] p-4">
                <button
                  type="button"
                  onClick={() => setShowAddIngredient(false)}
                  className="min-h-12 flex-1 rounded-xl border border-[#E0D4CF] px-4 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#F5EFEC]"
                  disabled={addingIngredient}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#B97872] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={addingIngredient}
                >
                  {addingIngredient ? "Adding..." : "Add Ingredient"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-[#2D2626] lg:text-3xl">
                <div className="rounded-xl bg-[#F8EDEA] p-2.5 text-[#A76560]">
                  <FiPackage aria-hidden="true" />
                </div>
                Edit Product
              </h1>
              <p className="mt-1 text-sm text-[#796E6B]">
                Update product details and variants
              </p>
            </div>
            <button
              onClick={onCancel}
              aria-label="Cancel and close"
              className="flex h-12 w-12 items-center justify-center rounded-xl text-[#796E6B] transition-colors hover:bg-[#F5EFEC] hover:text-[#2D2626]"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] lg:p-6">
            <h2 className="mb-5 text-lg font-bold text-[#2D2626]">Product Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="mb-2 text-sm font-semibold text-[#514441]">
                  Product Name <span className="text-red-600">*</span>
                </label>
                <input
                  name="product_name"
                  value={form.product_name}
                  onChange={handleChange}
                  placeholder="e.g., Caramel Macchiato"
                  className="min-h-12 rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col">
                <label className="mb-2 text-sm font-semibold text-[#514441]">
                  Category <span className="text-red-600">*</span>
                </label>
                <select
                  name="category_id"
                  value={form.category_id}
                  onChange={handleChange}
                  className="min-h-12 cursor-pointer rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                  required
                  disabled={loading}
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col md:col-span-2">
                <label className="mb-2 text-sm font-semibold text-[#514441]">Description</label>
                <textarea
                  name="product_description"
                  value={form.product_description}
                  onChange={handleChange}
                  placeholder="Enter product description..."
                  className="resize-none rounded-xl border border-[#E0D4CF] bg-white px-3.5 py-3 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                  rows={3}
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col md:col-span-2">
                <label className="mb-2 text-sm font-semibold text-[#514441]">Product Image</label>
                <div className="rounded-2xl border-2 border-dashed border-[#E0D4CF] bg-[#FAF6F4] p-6 transition-colors hover:border-[#C98A84]">
                  <input
                    type="file"
                    name="image"
                    accept="image/*"
                    onChange={handleChange}
                    className="hidden"
                    id="edit-image-upload"
                    disabled={loading}
                  />
                  <label
                    htmlFor="edit-image-upload"
                    className={`${loading ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {imagePreview ? (
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="h-40 w-40 rounded-xl border border-[#E9DFDB] object-cover"
                        />
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#A76560]">
                          <FiUpload size={16} />
                          Click to change image
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-[#796E6B]">
                        <div className="rounded-xl bg-[#F8EDEA] p-4 text-[#A76560]">
                          <FiImage size={28} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-[#514441]">Click to upload image</p>
                          <p className="mt-1 text-xs text-[#796E6B]">PNG, JPG up to 10MB</p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] lg:p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-bold text-[#2D2626]">Product Variants</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddIngredient(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ECE6E2] px-3 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#E2D9D4]"
                  disabled={loading}
                >
                  <FiPlus size={16} />
                  Add Ingredient
                </button>
                <button
                  type="button"
                  onClick={addVariant}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C98A84] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#B97872]"
                  disabled={loading}
                >
                  <FiPlus size={16} />
                  Add Variant
                </button>
              </div>
            </div>

            {variants.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">
                No variants yet. Add one above.
              </p>
            )}

            <div className="space-y-4 mt-4">
              {variants.map((variant, vi) => (
                <div
                  key={vi}
                  className="rounded-2xl border border-[#E9DFDB] bg-[#FAF6F4] p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#A76560] text-xs text-white">
                        {vi + 1}
                      </span>
                      Variant {vi + 1}
                    </h3>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(vi)}
                        aria-label={`Remove variant ${vi + 1}`}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-[#DC2626] transition-colors hover:bg-[#FEF2F2]"
                        disabled={loading}
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex flex-col">
                      <label className="mb-2 text-sm font-medium text-[#514441]">
                        Variant Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        value={variant.name}
                        onChange={(e) => updateVariant(vi, "name", e.target.value)}
                        placeholder="e.g., Small, Medium, Large"
                        className="min-h-12 rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="mb-2 text-sm font-medium text-[#514441]">
                        Price <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        value={variant.price}
                        onChange={(e) => updateVariant(vi, "price", e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="min-h-12 rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="border-t border-[#E9DFDB] pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-700">Select Ingredients</h4>
                      <div className="relative w-full max-w-xs">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                          <FiSearch size={14} />
                        </div>
                        <input
                          type="text"
                          placeholder="Search ingredients..."
                          value={searchQueries[vi] || ""}
                          onChange={(e) => handleSearchChange(vi, e.target.value)}
                          className="min-h-11 w-full rounded-xl border border-[#E0D4CF] bg-white py-2 pl-9 pr-3 text-sm text-[#2D2626] outline-none focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {variant.ingredients.some(
                      (recipeIngredient) =>
                        !ingredients.some(
                          (ingredient) =>
                            String(ingredient.id) === String(recipeIngredient.ingredient_id)
                        )
                    ) && (
                      <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                        <p className="mb-2 text-sm text-amber-900">
                          These saved recipe ingredients are unavailable in this shop and count as zero stock.
                          Remove them or replace them with an active ingredient.
                        </p>
                        <div className="space-y-2">
                          {variant.ingredients
                            .filter(
                              (recipeIngredient) =>
                                !ingredients.some(
                                  (ingredient) =>
                                    String(ingredient.id) === String(recipeIngredient.ingredient_id)
                                )
                            )
                            .map((recipeIngredient) => (
                              <div
                                key={String(recipeIngredient.ingredient_id)}
                                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"
                              >
                                <span className="text-sm font-medium text-slate-800">
                                  {recipeIngredient.name ||
                                    recipeIngredient.ingredient_name ||
                                    `Ingredient #${recipeIngredient.ingredient_id}`}
                                  {" · "}
                                  {recipeIngredient.amount}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeIngredient(vi, recipeIngredient.ingredient_id)}
                                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                                  disabled={loading}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-2">
                      {getFilteredIngredients(vi).length > 0 ? (
                        getFilteredIngredients(vi).map((ing) => {
                          const selected = variant.ingredients.find(
                            (i) => String(i.ingredient_id) === String(ing.id)
                          );

                          return (
                            <div
                              key={ing.id}
                              className={`rounded-xl border p-3 transition-colors ${
                                selected
                                  ? "border-[#D9B3AE] bg-[#F8EDEA]"
                                  : "border-[#E9DFDB] bg-white hover:border-[#D9B3AE]"
                              }`}
                            >
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!selected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      if (!selected) {
                                        addIngredient(vi, ing);
                                      }
                                    } else if (selected) {
                                      removeIngredient(vi, ing.id);
                                    }
                                  }}
                                  className="mt-0.5 h-4 w-4 rounded accent-[#A76560] focus:ring-2 focus:ring-[#C98A84]/20"
                                  disabled={loading}
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-[#2D2626]">
                                    {ing.ingredient_name}
                                  </div>
                                  <div className="text-xs text-[#796E6B]">
                                    Available: <span className="font-medium text-[#514441]">{ing.quantity ?? 0} {ing.unit}</span>
                                  </div>

                                  {selected && (
                                    <input
                                      type="number"
                                      placeholder={`Amount (${ing.unit})`}
                                      value={selected.amount}
                                      onChange={(e) => {
                                        updateIngredient(vi, ing.id, "amount", e.target.value);
                                      }}
                                      step="0.01"
                                      min="0"
                                      className="mt-2 min-h-11 w-full rounded-lg border border-[#E0D4CF] bg-white px-3 text-sm outline-none focus:border-[#C98A84] focus:ring-2 focus:ring-[#C98A84]/10"
                                      disabled={loading}
                                    />
                                  )}
                                </div>
                              </label>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-full text-center py-8 text-slate-500">
                          <p className="text-sm">No ingredients found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B97872] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FiCheckCircle size={18} />
                  Update Product
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="min-h-12 flex-1 rounded-xl border border-[#E0D4CF] px-6 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#F5EFEC] disabled:opacity-50 sm:flex-none"
            >
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}