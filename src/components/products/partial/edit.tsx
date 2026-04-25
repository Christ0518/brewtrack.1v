"use client";
import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { Product} from "@/types/products";

interface EditProductProps {
  productId: number | string;
  shopId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function EditProduct({
  productId,
  shopId,
  onSuccess,
  onCancel
}: EditProductProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [categories, setCategories] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    ingredient_name: "",
    quantity: "",
    unit: "kg"
  });
  const [ingredientError, setIngredientError] = useState("");
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch product
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) {
        onCancel?.();
        return;
      }

      try {
        const response = await Fetch_to(
          `${api_links.tbl_products}?id=${productId}&shop_id=${shopId}`,
          {},
          {},
          3,
          1000,
          "GET"
        );

        if (response.success && response.data) {
          const productData = Array.isArray(response.data)
            ? response.data[0]
            : response.data;
          setProduct(productData);
          setForm(productData);
          
          if (productData.id) {
            const storedImage = localStorage.getItem(`product_image_${productData.id}`);
            if (storedImage) {
              setImagePreview(storedImage);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        onCancel?.();
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, shopId, onCancel]);

  // Load categories and ingredients
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await Fetch_to(
          `${api_links.tbl_category}?shop_id=${shopId}`,
          {},
          {},
          3,
          1000,
          "GET"
        );
        if (response.success) {
          const categoryData = Array.isArray(response.data) ? response.data : [];
          setCategories(categoryData);
        }

        const ingredientsResponse = await Fetch_to(
          `${api_links.tbl_ingredients}?shop_id=${shopId}`,
          {},
          {},
          3,
          1000,
          "GET"
        );
        if (ingredientsResponse.success) {
          const ingredientsData = Array.isArray(ingredientsResponse.data)
            ? ingredientsResponse.data
            : [];
          setIngredients(ingredientsData);
        }
      } catch (err) {
        console.error("Cannot fetch data:", err);
      }
    };
    loadData();
  }, [shopId]);

  const handleInputChange = (field: keyof Product, value: any) => {
    if (form) setForm({ ...form, [field]: value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setImageBase64(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVariantChange = (index: number, field: string, value: any) => {
    if (!form) return;
    const variants = [...(form.variants || [])];
    variants[index] = { ...variants[index], [field]: value };
    setForm({ ...form, variants });
  };

  const addVariant = () => {
    if (!form) return;
    setForm({
      ...form,
      variants: [
        ...(form.variants || []),
        { id: `temp-${Date.now()}`, name: "", price: 0, calculated_cost: 0, ingredients: [] }
      ]
    });
  };

  const removeVariant = (index: number) => {
    if (!form) return;
    const variants = form.variants?.filter((_, i) => i !== index) || [];
    setForm({ ...form, variants });
  };

  const handleIngredientChange = (
    variantIndex: number,
    ingredientId: number,
    amount: string,
    checked: boolean
  ) => {
    if (!form) return;
    const variants = [...(form.variants || [])];
    if (!variants[variantIndex].ingredients) {
      variants[variantIndex].ingredients = [];
    }

    const existingIndex = variants[variantIndex].ingredients?.findIndex(
      (i: any) => i.ingredient_id === ingredientId
    );

    if (checked) {
      if (existingIndex === -1) {
        variants[variantIndex].ingredients?.push({
          ingredient_id: ingredientId,
          amount: amount ? Number(amount) : 0
        } as any);
      } else {
        (variants[variantIndex].ingredients as any[])[existingIndex].amount =
          amount ? Number(amount) : 0;
      }
    } else {
      if (existingIndex !== -1) {
        variants[variantIndex].ingredients?.splice(existingIndex, 1);
      }
    }

    setForm({ ...form, variants });
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
      !newIngredient.unit
    ) {
      setIngredientError("All ingredient fields are required");
      return;
    }

    try {
      setIngredientError("");
      const payload = {
        ingredient_name: newIngredient.ingredient_name,
        unit: newIngredient.unit,
        quantity: newIngredient.quantity ? Number(newIngredient.quantity) : null,
        unit_price: null
      };

      const response = await Fetch_to(
        `${api_links.tbl_ingredients}?shop_id=${shopId}`,
        payload,
        {},
        3,
        1000,
        "POST"
      );

      if (response.success) {
        setShowAddIngredientModal(false);
        setNewIngredient({
          ingredient_name: "",
          quantity: "",
          unit: "kg"
        });
        alert("Ingredient added successfully!");

        const ingredientsResponse = await Fetch_to(
          `${api_links.tbl_ingredients}?shop_id=${shopId}`,
          {},
          {},
          3,
          1000,
          "GET"
        );
        if (
          ingredientsResponse.success &&
          Array.isArray(ingredientsResponse.data)
        ) {
          setIngredients(ingredientsResponse.data);
        }
      } else {
        setIngredientError(response.message || "Failed to add ingredient");
      }
    } catch (err: any) {
      setIngredientError(err.message || "Failed to add ingredient");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    
    setError("");
    setSubmitLoading(true);

    try {
      if (!form.category_id || !form.product_name) {
        throw new Error("Category and Product Name are required");
      }

      const payload = { ...form, shopId };
      const { image, ...formWithoutImage } = payload;

      const response = await Fetch_to(
        `${api_links.tbl_products}?id=${form.id}`,
        formWithoutImage,
        {},
        3,
        1000,
        "PUT"
      );

      if (!response.success) {
        throw new Error(response.message || "Operation failed");
      }

      if (imageBase64 && form.id) {
        localStorage.setItem(`product_image_${form.id}`, imageBase64);
      }

      alert("Product updated successfully!");
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!form) return;
    
    setSubmitLoading(true);

    try {
      const response = await Fetch_to(
        `${api_links.tbl_products}?id=${form.id}&shop_id=${shopId}`,
        {},
        {},
        3,
        1000,
        "DELETE"
      );

      if (!response.success) {
        throw new Error(response.message || "Failed to delete product");
      }

      alert("Product deleted successfully!");
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Failed to delete product");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete confirmation dialog
  if (showDeleteConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
        <div className="bg-white w-full max-w-md rounded-lg shadow-xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Product</h2>
          <p className="text-slate-600 mb-4">
            Are you sure you want to delete "{form?.product_name}"? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={submitLoading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
            >
              {submitLoading ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Add Ingredient Modal
  if (showAddIngredientModal) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
        <div className="bg-white w-full max-w-md rounded-lg shadow-xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Add New Ingredient</h2>

          {ingredientError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {ingredientError}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Ingredient Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={newIngredient.ingredient_name}
              onChange={(e) =>
                setNewIngredient({
                  ...newIngredient,
                  ingredient_name: e.target.value
                })
              }
              placeholder="e.g., Coffee Beans, Milk, Sugar"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Quantity <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                value={newIngredient.quantity}
                onChange={(e) =>
                  setNewIngredient({
                    ...newIngredient,
                    quantity: e.target.value
                  })
                }
                placeholder="e.g., 1000"
                step="0.01"
                min="0"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none"
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
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none cursor-pointer"
              >
                <option value="kg">Kilogram (kg)</option>
                <option value="g">Gram (g)</option>
                <option value="L">Liter (L)</option>
                <option value="ml">Milliliter (ml)</option>
                <option value="pcs">Pieces (pcs)</option>
                <option value="box">Box</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowAddIngredientModal(false);
                setIngredientError("");
                setNewIngredient({
                  ingredient_name: "",
                  quantity: "",
                  unit: "kg"
                });
              }}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAddIngredient}
              className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitLoading}
            >
              {submitLoading ? "Adding..." : "Add Ingredient"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#073dbe] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 font-medium">Product not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10 p-4 lg:p-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
              Edit Product
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Update product information
            </p>
          </div>
          <button
            className="text-slate-600 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-lg transition-all"
            onClick={onCancel}
            disabled={submitLoading}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="p-4 lg:p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg p-4 lg:p-6 border border-slate-200">
            {/* Category & Product Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-slate-700 mb-2">
                  Category <span className="text-red-600">*</span>
                </label>
                <select
                  value={form.category_id || ""}
                  onChange={(e) => handleInputChange("category_id", e.target.value)}
                  className="p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none cursor-pointer"
                  required
                  disabled={submitLoading}
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium text-slate-700 mb-2">
                  Product Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={form.product_name}
                  onChange={(e) => handleInputChange("product_name", e.target.value)}
                  placeholder="e.g., Caramel Macchiato"
                  className="p-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                  required
                  disabled={submitLoading}
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={form.product_description}
                onChange={(e) => handleInputChange("product_description", e.target.value)}
                placeholder="Enter product description..."
                className="p-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-none"
                rows={3}
                disabled={submitLoading}
              />
            </div>

            {/* Image Upload */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700 mb-2">
                Product Image
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-[#073dbe] transition-all">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                  disabled={submitLoading}
                />
                <label htmlFor="image-upload" className={`${submitLoading ? "cursor-not-allowed" : "cursor-pointer"}`}>
                  {imagePreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-40 w-40 object-cover rounded-lg border border-slate-200"
                      />
                      <div className="flex items-center gap-2 text-[#073dbe] font-medium text-sm">
                        Click to change image
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <div className="bg-slate-100 p-3 rounded-lg text-slate-400 text-xl font-light">∾</div>
                      <div className="text-center">
                        <p className="font-medium text-slate-700 text-sm">Click to upload image</p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 10MB</p>
                      </div>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Variants */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">
                  Variants ({form.variants?.length || 0})
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddIngredientModal(true)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-xs"
                    disabled={submitLoading}
                  >
                    + Add Ingredient
                  </button>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="px-3 py-1 bg-blue-50 text-[#073dbe] border border-blue-200 rounded-lg text-xs hover:bg-blue-100 transition-all"
                    disabled={submitLoading}
                  >
                    + Add Variant
                  </button>
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2 max-h-60 overflow-y-auto">
                {form.variants && form.variants.length > 0 ? (
                  form.variants.map((v, idx) => (
                    <div key={v.id || idx} className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Variant name"
                          value={v.name}
                          onChange={(e) => handleVariantChange(idx, "name", e.target.value)}
                          className="p-2 border border-slate-300 rounded text-sm"
                          disabled={submitLoading}
                        />
                        <input
                          type="number"
                          placeholder="Price"
                          value={v.price || 0}
                          onChange={(e) => handleVariantChange(idx, "price", parseFloat(e.target.value) || 0)}
                          className="p-2 border border-slate-300 rounded text-sm"
                          disabled={submitLoading}
                        />
                        {form.variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariant(idx)}
                            className="px-3 py-2 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200 font-medium"
                            disabled={submitLoading}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      
                      {/* Ingredients Selection for variant */}
                      <div className="border-t border-slate-200 pt-2 mt-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-slate-600 font-medium">Ingredients</p>
                          <input
                            type="text"
                            placeholder="Search..."
                            value={searchQueries[idx] || ""}
                            onChange={(e) => handleSearchChange(idx, e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded text-xs w-32"
                            disabled={submitLoading}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                          {getFilteredIngredients(idx).length > 0 ? (
                            getFilteredIngredients(idx).map((ing) => {
                              const selected = v.ingredients?.find((i: any) => i.ingredient_id === ing.id);
                              return (
                                <div key={ing.id} className={`border rounded p-2 text-xs transition-all ${selected ? "border-[#073dbe] bg-blue-50" : "border-slate-200 bg-white"}`}>
                                  <label className="flex items-start gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!selected}
                                      onChange={(e) => handleIngredientChange(idx, Number(ing.id), "", e.target.checked)}
                                      className="mt-0.5 w-3.5 h-3.5 text-[#073dbe] rounded focus:ring-2 focus:ring-blue-200"
                                      disabled={submitLoading}
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium text-slate-900">{ing.ingredient_name}</div>
                                      {selected && (
                                        <input
                                          type="number"
                                          placeholder={`Amount (${ing.unit})`}
                                          value={selected.amount || 0}
                                          onChange={(e) => handleIngredientChange(idx, Number(ing.id), e.target.value, true)}
                                          step="0.01"
                                          min="0"
                                          className="w-full mt-1 p-1 border border-[#073dbe] rounded text-xs focus:ring-2 focus:ring-blue-100 outline-none"
                                          disabled={submitLoading}
                                        />
                                      )}
                                    </div>
                                  </label>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-500 col-span-full text-center py-2">No ingredients</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No variants added yet</p>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
              <button
                type="submit"
                className="flex-1 bg-[#073dbe] hover:bg-[#052d99] text-white py-2.5 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={submitLoading}
              >
                {submitLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Updating...
                  </>
                ) : (
                  <>Update Product</>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white py-2.5 px-6 rounded-lg transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitLoading}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 sm:flex-none bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 px-6 rounded-lg transition-all font-medium"
                disabled={submitLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: #073dbe;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #052d99;
        }
      `}</style>
    </div>
  );
}
