"use client";

import { useEffect, useState } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { useAlertModal } from "@/hooks/useAlertModal";
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

interface Category {
  id: number | string;
  name: string;
}

interface IngredientItem {
  id: number | string;
  ingredient_name: string;
  unit: string;
  quantity?: number | null;
  unit_price?: number | null;
}

interface VariantIngredient {
  ingredient_id: number | string;
  amount: string | number;
}

interface VariantForm {
  variant_name: string;
  price: string;
  ingredients: VariantIngredient[];
}

export default function AddProduct({
  shopId,
  onSuccess,
  onCancel,
}: {
  shopId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({});
  const [imagePreview, setImagePreview] = useState("");
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    ingredient_name: "",
    quantity: "",
    unit: "g",
    expiration_date: "",
  });
  const { showAlert, AlertModal } = useAlertModal();

  const [form, setForm] = useState({
    category_id: "",
    product_name: "",
    product_description: "",
    image: "",
  });

  const [variants, setVariants] = useState<VariantForm[]>([
    { variant_name: "", price: "", ingredients: [] },
  ]);

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

  const loadIngredients = async () => {
    const response = await Fetch_to(
      `${api_links.tbl_ingredients}?shop_id=${shopId}`,
      {},
      {},
      3,
      1000,
      "GET"
    );

    if (response.success && Array.isArray(response.data)) {
      setIngredients(response.data as IngredientItem[]);
      return;
    }

    throw new Error(response.success ? "Ingredients response is invalid" : response.message);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const categoryRes = await Fetch_to(
          `${api_links.tbl_category}?shop_id=${shopId}`,
          {},
          {},
          3,
          1000,
          "GET"
        );

        if (categoryRes.success && Array.isArray(categoryRes.data)) {
          setCategories(categoryRes.data as Category[]);
        }

        await loadIngredients();
      } catch (err) {
        console.error("Failed to load create form data:", err);
        showAlert("Failed to load categories or ingredients", { variant: "error", title: "Load Failed" });
      }
    };

    loadData();
  }, [shopId]);

  const handleChange = (e: any) => {
    const { name, value, files } = e.target;

    if (name === "image" && files?.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setForm((prev) => ({ ...prev, image: result }));
        setImagePreview(result);
      };
      reader.readAsDataURL(file);
      return;
    }

    setForm({ ...form, [name]: value });
  };

  const handleVariantChange = (
    index: number,
    field: keyof Omit<VariantForm, "ingredients">,
    value: string
  ) => {
    const updated = [...variants];
    updated[index][field] = value;
    setVariants(updated);
  };

  const handleIngredientChange = (
    variantIndex: number,
    ingredientId: number | string,
    amount: string,
    checked: boolean
  ) => {
    const updated = [...variants];
    const target = updated[variantIndex].ingredients;
    const existingIndex = target.findIndex((i) => i.ingredient_id === ingredientId);

    if (checked) {
      if (existingIndex === -1) {
        target.push({ ingredient_id: ingredientId, amount: amount || "" });
      } else {
        target[existingIndex].amount = amount || "";
      }
    } else if (existingIndex !== -1) {
      target.splice(existingIndex, 1);
    }

    setVariants(updated);
  };

  const addVariant = () => {
    setVariants([...variants, { variant_name: "", price: "", ingredients: [] }]);
  };

  const removeVariant = (index: number) => {
    if (variants.length === 1) {
      showAlert("At least one variant is required", { variant: "error", title: "Validation Error" });
      return;
    }

    const updated = variants.filter((_, i) => i !== index);
    setVariants(updated);

    const newSearchQueries = { ...searchQueries };
    delete newSearchQueries[index];
    setSearchQueries(newSearchQueries);
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
      await loadIngredients();
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

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!form.category_id || !form.product_name) {
      showAlert("Category and Product Name are required", { variant: "error", title: "Validation Error" });
      return;
    }

    if (variants.some((v) => !v.variant_name || !v.price)) {
      showAlert("All variants must have a name and price", { variant: "error", title: "Validation Error" });
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

    const variantsWithCost = variants.map((variant) => {
      let totalCost = 0;

      variant.ingredients.forEach((ing) => {
        const ingredientData = ingredients.find((i) => String(i.id) === String(ing.ingredient_id));
        if (!ingredientData) return;

        const amount = Number(ing.amount) || 0;
        const unitPrice = Number(ingredientData.unit_price) || 0;
        totalCost += amount * unitPrice;
      });

      return {
        name: variant.variant_name,
        price: Number(variant.price),
        calculated_cost: totalCost,
        ingredients: variant.ingredients
          .filter((i) => i.ingredient_id && i.amount !== "")
          .map((i) => ({
            ingredient_id: i.ingredient_id,
            amount: Number(i.amount),
          })),
      };
    });

    setLoading(true);

    try {
      const response = await Fetch_to(
        api_links.tbl_products,
        {
          category_id: form.category_id,
          product_name: form.product_name,
          product_description: form.product_description || "",
          image: form.image || null,
          variants: variantsWithCost,
          shop_id: shopId,
        },
        {},
        3,
        1000,
        "POST"
      );

      if (!response.success) {
        showAlert(response.message || "Failed to add product", { variant: "error", title: "Create Failed" });
        return;
      }

      showAlert("Product added successfully!", {
        variant: "success",
        title: "Product Added",
        onClose: onSuccess,
      });

      setForm({
        category_id: "",
        product_name: "",
        product_description: "",
        image: "",
      });
      setVariants([{ variant_name: "", price: "", ingredients: [] }]);
      setImagePreview("");
    } catch (err) {
      console.log(err);
      showAlert("Something went wrong", { variant: "error", title: "Create Failed" });
    } finally {
      setLoading(false);
    }
  };

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
                  onClick={() => {
                    setShowAddIngredient(false);
                    setNewIngredient({ ingredient_name: "", quantity: "", unit: "g", expiration_date: "" });
                  }}
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
                    onChange={(e) =>
                      setNewIngredient({ ...newIngredient, ingredient_name: e.target.value })
                    }
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
                      placeholder="e.g., 1000"
                      value={newIngredient.quantity}
                      onChange={(e) =>
                        setNewIngredient({ ...newIngredient, quantity: e.target.value })
                      }
                      step="0.01"
                      min="0"
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
                      onChange={(e) =>
                        setNewIngredient({ ...newIngredient, unit: e.target.value })
                      }
                      className="min-h-12 w-full cursor-pointer rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                      disabled={addingIngredient}
                    >
                      {unitOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
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
                    onChange={(e) =>
                      setNewIngredient({ ...newIngredient, expiration_date: e.target.value })
                    }
                    className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                    disabled={addingIngredient}
                  />
                </div>

                {newIngredient.quantity && newIngredient.unit && (
                  <div className="rounded-xl border border-[#E5C7C2] bg-[#F8EDEA] p-3">
                    <p className="mb-1 text-xs font-medium text-[#A76560]">Conversion Preview:</p>
                    <p className="text-sm text-[#796E6B]">
                      {newIngredient.quantity} {newIngredient.unit} = {" "}
                      <span className="font-bold">
                        {convertToBaseUnit(newIngredient.quantity, newIngredient.unit).quantity}{" "}
                        {convertToBaseUnit(newIngredient.quantity, newIngredient.unit).unit}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t border-[#F0E9E6] p-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddIngredient(false);
                    setNewIngredient({ ingredient_name: "", quantity: "", unit: "g", expiration_date: "" });
                  }}
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
                Create Product
              </h1>
              <p className="mt-1 text-sm text-[#796E6B]">
                Add a new product with variants to your menu
              </p>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                aria-label="Cancel and close"
                className="flex h-12 w-12 items-center justify-center rounded-xl text-[#796E6B] transition-colors hover:bg-[#F5EFEC] hover:text-[#2D2626]"
              >
                <FiX size={20} />
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] lg:p-6">
            <h2 className="mb-5 text-lg font-bold text-[#2D2626]">Product Information</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col">
                <label className="mb-2 text-sm font-semibold text-[#514441]">
                Product Name <span className="text-[#A76560]">*</span>
                </label>
                <input
                  type="text"
                  name="product_name"
                  value={form.product_name}
                  onChange={handleChange}
                  placeholder="e.g., Caramel Macchiato"
                  className="min-h-12 rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/10"
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col">
                <label className="mb-2 text-sm font-semibold text-[#514441]">
                Category <span className="text-[#A76560]">*</span>
                </label>
                <select
                  name="category_id"
                  value={form.category_id}
                  onChange={handleChange}
                  className="min-h-12 cursor-pointer rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/10"
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
                  className="resize-none rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-3.5 py-3 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/10"
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
                    id="image-upload"
                    disabled={loading}
                  />
                  <label
                    htmlFor="image-upload"
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
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

            <div className="space-y-4">
              {variants.map((variant, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-[#E9DFDB] bg-[#FAF6F4] p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[#2D2626]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#A76560] text-xs text-white">
                        {index + 1}
                      </span>
                      Variant {index + 1}
                    </h3>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        aria-label={`Remove variant ${index + 1}`}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A76560] transition-colors hover:bg-[#F8EDEA]"
                        disabled={loading}
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col">
                      <label className="mb-2 text-sm font-medium text-[#514441]">
                        Variant Name <span className="text-[#A76560]">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Small, Medium, Large"
                        value={variant.variant_name}
                        onChange={(e) => handleVariantChange(index, "variant_name", e.target.value)}
                        className="min-h-12 rounded-xl border border-[#E0D4CF] bg-white px-3.5 text-sm text-[#2D2626] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="mb-2 text-sm font-medium text-[#514441]">
                        Price <span className="text-[#A76560]">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={variant.price}
                        onChange={(e) => handleVariantChange(index, "price", e.target.value)}
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
                      <h4 className="text-sm font-semibold text-[#514441]">Select Ingredients</h4>
                      <div className="relative w-full max-w-xs">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39490]" />
                        <input
                          type="text"
                          placeholder="Search ingredients..."
                          value={searchQueries[index] || ""}
                          onChange={(e) => handleSearchChange(index, e.target.value)}
                          className="min-h-11 w-full rounded-xl border border-[#E0D4CF] bg-white py-2 pl-9 pr-3 text-sm text-[#2D2626] outline-none focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/10"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-2">
                      {getFilteredIngredients(index).length > 0 ? (
                        getFilteredIngredients(index).map((ing) => {
                          const selected = variant.ingredients.find((i) => String(i.ingredient_id) === String(ing.id));

                          return (
                            <div
                              key={ing.id}
                              className={`rounded-xl border p-3 transition-colors ${
                                selected
                                  ? "border-[#D9A7A1] bg-[#F8EDEA]"
                                  : "border-[#E9DFDB] bg-white hover:border-[#D9A7A1]"
                              }`}
                            >
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!selected}
                                  onChange={(e) =>
                                    handleIngredientChange(
                                      index,
                                      ing.id,
                                      String(selected?.amount || ""),
                                      e.target.checked
                                    )
                                  }
                                  className="mt-0.5 h-4 w-4 rounded accent-[#A76560] focus:ring-2 focus:ring-[#C98A84]/20"
                                  disabled={loading}
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-[#2D2626]">{ing.ingredient_name}</div>
                                  <div className="text-xs text-[#796E6B]">
                                    Available: <span className="font-medium text-[#514441]">{ing.quantity ?? 0} {ing.unit}</span>
                                  </div>

                                  {selected && (
                                    <input
                                      type="number"
                                      placeholder={`Amount (${ing.unit})`}
                                      value={selected.amount}
                                      onChange={(e) =>
                                        handleIngredientChange(index, ing.id, e.target.value, true)
                                      }
                                      step="0.01"
                                      min="0"
                                      className="mt-2 min-h-11 w-full rounded-lg border border-[#E0D4CF] bg-white px-3 text-sm text-[#2D2626] outline-none focus:border-[#C98A84] focus:ring-2 focus:ring-[#C98A84]/10"
                                      disabled={loading}
                                    />
                                  )}
                                </div>
                              </label>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-full py-8 text-center text-[#8A7C78]">
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
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B97872] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <FiCheckCircle size={18} />
                  Create Product
                </>
              )}
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-12 flex-1 rounded-xl border border-[#E0D4CF] px-6 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#F5EFEC] disabled:opacity-50 sm:flex-none"
                disabled={loading}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}