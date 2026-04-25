"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import AddProduct from "./partial/add";
import EditProduct from "./partial/edit";
import { CategoryForm } from "@/components/category";
import { Product } from "@/types/products";

interface ProductsPageProps {
  shopId?: string;
}

export default function ProductsPage({ shopId = "1" }: ProductsPageProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "delete">("create");
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [productImages, setProductImages] = useState<Record<number, string>>({});

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await Fetch_to(
        `${api_links.tbl_products}?shop_id=${shopId}`,
        {},
        {},
        3,
        1000,
        "GET"
      );

      if (response.success && response.data) {
        setProducts(Array.isArray(response.data) ? response.data : []);
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

  // Load images from localStorage after products fetch
  useEffect(() => {
    if (products.length > 0 && typeof window !== "undefined") {
      const images: Record<number, string> = {};
      products.forEach((product) => {
        const storedImage = localStorage.getItem(`product_image_${product.id}`);
        if (storedImage) {
          images[Number(product.id)] = storedImage;
        }
      });
      setProductImages(images);
    }
  }, [products]);

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

  const handleDeleteClick = (product: Product) => {
    setFormMode("delete");
    setSelectedProduct(product);
    setShowForm(true);
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

  const handleCategoryFormSuccess = () => {
    setShowAddCategoryModal(false);
    fetchCategories();
  };

  const handleCategoryFormCancel = () => {
    setShowAddCategoryModal(false);
  };

  const filteredProducts = products.filter((p) =>
    p.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryName = (categoryId: any) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Unknown";
  };

  const getCategoryColor = (categoryId: any) => {
    const colors: any = {
      1: "bg-purple-600",
      2: "bg-blue-600",
      3: "bg-green-600",
      4: "bg-orange-600",
      5: "bg-pink-600",
    };
    return colors[categoryId] || "bg-slate-600";
  };

  const productsByCategory = () => {
    if (selectedCategory === "all") {
      return categories.map((category) => ({
        category,
        products: filteredProducts.filter((p) => p.category_id === category.id),
      }));
    } else {
      const category = categories.find((c) => c.id === Number(selectedCategory));
      if (!category) return [];
      return [
        {
          category,
          products: filteredProducts.filter((p) => p.category_id === category.id),
        },
      ];
    }
  };

  const groupedProducts = productsByCategory();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#073dbe] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Show Form as Full Page */}
      {showForm && formMode === "create" && (
        <AddProduct
          shopId={shopId}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {showForm && formMode === "edit" && selectedProduct?.id && (
        <EditProduct
          productId={selectedProduct.id}
          shopId={shopId}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {/* Show Product List */}
      {!showForm && (
        <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
                Product Management
              </h1>
              <p className="text-slate-600 mt-1 text-sm">
                Manage your menu items and variants ({products.length} total)
              </p>
            </div>
            <div className="flex gap-2 w-full lg:w-auto">
              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm"
              >
                Add Category
              </button>
              <button
                onClick={handleCreateClick}
                className="bg-[#073dbe] hover:bg-[#052d99] text-white px-5 py-2.5 rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm"
              >
                Add Product
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Filter by Category</h3>
            <span className="text-xs text-slate-600">
              <span className="font-semibold text-[#073dbe]">{filteredProducts.length}</span> products
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-lg border transition-all whitespace-nowrap flex items-center gap-2 shrink-0 text-sm font-medium ${
                selectedCategory === "all"
                  ? "bg-[#073dbe] border-[#073dbe] text-white"
                  : "bg-white border-slate-200 hover:border-[#073dbe] text-slate-700"
              }`}
            >
              <span>All</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedCategory === "all"
                    ? "bg-white/20"
                    : "bg-blue-100 text-[#073dbe]"
                }`}
              >
                {products.length}
              </span>
            </button>

            {categories.map((category) => {
              const count = products.filter(
                (p) => p.category_id === category.id
              ).length;

              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id.toString())}
                  className={`px-4 py-2 rounded-lg border transition-all whitespace-nowrap flex items-center gap-2 shrink-0 text-sm font-medium ${
                    selectedCategory === category.id.toString()
                      ? `${getCategoryColor(category.id)} border-transparent text-white`
                      : "bg-white border-slate-200 hover:border-[#073dbe] text-slate-700"
                  }`}
                >
                  <span>{category.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      selectedCategory === category.id.toString()
                        ? "bg-white/20"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              No Products Found
            </h3>
            <p className="text-slate-600 text-sm mb-6">
              {searchQuery
                ? "Try adjusting your search"
                : "Start by adding your first product"}
            </p>
            <button
              onClick={handleCreateClick}
              className="inline-flex items-center gap-2 bg-[#073dbe] hover:bg-[#052d99] text-white px-5 py-2.5 rounded-lg transition-all font-medium text-sm"
            >
              Add Product
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedProducts.map(({ category, products: categoryProducts }) => (
              <div key={category.id}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${getCategoryColor(
                      category.id
                    )} w-1 h-6 rounded-full`}
                  ></div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {category.name}
                  </h2>
                  <span className="text-sm text-slate-500">
                    ({categoryProducts.length})
                  </span>
                </div>

                {categoryProducts.length === 0 ? (
                  <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
                    <p className="text-slate-500 text-sm">
                      No products in this category yet
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {categoryProducts.map((p) => {
                      const totalQuantity =
                        p.variants?.reduce(
                          (sum, v) => sum + (Number(v.price) || 0),
                          0
                        ) || 0;

                      return (
                        <div
                          key={p.id}
                          className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-all overflow-hidden flex flex-col"
                        >
                          <div className="relative h-44 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                            {productImages[Number(p.id)] ? (
                              <img
                                src={productImages[Number(p.id)]}
                                alt={p.product_name}
                                className="h-full w-full object-cover hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="text-slate-400 text-center p-4">
                                <span className="text-xs">No image</span>
                              </div>
                            )}

                            <div className="absolute top-2 right-2">
                              <span
                                className={`${getCategoryColor(
                                  p.category_id
                                )} text-white text-xs font-medium px-2.5 py-1 rounded-full`}
                              >
                                {getCategoryName(p.category_id)}
                              </span>
                            </div>
                          </div>

                          <div className="p-4 flex-1 flex flex-col">
                            <h2 className="text-base font-bold text-slate-900 mb-2 line-clamp-1">
                              {p.product_name}
                            </h2>

                            <p className="text-sm text-slate-600 mb-3 line-clamp-2 flex-1">
                              {p.product_description || "No description available"}
                            </p>

                            {p.variants && p.variants.length > 0 && (
                              <div className="mb-4 space-y-2">
                                <h3 className="font-semibold text-xs text-slate-700 flex items-center gap-2">
                                  <span className="w-1 h-3 bg-[#073dbe] rounded"></span>
                                  Variants ({p.variants.length})
                                </h3>
                                <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                  {p.variants.map((v) => (
                                    <div
                                      key={v.id}
                                      className="bg-slate-50 rounded-lg p-2.5 border border-slate-200"
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <span className="font-medium text-slate-900 text-sm">
                                            {v.name}
                                          </span>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-[#073dbe] font-bold text-sm">
                                            ₱{Number(v.price).toFixed(2)}
                                          </div>
                                          {v.calculated_cost && (
                                            <div className="text-xs text-slate-600 mt-1">
                                              Cost: ₱
                                              {Number(
                                                v.calculated_cost
                                              ).toFixed(2)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2 mt-auto pt-3 border-t border-slate-200">
                              <button
                                onClick={() => handleEditClick(p)}
                                className="flex-1 bg-[#073dbe] hover:bg-[#052d99] text-white py-2 rounded-lg transition-all font-medium flex items-center justify-center gap-1.5 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteClick(p)}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-all font-medium flex items-center justify-center gap-1.5 text-sm"
                              >
                                Delete
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
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <CategoryForm
          shopId={shopId}
          onSuccess={handleCategoryFormSuccess}
          onCancel={handleCategoryFormCancel}
        />
      )}

      <style>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </>
  );
}
