"use client";

import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import AddProduct from "./partial/add";
import EditProduct from "./partial/update"; // ✅ was missing
import { CategoryForm } from "@/components/category";
import { Product } from "@/types/products";
import { useAlertModal } from "@/hooks/useAlertModal";

interface ProductsPageProps {
  shopId?: string;
}

const CATEGORY_COLORS: Record<number, string> = {
  1: "bg-[#6c3030]",
  2: "bg-[#8a5a3b]",
  3: "bg-[#9b7653]",
  4: "bg-[#bc9b7a]",
  5: "bg-[#754c35]",
};

export default function ProductsPage({ shopId = "1" }: ProductsPageProps) {
  const isShopTwo = shopId === "2";
  const accentButtonClass = isShopTwo
    ? "bg-[#bc9b7a] hover:bg-[#9b7653] text-white"
    : "bg-[#6c3030] hover:bg-[#522424] text-white";
  const accentBorderClass = isShopTwo ? "border-[#bc9b7a]" : "border-[#6c3030]";
  const accentHoverBorderClass = isShopTwo ? "hover:border-[#bc9b7a]" : "hover:border-[#6c3030]";
  const accentFocusClass = isShopTwo
    ? "focus:border-[#bc9b7a] focus:ring-[#f3e3cf]"
    : "focus:border-[#6c3030] focus:ring-[#ead8c5]";
  const accentTextClass = isShopTwo ? "text-[#8a6245]" : "text-[#6c3030]";
  const accentSoftBadgeClass = isShopTwo ? "bg-[#f3e3cf] text-[#754c35]" : "bg-[#ead8c5] text-[#6c3030]";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null); // ✅ inline delete state
  const { showAlert, AlertModal } = useAlertModal();

  /* =========================
     FETCH
  ========================= */
  const fetchProducts = async () => {
    try {
      setLoading(true);
      // ✅ new API returns { success, products } not { success, data }
      const response = await Fetch_to(
        `${api_links.tbl_products}?shop_id=${shopId}`,
        {},
        {},
        3,
        1000,
        "GET"
      );

      if (response.success) {
        const payload = response.data as { products?: Product[] } | Product[] | undefined;
        const apiProducts = Array.isArray(payload) ? payload : payload?.products;
        setProducts(Array.isArray(apiProducts) ? apiProducts : []);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await Fetch_to(
        `${api_links.tbl_category}?shop_id=${shopId}`,
        {},
        {},
        3,
        1000,
        "GET"
      );
      if (response.success && Array.isArray(response.data)) {
        setCategories(response.data);
      }
    } catch (err) {
      console.error("Cannot fetch categories:", err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [shopId]);

  /* =========================
     HANDLERS
  ========================= */
  const handleCreateClick = () => {
    setFormMode("create");
    setSelectedProduct(undefined);
    setShowForm(true);
  };

  const handleEditClick = (product: Product) => {
    setFormMode("edit");
    setSelectedProduct(product);
    setShowForm(true);
  };

  // ✅ Inline delete with confirmation — no separate page/modal needed
  const handleDeleteClick = async (product: Product) => {
    if (!confirm(`Delete "${product.product_name}"? This cannot be undone.`)) return;

    try {
      setDeletingId(Number(product.id));
      const response = await Fetch_to(
        `${api_links.tbl_products}?shop_id=${shopId}`,
        { id: product.id },
        {},
        3,
        1000,
        "DELETE"
      );

      if (response.success) {
        // Optimistically remove from state without full refetch
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
      } else {
        showAlert(response.message || "Failed to delete product", { variant: "error", title: "Delete Failed" });
      }
    } catch (err) {
      console.error("Delete error:", err);
      showAlert("Error deleting product", { variant: "error", title: "Delete Failed" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedProduct(undefined);
    fetchProducts();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setSelectedProduct(undefined);
  };

  const handleDeleteCategory = async (category: any) => {
    if (!confirm(`Delete category "${category.name}"?`)) return;

    try {
      const response = await Fetch_to(
        api_links.tbl_category,
        { id: category.id, shop_id: shopId },
        {},
        3,
        1000,
        "DELETE"
      );

      if (response.success) {
        if (selectedCategory === String(category.id)) {
          setSelectedCategory("all");
        }
        await Promise.all([fetchCategories(), fetchProducts()]);
      } else {
        showAlert(response.message || "Failed to delete category", { variant: "error", title: "Delete Failed" });
      }
    } catch (err) {
      console.error("Delete category error:", err);
      showAlert("Error deleting category", { variant: "error", title: "Delete Failed" });
    }
  };

  /* =========================
     CATEGORY HELPERS
  ========================= */
  const getCategoryName = (categoryId: any) => {
    return categories.find((c) => Number(c.id) === Number(categoryId))?.name || "Unknown";
  };

  const getCategoryColor = (categoryId: any) =>
    CATEGORY_COLORS[Number(categoryId)] || "bg-[#8a5a3b]";

  /* =========================
     FILTERING
  ========================= */
  const filteredProducts = products.filter((p) =>
    p.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedProducts = () => {
    if (filteredProducts.length > 0 && categories.length === 0) {
      return [
        {
          category: { id: "all-products", name: "All Products" },
          products: filteredProducts,
        },
      ];
    }

    const cats = selectedCategory === "all"
      ? categories
      : categories.filter((c) => Number(c.id) === Number(selectedCategory));

    const grouped = cats.map((category) => ({
      category,
      products: filteredProducts.filter((p) => Number(p.category_id) === Number(category.id)),
    }));

    if (grouped.length === 0 && filteredProducts.length > 0) {
      return [
        {
          category: { id: "unmatched-category", name: "Uncategorized" },
          products: filteredProducts,
        },
      ];
    }

    return grouped;
  };

  /* =========================
     LOADING
  ========================= */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className={`w-16 h-16 border-4 ${accentBorderClass} border-t-transparent rounded-full animate-spin mx-auto mb-4`} />
          <p className="text-slate-600 font-medium">Loading products...</p>
        </div>
      </div>
    );
  }

  /* =========================
     FORM PAGES (full screen)
  ========================= */
  if (showForm && formMode === "create") {
    return (
      <AddProduct
        shopId={shopId}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (showForm && formMode === "edit" && selectedProduct?.id) {
    return (
      <EditProduct
        productId={selectedProduct.id}
        shopId={shopId}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  /* =========================
     MAIN LIST
  ========================= */
  return (
    <>
      <AlertModal />
      <div className="min-h-screen bg-[#f8f1e8] p-4 lg:p-6">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-[#6c3030]">
                  Product Management
                </h1>
                <p className="text-[#8a6245] mt-1 text-sm">
                  Manage your menu items and variants ({products.length} total)
                </p>
              </div>
              <div className="flex gap-2 w-full lg:w-auto">
                <button
                  onClick={() => setShowAddCategoryModal(true)}
                  className="bg-[#9b7653] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#754c35]"
                >
                  Add Category
                </button>
                <button
                  onClick={handleCreateClick}
                  className={`${accentButtonClass} px-5 py-2.5 text-sm font-medium transition-all`}
                >
                  Add Product
                </button>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4 border border-[#d6c3af] bg-white p-3">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border border-slate-300 px-4 py-2 text-sm outline-none transition-all focus:ring-2 ${accentFocusClass}`}
            />
          </div>

          {/* Category Filter Tabs */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#6e5338]">Filter by Category</h3>
              <span className="text-xs text-[#8a6245]">
                <span className={`font-semibold ${accentTextClass}`}>{filteredProducts.length}</span> products
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-4 py-2 rounded-lg border transition-all whitespace-nowrap flex items-center gap-2 shrink-0 text-sm font-medium ${
                  selectedCategory === "all"
                    ? `${accentButtonClass} ${accentBorderClass}`
                    : `bg-white border-[#d6c3af] ${accentHoverBorderClass} text-[#6e5338]`
                }`}
              >
                All
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedCategory === "all" ? "bg-white/20" : accentSoftBadgeClass
                }`}>
                  {products.length}
                </span>
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id.toString())}
                  className={`px-4 py-2 rounded-lg border transition-all whitespace-nowrap flex items-center gap-2 shrink-0 text-sm font-medium ${
                    selectedCategory === category.id.toString()
                      ? `${getCategoryColor(category.id)} border-transparent text-white`
                      : `bg-white border-[#d6c3af] ${accentHoverBorderClass} text-[#6e5338]`
                  }`}
                >
                  {category.name}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedCategory === category.id.toString()
                      ? "bg-white/20"
                      : "bg-[#f3e3cf] text-[#8a6245]"
                  }`}>
                    {products.filter((p) => Number(p.category_id) === Number(category.id)).length}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDeleteCategory(category);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteCategory(category);
                      }
                    }}
                    className={`ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs border transition-colors ${
                      selectedCategory === category.id.toString()
                        ? "border-white/40 text-white/90 hover:bg-white/20"
                        : "border-[#d6c3af] text-[#8a6245] hover:bg-[#f3e3cf] hover:text-[#6c3030] hover:border-[#bc9b7a]"
                    }`}
                    title={`Delete ${category.name}`}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
              <div className="border border-[#d6c3af] bg-white p-12 text-center">
              <h3 className="text-lg font-bold text-[#6c3030] mb-2">No Products Found</h3>
              <p className="text-[#8a6245] text-sm mb-6">
                {searchQuery ? "Try adjusting your search" : "Start by adding your first product"}
              </p>
              <button
                onClick={handleCreateClick}
                className={`inline-flex items-center gap-2 ${accentButtonClass} px-5 py-2.5 rounded-lg transition-all font-medium text-sm`}
              >
                Add Product
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedProducts().map(({ category, products: categoryProducts }) => (
                <div key={category.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`${getCategoryColor(category.id)} w-1 h-6 rounded-full`} />
                    <h2 className="text-xl font-bold text-[#6c3030]">{category.name}</h2>
                    <span className="text-sm text-[#9b7653]">({categoryProducts.length})</span>
                  </div>

                  {categoryProducts.length === 0 ? (
                    <div className="bg-white rounded-lg border border-[#d6c3af] p-8 text-center">
                      <p className="text-[#9b7653] text-sm">No products in this category yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {categoryProducts.map((p) => {
                        const isDeleting = deletingId === Number(p.id);

                        // ✅ fixed: was summing prices, now sums variant quantity
                        const totalQuantity =
                          p.variants?.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0) ?? 0;

                        return (
                          <div
                            key={p.id}
                            className={`bg-white rounded-lg border border-[#d6c3af] hover:border-[#bc9b7a] transition-all overflow-hidden flex flex-col ${
                              isDeleting ? "opacity-50 pointer-events-none" : ""
                            }`}
                          >
                            {/* Image */}
                            <div className="relative h-44 w-full bg-[#f3e3cf] flex items-center justify-center overflow-hidden">
                              {/* ✅ use p.image directly — it's already a Supabase URL */}
                              {p.image ? (
                                <img
                                  src={p.image}
                                  alt={p.product_name}
                                  className="h-full w-full object-cover hover:scale-105 transition-transform duration-300"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                              ) : (
                                <div className="text-[#bc9b7a] text-center p-4">
                                  <span className="text-xs">No image</span>
                                </div>
                              )}
                              <div className="absolute top-2 right-2">
                                <span className={`${getCategoryColor(p.category_id)} text-white text-xs font-medium px-2.5 py-1 rounded-full`}>
                                  {getCategoryName(p.category_id)}
                                </span>
                              </div>
                            </div>

                            {/* Content */}
                            <div className="p-4 flex-1 flex flex-col">
                              <h2 className="text-base font-bold text-[#6c3030] mb-2 line-clamp-1">
                                {p.product_name}
                              </h2>
                              <p className="text-sm text-[#8a6245] mb-3 line-clamp-2 flex-1">
                                {p.product_description || "No description available"}
                              </p>

                              {/* Variants */}
                              {p.variants && p.variants.length > 0 && (
                                <div className="mb-4 space-y-2">
                                  <h3 className="font-semibold text-xs text-slate-700 flex items-center gap-2">
                                    <span className="w-1 h-3 bg-[#bc9b7a] rounded" />
                                    Variants ({p.variants.length})
                                  </h3>
                                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                    {p.variants.map((v) => (
                                      <div
                                        key={v.id}
                                        className="bg-[#f8f1e8] rounded-lg p-2.5 border border-[#d6c3af]"
                                      >
                                        <div className="flex justify-between items-start">
                                          <span className="font-medium text-[#6c3030] text-sm">{v.name}</span>
                                          <div className="text-right">
                                            <div className={`${accentTextClass} font-bold text-sm`}>
                                              ₱{Number(v.price).toFixed(2)}
                                            </div>
                                            {v.calculated_cost ? (
                                              <div className="text-xs text-[#8a6245] mt-0.5">
                                                Cost: ₱{Number(v.calculated_cost).toFixed(2)}
                                              </div>
                                            ) : null}
                                            {/* ✅ show makeable quantity */}
                                            <div className={`text-xs mt-0.5 font-medium ${
                                              (v.quantity ?? 0) > 0 ? "text-green-600" : "text-red-500"
                                            }`}>
                                              Qty: {v.quantity ?? 0}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex gap-2 mt-auto pt-3 border-t border-[#d6c3af]">
                                <button
                                  onClick={() => handleEditClick(p)}
                                  className={`flex-1 ${accentButtonClass} py-2 rounded-lg transition-all font-medium text-sm`}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(p)}
                                  disabled={isDeleting}
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-all font-medium text-sm disabled:opacity-50"
                                >
                                  {isDeleting ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <CategoryForm
          shopId={shopId}
          onSuccess={() => { setShowAddCategoryModal(false); fetchCategories(); }}
          onCancel={() => setShowAddCategoryModal(false)}
        />
      )}
    </>
  );
}