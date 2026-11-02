"use client";

import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import AddProduct from "./partial/add";
import EditProduct from "./partial/update"; // ✅ was missing
import { CategoryForm } from "@/components/category";
import { Product } from "@/types/products";
import { useAlertModal } from "@/hooks/useAlertModal";
import { FiCheck, FiImage, FiLayers, FiPlus, FiSearch, FiTag, FiTrash2 } from "react-icons/fi";

interface ProductsPageProps {
  shopId?: string;
}

const CATEGORY_COLORS: Record<number, string> = {
  1: "bg-[#F8EDEA] text-[#A76560]",
  2: "bg-[#EAF3EC] text-[#527B5B]",
  3: "bg-[#FBF1DF] text-[#9A7138]",
  4: "bg-[#F4EAF0] text-[#96657C]",
  5: "bg-[#EEEAF3] text-[#74638A]",
};

export default function ProductsPage({ shopId = "1" }: ProductsPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "out-of-stock">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
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
    CATEGORY_COLORS[Number(categoryId)] || "bg-[#F1F5F9] text-[#475569]";

  /* =========================
     FILTERING
  ========================= */
  const isInStock = (product: Product) =>
    (product.variants ?? []).some((variant) => Number(variant.quantity ?? 0) > 0);

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.product_name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesCategory = selectedCategory === "all" || Number(product.category_id) === Number(selectedCategory);
    const matchesStock = stockFilter === "all" || (stockFilter === "in-stock" ? isInStock(product) : !isInStock(product));
    return matchesSearch && matchesCategory && matchesStock;
  });

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleSelectVisible = () => {
    const visibleIds = filteredProducts.flatMap((product) => product.id ? [String(product.id)] : []);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedProductIds.has(id));
    setSelectedProductIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const handleBulkCategoryUpdate = async () => {
    if (!bulkCategoryId || selectedProductIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const results = await Promise.all(
        Array.from(selectedProductIds).map(async (id) => {
          try {
            const response = await Fetch_to(
              `${api_links.tbl_products}?shop_id=${shopId}`,
              { id, shop_id: shopId, category_id: bulkCategoryId },
              {},
              3,
              1000,
              "PUT"
            );
            return { id, success: response.success };
          } catch (error) {
            console.error(`Failed to update product ${id}:`, error);
            return { id, success: false };
          }
        })
      );
      const updatedIds = new Set(results.filter((result) => result.success).map((result) => result.id));
      if (updatedIds.size > 0) {
        setProducts((current) => current.map((product) =>
          product.id && updatedIds.has(String(product.id))
            ? { ...product, category_id: bulkCategoryId }
            : product
        ));
        setSelectedProductIds(new Set());
        setBulkCategoryId("");
      }
      const failedCount = results.length - updatedIds.size;
      if (failedCount > 0) {
        showAlert(`${updatedIds.size} product(s) updated. ${failedCount} could not be updated.`, {
          variant: "error",
          title: "Bulk update incomplete",
        });
      } else {
        showAlert(`${updatedIds.size} product(s) moved to ${getCategoryName(bulkCategoryId)}.`, {
          variant: "success",
          title: "Products updated",
        });
      }
    } finally {
      setBulkUpdating(false);
    }
  };

  /* =========================
     LOADING
  ========================= */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF6F4]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#ECE6E2] border-t-[#C98A84]" />
          <p className="font-medium text-[#796E6B]">Loading products…</p>
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

  return (
    <>
      <AlertModal />
      <main className="min-h-screen bg-[#FAF6F4] px-4 pb-10 pt-20 text-[#2D2626] sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1600px]">
          <header className="mb-7 flex flex-col gap-5 rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#9B7773]">
                <FiLayers aria-hidden="true" className="h-4 w-4" />
                <span>POS catalog</span>
                <span aria-hidden="true">/</span>
                <span className="text-[#796E6B]">Products</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#2D2626] sm:text-4xl">Product catalog</h1>
              <p className="mt-1 text-sm text-[#8A7C78]">Manage menu items, pricing, availability, and recipes.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] px-4 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#ECE6E2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84]"
              >
                <FiTag aria-hidden="true" className="h-4 w-4" />
                Add category
              </button>
              <button
                onClick={handleCreateClick}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(201,138,132,0.24)] transition-colors hover:bg-[#B97973] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A76560]"
              >
                <FiPlus aria-hidden="true" className="h-5 w-5" />
                Add product
              </button>
            </div>
          </header>

          <section className="mb-6 rounded-2xl border border-[#E9DFDB] bg-white p-4 shadow-[0_8px_30px_rgba(69,47,39,0.04)] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block w-full lg:max-w-md">
                <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A39490]" />
                <span className="sr-only">Search products</span>
                <input
                  type="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-[#E0D4CF] bg-[#FAF6F4] pl-11 pr-4 text-sm text-[#2D2626] placeholder:text-[#A39490] outline-none transition focus:border-[#C98A84] focus:ring-4 focus:ring-[#C98A84]/15"
                />
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
                <div className="inline-flex min-h-12 items-center rounded-xl bg-[#ECE6E2] p-1" role="group" aria-label="Filter by stock status">
                  {([
                    ["all", "All stock"],
                    ["in-stock", "In stock"],
                    ["out-of-stock", "Out of stock"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStockFilter(value)}
                      aria-pressed={stockFilter === value}
                      className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
                        stockFilter === value ? "bg-white text-[#A76560] shadow-sm" : "text-[#796E6B] hover:text-[#2D2626]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-[#8A7C78]"><span className="font-semibold text-[#2D2626]">{filteredProducts.length}</span> of {products.length} products</span>
              </div>
            </div>

            <div className="mt-5 border-t border-[#F0E9E6] pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[#514441]">Categories</h2>
                {categories.length > 0 && <span className="text-xs text-[#A39490]">Choose a category to filter</span>}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  aria-pressed={selectedCategory === "all"}
                  className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors ${
                    selectedCategory === "all" ? "bg-[#C98A84] text-white shadow-sm" : "bg-[#ECE6E2] text-[#796E6B] hover:bg-[#E2D9D4]"
                  }`}
                >
                  All products <span className="ml-1 opacity-75">{products.length}</span>
                </button>
                {categories.map((category) => {
                  const active = selectedCategory === String(category.id);
                  return (
                    <div key={category.id} className="flex shrink-0 items-center overflow-hidden rounded-xl bg-[#ECE6E2]">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(String(category.id))}
                        aria-pressed={active}
                        className={`min-h-11 px-4 text-sm font-semibold transition-colors ${
                          active ? "bg-[#C98A84] text-white shadow-sm" : "text-[#796E6B] hover:bg-[#E2D9D4]"
                        }`}
                      >
                        {category.name}
                        <span className="ml-1 opacity-75">{products.filter((product) => Number(product.category_id) === Number(category.id)).length}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(category)}
                        className="flex h-11 w-10 items-center justify-center text-[#A39490] transition-colors hover:bg-[#F8EDEA] hover:text-[#A76560] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#C98A84]"
                        aria-label={`Delete ${category.name} category`}
                        title={`Delete ${category.name}`}
                      >
                        <FiTrash2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {selectedProductIds.size > 0 && (
            <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#E5C7C2] bg-[#F8EDEA] p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Bulk product actions">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#B97973]">
                  <FiCheck aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#704B47]">{selectedProductIds.size} selected</p>
                  <p className="text-xs text-[#9B7773]">Bulk edit category</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={bulkCategoryId}
                  onChange={(event) => setBulkCategoryId(event.target.value)}
                  aria-label="Choose category for selected products"
                  className="min-h-12 rounded-xl border border-[#E5C7C2] bg-white px-3 text-sm text-[#514441] outline-none focus:border-[#C98A84] focus:ring-2 focus:ring-[#C98A84]/15"
                >
                  <option value="">Choose category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleBulkCategoryUpdate}
                  disabled={!bulkCategoryId || bulkUpdating}
                  className="min-h-12 rounded-xl bg-[#C98A84] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#B97973] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkUpdating ? "Updating…" : "Apply changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProductIds(new Set())}
                  className="min-h-12 rounded-xl px-4 text-sm font-semibold text-[#A76560] transition-colors hover:bg-white/70"
                >
                  Clear
                </button>
              </div>
            </section>
          )}

          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#514441]">Menu items <span className="ml-1 font-normal text-[#A39490]">{filteredProducts.length}</span></p>
            {filteredProducts.length > 0 && (
              <button
                type="button"
                onClick={handleSelectVisible}
                className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[#A76560] transition-colors hover:bg-[#F8EDEA]"
              >
                {filteredProducts.every((product) => product.id && selectedProductIds.has(String(product.id))) ? "Deselect visible" : "Select visible"}
              </button>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DCCFC9] bg-white px-6 py-16 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ECE6E2] text-[#8A7C78]">
                <FiSearch aria-hidden="true" className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-[#2D2626]">{products.length ? "No matching products" : "Your catalog is empty"}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-[#8A7C78]">
                {products.length ? "Try another search or adjust your category and stock filters." : "Add a product to start building your POS menu and recipe catalog."}
              </p>
              {!products.length && (
                <button onClick={handleCreateClick} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-semibold text-white hover:bg-[#B97973]">
                  <FiPlus aria-hidden="true" className="h-5 w-5" /> Add product
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const productId = String(product.id ?? "");
                const isDeleting = deletingId === Number(product.id);
                const inStock = isInStock(product);
                const variants = product.variants ?? [];
                const prices = variants.map((variant) => Number(variant.price)).filter(Number.isFinite);
                const minPrice = prices.length ? Math.min(...prices) : null;
                const recipeIngredients = Array.from(
                  new Map(
                    variants.flatMap((variant) => variant.ingredients ?? []).map((ingredient) => [
                      String(ingredient.ingredient_id),
                      ingredient,
                    ])
                  ).values()
                );

                return (
                  <article
                    key={productId || product.product_name}
                    className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E9DFDB] bg-white shadow-[0_8px_24px_rgba(69,47,39,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#D6B4AE] hover:shadow-[0_14px_32px_rgba(69,47,39,0.1)] ${
                      isDeleting ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#ECE6E2] sm:aspect-[16/10]">
                      {typeof product.image === "string" && product.image ? (
                        <img
                          src={product.image}
                          alt={product.product_name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          onError={(event) => { event.currentTarget.style.display = "none"; }}
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-[#A39490]">
                          <FiImage aria-hidden="true" className="h-7 w-7 sm:h-8 sm:w-8" />
                          <span className="hidden text-xs font-medium sm:inline">No product image</span>
                        </div>
                      )}
                      <div className="absolute left-3 top-3">
                        <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-white/70 bg-white/95 p-2 shadow-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(productId && selectedProductIds.has(productId))}
                            onChange={() => productId && toggleProductSelection(productId)}
                            aria-label={`Select ${product.product_name}`}
                            className="h-4 w-4 rounded border-[#A39490] text-[#C98A84] accent-[#C98A84] focus:ring-[#C98A84]"
                          />
                        </label>
                      </div>
                      <span className={`absolute right-2 top-2 rounded-full px-2.5 py-1.5 text-[10px] font-semibold shadow-sm sm:right-3 sm:top-3 sm:px-3 sm:text-xs ${inStock ? "bg-[#EAF3EC] text-[#527B5B]" : "bg-[#F8EDEA] text-[#A76560]"}`}>
                        {inStock ? "In stock" : "Out of stock"}
                      </span>
                      {minPrice !== null && (
                        <span className="absolute bottom-2 right-2 rounded-xl bg-white px-2.5 py-1.5 text-xs font-bold text-[#2D2626] shadow-sm sm:bottom-3 sm:right-3 sm:px-3 sm:py-2 sm:text-sm">
                          {prices.length > 1 ? `From ₱${minPrice.toFixed(2)}` : `₱${minPrice.toFixed(2)}`}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-3 sm:p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h2 className="min-w-0 text-sm font-bold text-[#2D2626] sm:text-base">{product.product_name}</h2>
                        <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${getCategoryColor(product.category_id)}`}>
                          {getCategoryName(product.category_id)}
                        </span>
                      </div>
                      <p className="mb-3 line-clamp-2 min-h-8 text-xs leading-5 text-[#8A7C78] sm:mb-4 sm:min-h-10 sm:text-sm">
                        {product.product_description || "No description added."}
                      </p>

                      <div className="mb-3 border-t border-[#F0E9E6] pt-3 sm:mb-4">
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[#796E6B] sm:text-xs">Recipe ingredients</h3>
                          <span className="text-[10px] text-[#A39490] sm:text-xs">{recipeIngredients.length} linked</span>
                        </div>
                        {recipeIngredients.length > 0 ? (
                          <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
                            {recipeIngredients.slice(0, 6).map((ingredient) => (
                              <span
                                key={ingredient.ingredient_id}
                                className="inline-flex max-w-full items-center gap-1 rounded-lg bg-[#EAF3EC] px-2 py-1.5 text-[10px] font-medium text-[#527B5B] sm:px-2.5 sm:text-xs"
                                title={`${ingredient.ingredient_name || ingredient.name || "Ingredient"}${ingredient.amount ? ` · ${ingredient.amount} ${ingredient.unit || ""}` : ""}`}
                              >
                                <FiCheck aria-hidden="true" className="h-3 w-3 shrink-0" />
                                <span className="truncate">{ingredient.ingredient_name || ingredient.name || "Ingredient"}</span>
                              </span>
                            ))}
                            {recipeIngredients.length > 6 && (
                              <span className="rounded-lg bg-[#ECE6E2] px-2.5 py-1.5 text-[10px] font-medium text-[#796E6B] sm:text-xs">+{recipeIngredients.length - 6} more</span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-[#A39490]">No ingredients linked yet.</p>
                        )}
                      </div>

                      {variants.length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-1.5">
                          {variants.slice(0, 3).map((variant) => (
                            <span key={variant.id || variant.name} className="rounded-lg bg-[#F8EDEA] px-2.5 py-1.5 text-[10px] font-medium text-[#A76560] sm:text-xs">
                              {variant.name} · {Number(variant.quantity ?? 0)} available
                            </span>
                          ))}
                          {variants.length > 3 && <span className="rounded-lg bg-[#ECE6E2] px-2.5 py-1.5 text-[10px] font-medium text-[#796E6B] sm:text-xs">+{variants.length - 3} variants</span>}
                        </div>
                      )}

                      <div className="mt-auto flex gap-2 border-t border-[#F0E9E6] pt-3">
                        <button
                          onClick={() => handleEditClick(product)}
                          className="min-h-11 flex-1 rounded-xl border border-[#E0D4CF] px-2 text-xs font-semibold text-[#514441] transition-colors hover:border-[#C98A84] hover:bg-[#F8EDEA] hover:text-[#A76560] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84] sm:px-3 sm:text-sm"
                        >
                          Edit recipe
                        </button>
                        <button
                          onClick={() => handleDeleteClick(product)}
                          disabled={isDeleting}
                          aria-label={`Delete ${product.product_name}`}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#E5C7C2] text-[#A76560] transition-colors hover:bg-[#F8EDEA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84] disabled:opacity-50"
                        >
                          {isDeleting ? <span className="text-xs">…</span> : <FiTrash2 aria-hidden="true" className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

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