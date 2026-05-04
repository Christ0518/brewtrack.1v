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
    if (!newIngredient.ingredient_name || !newIngredient.quantity || !newIngredient.unit) {
      showAlert("All ingredient fields are required", { variant: "error", title: "Validation Error" });
      return;
    }

    try {
      setAddingIngredient(true);

      const converted = convertToBaseUnit(newIngredient.quantity, newIngredient.unit);
      const response = await Fetch_to(
        `${api_links.tbl_ingredients}?shop_id=${shopId}`,
        {
          ingredient_name: newIngredient.ingredient_name,
          quantity: converted.quantity,
          unit: converted.unit,
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
      setNewIngredient({ ingredient_name: "", quantity: "", unit: "g" });
      await loadIngredients();
      showAlert(`Ingredient added (${converted.quantity} ${converted.unit})`, {
        variant: "success",
        title: "Ingredient Added",
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
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <AlertModal />
      <div className="max-w-6xl mx-auto">
        {showAddIngredient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">Add New Ingredient</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddIngredient(false);
                    setNewIngredient({ ingredient_name: "", quantity: "", unit: "g" });
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={addingIngredient}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ingredient Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Coffee Beans"
                    value={newIngredient.ingredient_name}
                    onChange={(e) =>
                      setNewIngredient({ ...newIngredient, ingredient_name: e.target.value })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                    disabled={addingIngredient}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Quantity <span className="text-red-600">*</span>
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
                      className="w-full p-2.5 border border-slate-300 rounded-lg focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                      disabled={addingIngredient}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Unit <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={newIngredient.unit}
                      onChange={(e) =>
                        setNewIngredient({ ...newIngredient, unit: e.target.value })
                      }
                      className="w-full p-2.5 border border-slate-300 rounded-lg focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none bg-white cursor-pointer"
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

                {newIngredient.quantity && newIngredient.unit && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-900 mb-1">Conversion Preview:</p>
                    <p className="text-sm text-blue-700">
                      {newIngredient.quantity} {newIngredient.unit} = {" "}
                      <span className="font-bold">
                        {convertToBaseUnit(newIngredient.quantity, newIngredient.unit).quantity}{" "}
                        {convertToBaseUnit(newIngredient.quantity, newIngredient.unit).unit}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 p-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddIngredient(false);
                    setNewIngredient({ ingredient_name: "", quantity: "", unit: "g" });
                  }}
                  className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-all font-medium text-sm"
                  disabled={addingIngredient}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="flex-1 px-4 py-2 bg-[#073dbe] hover:bg-[#052d99] text-white rounded-lg transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={addingIngredient}
                >
                  {addingIngredient ? "Adding..." : "Add Ingredient"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
                <div className="bg-[#073dbe] p-2.5 rounded-lg">
                  <FiPackage/>
                </div>
                Create Product
              </h1>
              <p className="text-slate-600 mt-1 text-sm">
                Add a new product with variants to your menu
              </p>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-slate-600 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-lg transition-all"
              >
                <FiX size={20} />
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 lg:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Product Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-slate-700 mb-2">
                  Product Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
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

          <div className="bg-white rounded-lg border border-slate-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-bold text-slate-900">Product Variants</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddIngredient(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 text-sm"
                  disabled={loading}
                >
                  <FiPlus size={16} />
                  Add Ingredient
                </button>
                <button
                  type="button"
                  onClick={addVariant}
                  className="bg-[#073dbe] hover:bg-[#052d99] text-white px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 text-sm"
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
                  className="border border-slate-200 rounded-lg p-4 bg-slate-50"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                      <span className="bg-[#073dbe] text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs">
                        {index + 1}
                      </span>
                      Variant {index + 1}
                    </h3>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
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
                        type="text"
                        placeholder="e.g., Small, Medium, Large"
                        value={variant.variant_name}
                        onChange={(e) => handleVariantChange(index, "variant_name", e.target.value)}
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
                        placeholder="0.00"
                        value={variant.price}
                        onChange={(e) => handleVariantChange(index, "price", e.target.value)}
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
                        <FiSearch />
                        <input
                          type="text"
                          placeholder="Search ingredients..."
                          value={searchQueries[index] || ""}
                          onChange={(e) => handleSearchChange(index, e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none"
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
                                  onChange={(e) =>
                                    handleIngredientChange(
                                      index,
                                      ing.id,
                                      String(selected?.amount || ""),
                                      e.target.checked
                                    )
                                  }
                                  className="mt-0.5 w-4 h-4 text-[#073dbe] rounded focus:ring-2 focus:ring-blue-200"
                                  disabled={loading}
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-slate-900 text-sm">{ing.ingredient_name}</div>
                                  <div className="text-xs text-slate-500">
                                    Available: {ing.quantity ?? 0} {ing.unit}
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
              className="flex-1 bg-[#073dbe] hover:bg-[#052d99] text-white py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                className="flex-1 sm:flex-none bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-lg transition-all font-medium disabled:opacity-50"
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