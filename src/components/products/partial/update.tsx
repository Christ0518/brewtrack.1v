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
import { getShopTheme } from "@/lib/theme";

interface Ingredient {
  ingredient_id: number | string;
  name?: string;
  ingredient_name?: string;
  unit?: string;
  amount: number | string;
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
  const theme = getShopTheme(shopId);

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
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { showAlert, AlertModal } = useAlertModal();

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

  /* =========================
     SUBMIT
  ========================= */
  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!form.category_id || !form.product_name) {
      showAlert("Category and Product Name are required", { variant: "error", title: "Validation Error" });
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
      <div className="min-h-screen bg-[#f8f1e8] flex items-center justify-center">
        <AlertModal />
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#6c3030] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8a6245] font-medium">Loading product...</p>
        </div>
      </div>
    );
  }

  /* =========================
     UI
  ========================= */
  return (
    <div className="min-h-screen bg-[#f8f1e8] flex items-center justify-center p-4 lg:p-6">
      <AlertModal />
      <div className="w-full max-w-6xl">

        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2.5 text-white" style={{ backgroundColor: theme.accentColor }}>
                  <FiPackage />
                </div>
                Edit Product
              </h1>
              <p className="text-slate-600 mt-1 text-sm">
                Update product details and variants
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-600 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-lg transition-all"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="border border-slate-200 bg-white p-4 lg:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Product Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-slate-700 mb-2">
                  Product Name <span className="text-red-600">*</span>
                </label>
                <input
                  name="product_name"
                  value={form.product_name}
                  onChange={handleChange}
                  placeholder="e.g., Caramel Macchiato"
                  className="p-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium text-slate-700 mb-2">
                  Category <span className="text-red-600">*</span>
                </label>
                <select
                  name="category_id"
                  value={form.category_id}
                  onChange={handleChange}
                  className="p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none cursor-pointer"
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
                <label className="text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea
                  name="product_description"
                  value={form.product_description}
                  onChange={handleChange}
                  placeholder="Enter product description..."
                  className="p-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-none"
                  rows={3}
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col md:col-span-2">
                <label className="text-sm font-medium text-slate-700 mb-2">Product Image</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-[#073dbe] transition-all">
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
                          className="h-40 w-40 object-cover rounded-lg border border-slate-200"
                        />
                        <div className="flex items-center gap-2 text-[#073dbe] font-medium text-sm">
                          <FiUpload size={16} />
                          Click to change image
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-slate-500">
                        <div className="bg-slate-100 p-4 rounded-lg">
                          <FiImage size={28} />
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-slate-700 text-sm">Click to upload image</p>
                          <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 bg-white p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-bold text-slate-900">Product Variants</h2>
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ backgroundColor: theme.accentColor }}
                disabled={loading}
              >
                <FiPlus size={16} />
                Add Variant
              </button>
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
                  className="border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg text-xs text-white" style={{ backgroundColor: theme.accentColor }}>
                        {vi + 1}
                      </span>
                      Variant {vi + 1}
                    </h3>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(vi)}
                        className="text-red-600 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                        disabled={loading}
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-slate-700 mb-2">
                        Variant Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        value={variant.name}
                        onChange={(e) => updateVariant(vi, "name", e.target.value)}
                        placeholder="e.g., Small, Medium, Large"
                        className="p-2.5 border border-slate-300 rounded-lg bg-white focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-slate-700 mb-2">
                        Price <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        value={variant.price}
                        onChange={(e) => updateVariant(vi, "price", e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="p-2.5 border border-slate-300 rounded-lg bg-white focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-700">Select Ingredients</h4>
                      <div className="relative w-64">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <FiSearch size={14} />
                        </div>
                        <input
                          type="text"
                          placeholder="Search ingredients..."
                          value={searchQueries[vi] || ""}
                          onChange={(e) => handleSearchChange(vi, e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-2">
                      {getFilteredIngredients(vi).length > 0 ? (
                        getFilteredIngredients(vi).map((ing) => {
                          const selected = variant.ingredients.find(
                            (i) => String(i.ingredient_id) === String(ing.id)
                          );

                          return (
                            <div
                              key={ing.id}
                              className={`border rounded-lg p-3 transition-all ${
                                selected
                                  ? "border-[#073dbe] bg-blue-50"
                                  : "border-slate-200 bg-white hover:border-slate-300"
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
                                  className="mt-0.5 w-4 h-4 text-[#073dbe] rounded focus:ring-2 focus:ring-blue-200"
                                  disabled={loading}
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-slate-900 text-sm">
                                    {ing.ingredient_name}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Available: {ing.quantity ?? 0} {ing.unit}
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
                                      className="w-full mt-2 p-2 border border-[#073dbe] rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none"
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

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg py-3 font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: theme.accentColor }}
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
              className="flex-1 sm:flex-none bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-lg transition-all font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}