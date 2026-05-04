"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { FiShoppingCart, FiSearch, FiX, FiTrash2, FiPlus, FiMinus, FiArrowLeft, FiPackage } from "react-icons/fi";
import { buildBarceloReceiptHtml } from "@/components/receipt/barcelo";
import { buildGoodcoffeeReceiptHtml } from "@/components/receipt/goodcoffee";

interface CashierUser {
  id: string;
  name: string;
  role: string;
  first_name: string;
  last_name: string;
  shop_id: string;
}

interface Product {
  id: string;
  product_name: string;
  category_id: string;
  product_description?: string;
  image?: string;
  is_deleted?: boolean | number | string | null;
  tbl_product_variants?: Variant[];
  variants?: Variant[];
}

interface Variant {
  id: string;
  name: string;
  price: number;
  calculated_cost: number;
  calculated_stock?: number;
  quantity?: number;
}

interface AddOn {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  shop_id?: string | number;
}

interface ShopInfo {
  id: string;
  name: string;
  brand_color: string;
  receipt_header?: string;
  receipt_footer?: string;
}

interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  variant_id: string;
  variant_name: string;
  price: number;
  quantity: number;
  discount_type: "none" | "senior" | "pwd" | null;
  discount: number;
  addOns: AddOn[];
  orderType: "dine-in" | "takeout";
}

interface Category {
  id: string;
  name: string;
}

interface Modal {
  isOpen: boolean;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  onConfirm?: () => void;
}

export default function CashierDisplay() {
  const router = useRouter();
  const [userData, setUserData] = useState<CashierUser | null>(null);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [orderType, setOrderType] = useState<"dine-in" | "takeout">("dine-in");
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, boolean>>({});
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });
  const brandColor = shopInfo?.brand_color || "#073dbe";

  const getProductVariants = (product: Product) => product.tbl_product_variants || product.variants || [];

  const getVariantStock = (variant: Variant) => Number(variant.calculated_stock ?? variant.quantity ?? 0);

  const isProductDeleted = (product: Product) => {
    return product.is_deleted === true || product.is_deleted === 1 || product.is_deleted === "1" || product.is_deleted === "true";
  };

  const showModal = (type: Modal["type"], title: string, message: string, onConfirm?: () => void) => {
    setModal({ isOpen: true, type, title, message, onConfirm });
  };

  const handleLogout = async () => {
    try {
      await Fetch_to(api_links.jwt.deauth);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("user");
      localStorage.removeItem("shopId");
      router.push("/");
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    console.log("Stored user from localStorage:", storedUser);
    if (!storedUser || storedUser === "undefined") {
      router.push("/");
      return;
    }

    try {
      const user = JSON.parse(storedUser) as CashierUser;
      console.log("Parsed user object:", user);
      console.log("Shop ID from user:", user.shop_id, "Type:", typeof user.shop_id);
      if (user.role !== "cashier" && user.role !== "admin") {
        router.push("/");
        return;
      }
      setUserData(user);
    } catch (error) {
      console.error("Failed to parse user data:", error);
      localStorage.removeItem("user");
      router.push("/");
    }
  }, [router]);

  // Load products, categories, and add-ons
  useEffect(() => {
    if (!userData) return;

    const loadData = async () => {
      try {
        // Debug: Log shop_id
        console.log("User data:", userData);
        console.log("Shop ID being sent:", userData.shop_id);
        
        // Load shop info for brand color and receipt data
        const shopRes = await fetch(`${api_links.tbl_shops}?id=${userData.shop_id}`);
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          setShopInfo(shopData);
        }

        // Load categories
        const categoriesRes = await fetch(`${api_links.tbl_category}?shop_id=${userData.shop_id}`);
        if (!categoriesRes.ok) {
          const errorText = await categoriesRes.text();
          throw new Error(`Failed to load categories: ${categoriesRes.status} - ${errorText.substring(0, 100)}`);
        }
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData || []);

        // Load products (now includes calculated variants with stock)
        const productsRes = await fetch(`${api_links.tbl_products}?shop_id=${userData.shop_id}`);
        if (!productsRes.ok) {
          const errorText = await productsRes.text();
          throw new Error(`Failed to load products: ${productsRes.status} - ${errorText.substring(0, 100)}`);
        }
        const productsData = await productsRes.json();
        console.log("Products from API:", productsData); // Debug log
        const normalizedProducts = Array.isArray(productsData)
          ? productsData
          : Array.isArray(productsData?.products)
            ? productsData.products
            : [];
        setProducts(
          normalizedProducts
            .filter((product: Product) => !isProductDeleted(product))
            .map((product: Product) => ({
              ...product,
              tbl_product_variants: product.tbl_product_variants || product.variants || [],
            }))
        );

        // Load add-ons
        const addOnsRes = await fetch(`${api_links.tbl_toppings}?shop_id=${userData.shop_id}`);
        if (!addOnsRes.ok) {
          const errorText = await addOnsRes.text();
          console.warn(`Failed to load add-ons: ${addOnsRes.status}`);
        } else {
          const addOnsData = await addOnsRes.json();
          const normalizedAddOns = Array.isArray(addOnsData) ? addOnsData : [];
          const filteredAddOns = normalizedAddOns.filter((addon) => {
            if (addon.shop_id === undefined || addon.shop_id === null) return true;
            return String(addon.shop_id) === String(userData.shop_id);
          });
          setAddOns(filteredAddOns);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        showModal("error", "Load Error", error instanceof Error ? error.message : "Failed to load products and categories");
        setLoading(false);
      }
    };

    loadData();
  }, [userData]);

  const handleProductClick = (product: Product) => {
    const hasStock = getProductVariants(product).some((variant) => getVariantStock(variant) > 0);
    if (!hasStock) {
      showModal("error", "Out of Stock", `${product.product_name} is out of stock!`);
      return;
    }

    const variants = getProductVariants(product);

    if (variants.length === 1) {
      addToCart(product, variants[0], []);
    } else {
      setSelectedProduct(product);
      setSelectedVariant(null);
      setSelectedAddOns({});
      setShowVariantModal(true);
    }
  };

  const addToCart = (product: Product, variant: Variant, selectedAddOnsArray: AddOn[]) => {
    const newItem: CartItem = {
      id: `${Date.now()}-${Math.random()}`,
      product_id: product.id,
      product_name: product.product_name,
      variant_id: variant.id,
      variant_name: variant.name,
      price: variant.price,
      quantity: 1,
      discount_type: null,
      discount: 0,
      addOns: selectedAddOnsArray,
      orderType,
    };

    setCart([...cart, newItem]);
    setShowVariantModal(false);
    setSelectedProduct(null);
    setSelectedVariant(null);
    setSelectedAddOns({});
  };

  const updateQuantity = (itemId: string, change: number) => {
    setCart(
      cart.map((item) => {
        if (item.id === itemId) {
          const newQty = Math.max(1, item.quantity + change);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((item) => item.id !== itemId));
  };

  const updateItemDiscount = (itemId: string, discountType: "none" | "senior" | "pwd") => {
    setCart(
      cart.map((item) => {
        if (item.id === itemId) {
          const discountAmount = discountType === "none" ? 0 : 5;
          return {
            ...item,
            discount_type: discountType,
            discount: discountAmount,
          };
        }
        return item;
      })
    );
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const itemPrice = item.price - (item.discount || 0);
      const addOnsPrice = item.addOns.reduce((acc, addon) => acc + addon.price, 0);
      return sum + (itemPrice + addOnsPrice) * item.quantity;
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal();
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showModal("error", "Empty Cart", "Please add items to cart");
      return;
    }

    if (!customerName.trim()) {
      showModal("error", "Customer Name Required", "Please enter customer name");
      return;
    }

    try {
      const total = calculateTotal();
      const orderPayload = {
        cashier_id: userData?.id,
        order_type: orderType,
        status: "pending",
        total,
        discount_type: "per-item",
        discount: cart.reduce((sum, item) => sum + (item.discount || 0), 0),
        customer_name: customerName.trim(),
        notes: notes || null,
        items: cart.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
          price: item.price,
          discount_type: item.discount_type,
          discount: item.discount,
          addOns: item.addOns,
        })),
        paid: amountPaid ? Number(amountPaid) : total,
        change: amountPaid ? Number(amountPaid) - total : 0,
      };

      const response = await fetch(api_links.tbl_orders, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-shop-id": userData?.shop_id || "",
        },
        body: JSON.stringify(orderPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to create order");
      }

      showModal("success", "Order Created", `Order #${result.order_id} sent to kitchen!`, () => {
        printReceipt(result.order_id, {
          order_type: orderType,
          total,
          discount: cart.reduce((sum, item) => sum + (item.discount || 0), 0),
          paid: amountPaid ? Number(amountPaid) : total,
          change: amountPaid ? Number(amountPaid) - total : 0,
        });

        setCart([]);
        setAmountPaid("");
        setCustomerName("");
        setNotes("");
      });
    } catch (error: any) {
      console.error("Checkout error:", error);
      showModal("error", "Checkout Failed", error.message || "Failed to create order");
    }
  };

  const printReceipt = (orderId: string, orderData: any) => {
    const receiptWindow = window.open("", "_blank", "height=600,width=400");
    if (!receiptWindow) {
      showModal("error", "Popup Blocked", "Please allow popups to print receipt.");
      return;
    }

    const subtotal = calculateSubtotal();
    const discount = cart.reduce((sum, item) => sum + (item.discount || 0), 0);

    const resolvedShopId = String(shopInfo?.id || userData?.shop_id || "1");
    const resolvedShopName = shopInfo?.name || localStorage.getItem("shopName") || (resolvedShopId === "2" ? "Good Coffee" : "Barcelo");
    const referencePrefix = resolvedShopId === "2" ? "GCF" : "BAR";
    const referenceNumber = `${referencePrefix}-${String(orderId).padStart(6, "0")}`;
    const receiptData = {
      referenceNumber,
      shopName: resolvedShopName,
      customerName: customerName || "Walk-in",
      orderType: orderData.order_type as "dine-in" | "takeout",
      createdAt: new Date().toLocaleString(),
      subtotal,
      discount,
      total: Number(orderData.total) || 0,
      paid: Number(orderData.paid) || 0,
      change: Number(orderData.change) || 0,
      receiptHeader: shopInfo?.receipt_header,
      receiptFooter: shopInfo?.receipt_footer,
      items: cart.map((item) => ({
        productName: item.product_name,
        quantity: item.quantity,
        lineTotal: (item.price - (item.discount || 0)) * item.quantity,
      })),
    };

    const receiptHtml = resolvedShopId === "2"
      ? buildGoodcoffeeReceiptHtml(receiptData)
      : buildBarceloReceiptHtml(receiptData);

    receiptWindow.document.write(receiptHtml);

    receiptWindow.document.close();
    setTimeout(() => {
      receiptWindow.print();
    }, 250);
  };

  const visibleProducts = products.filter((product) => !isProductDeleted(product));

  const filteredProducts = visibleProducts.filter((product) => {
    const matchesSearch = product.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || String(product.category_id) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedProducts = categories
    .map((category) => ({
      ...category,
      products: filteredProducts.filter((product) => String(product.category_id) === String(category.id)),
    }))
    .filter((category) => category.products.length > 0);

  const uncategorizedProducts = filteredProducts.filter(
    (product) => !categories.some((category) => String(category.id) === String(product.category_id))
  );

  // Helper function to build category button classes
  const getCategoryButtonClass = (categoryId: string) => {
    const isSelected = selectedCategory === categoryId;
    return isSelected
      ? "text-white"
      : "bg-slate-100 hover:bg-slate-200 text-slate-700";
  };

  const getCategoryButtonStyle = (categoryId: string) => {
    return selectedCategory === categoryId
      ? { backgroundColor: brandColor }
      : undefined;
  };

  // Helper function to build product card classes
  const getProductCardClass = (hasStock: boolean) => {
    return hasStock
      ? "hover:border-blue-600 hover:shadow-md"
      : "opacity-50 cursor-not-allowed";
  };

  // Helper function to build variant button classes
  const getVariantButtonClass = (isSelected: boolean, isOutOfStock: boolean) => {
    if (isSelected) return "border-blue-600 bg-blue-50";
    if (isOutOfStock) return "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed";
    return "bg-white border-slate-300 hover:border-blue-600 hover:bg-blue-50";
  };

  if (loading || !userData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading cashier interface...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-50 overflow-hidden">
      {/* Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold text-slate-900 mb-2">{modal.title}</h2>
            <p className="text-slate-600 mb-6">{modal.message}</p>
            <button
              onClick={() => {
                setModal({ ...modal, isOpen: false });
                modal.onConfirm?.();
              }}
              className="w-full text-white font-semibold py-2 px-4 rounded"
              style={{ backgroundColor: brandColor }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Categories Sidebar */}
      <div className="w-full lg:w-60 bg-white border-b lg:border-r border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 text-white" style={{ backgroundColor: brandColor }}>
          <h2 className="text-lg font-bold mb-1">Categories</h2>
          <p className="text-blue-100 text-xs">Browse menu</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium text-sm ${getCategoryButtonClass("all")}`}
            style={getCategoryButtonStyle("all")}
          >
            All Products ({products.length})
          </button>

          {categories.map((category) => {
            const count = products.filter((p) => p.category_id === category.id).length;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(String(category.id))}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all font-medium capitalize text-sm ${getCategoryButtonClass(String(category.id))}`}
                style={getCategoryButtonStyle(String(category.id))}
              >
                {category.name} ({count})
              </button>
            );
          })}
        </div>

        <div className="p-3 bg-white border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-all font-medium text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Products Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-slate-200 p-4">
          <div className="mb-3">
            <h1 className="text-2xl font-bold text-slate-900">Menu</h1>
            <p className="text-slate-600 text-sm">Select products to add to cart</p>
          </div>

          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <FiSearch size={18} />
            </div>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
              <div className="text-slate-400 text-4xl mx-auto mb-3 flex justify-center">
                <FiPackage />
              </div>
              <p className="text-lg text-slate-900 font-bold">No products found</p>
              <p className="text-slate-500 text-sm">Try a different search term or category</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedProducts.map((category) => (
                <section key={category.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 capitalize">{category.name}</h2>
                    <span className="text-xs font-semibold text-slate-500">{category.products.length} items</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {category.products.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((variant) => getVariantStock(variant) > 0);
                      return (
                        <div
                          key={product.id}
                          onClick={() => hasStock && handleProductClick(product)}
                          className={`bg-white rounded-lg border border-slate-200 overflow-hidden transition-all cursor-pointer ${getProductCardClass(hasStock || false)}`}
                        >
                          <div className="h-40 bg-slate-100 flex items-center justify-center overflow-hidden relative">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.product_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="text-slate-400 text-3xl">
                                <FiPackage />
                              </div>
                            )}
                            {!hasStock && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">
                                  OUT OF STOCK
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="font-bold text-slate-900 text-sm line-clamp-2 mb-2">{product.product_name}</h3>
                            {variants.length > 0 && (
                              <div>
                                {variants.length === 1 ? (
                                  <p className="font-bold" style={{ color: brandColor }}>₱{Number(variants[0].price).toFixed(2)}</p>
                                ) : (
                                  <p className="font-bold" style={{ color: brandColor }}>
                                    From ₱{Math.min(...variants.map((v) => Number(v.price))).toFixed(2)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

              {uncategorizedProducts.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">Uncategorized</h2>
                    <span className="text-xs font-semibold text-slate-500">{uncategorizedProducts.length} items</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {uncategorizedProducts.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((variant) => getVariantStock(variant) > 0);
                      return (
                        <div
                          key={product.id}
                          onClick={() => hasStock && handleProductClick(product)}
                          className={`bg-white rounded-lg border border-slate-200 overflow-hidden transition-all cursor-pointer ${getProductCardClass(hasStock || false)}`}
                        >
                          <div className="h-40 bg-slate-100 flex items-center justify-center overflow-hidden relative">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.product_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="text-slate-400 text-3xl">
                                <FiPackage />
                              </div>
                            )}
                            {!hasStock && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">
                                  OUT OF STOCK
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="font-bold text-slate-900 text-sm line-clamp-2 mb-2">{product.product_name}</h3>
                            {variants.length > 0 && (
                              <div>
                                {variants.length === 1 ? (
                                  <p className="font-bold" style={{ color: brandColor }}>₱{Number(variants[0].price).toFixed(2)}</p>
                                ) : (
                                  <p className="font-bold" style={{ color: brandColor }}>
                                    From ₱{Math.min(...variants.map((v) => Number(v.price))).toFixed(2)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Variant Modal */}
      {showVariantModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedProduct.product_name}</h3>
                <p className="text-slate-600 text-sm">Select a variant</p>
              </div>
              <button
                onClick={() => {
                  setShowVariantModal(false);
                  setSelectedProduct(null);
                  setSelectedVariant(null);
                  setSelectedAddOns({});
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="space-y-2 mb-6">
              {getProductVariants(selectedProduct).map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant)}
                  disabled={getVariantStock(variant) === 0}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${getVariantButtonClass(
                    selectedVariant?.id === variant.id,
                    getVariantStock(variant) === 0
                  )}`}
                >
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-slate-900">{variant.name}</p>
                    <p className="font-bold" style={{ color: brandColor }}>₱{Number(variant.price).toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Add-ons Selection */}
            {addOns.length > 0 && (
              <div className="mb-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-900 mb-3">Add-Ons (Optional)</h4>
                <div className="space-y-2">
                  {addOns.map((addon) => (
                    <label
                      key={addon.id}
                      className="flex items-center gap-3 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAddOns[addon.id] || false}
                        onChange={(e) => {
                          setSelectedAddOns((prev) => ({
                            ...prev,
                            [addon.id]: e.target.checked,
                          }));
                        }}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{addon.name}</p>
                        <p className="text-xs text-slate-500">{addon.quantity} {addon.unit}</p>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: brandColor }}>+₱{Number(addon.price).toFixed(2)}</p>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-6 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowVariantModal(false);
                  setSelectedProduct(null);
                  setSelectedVariant(null);
                  setSelectedAddOns({});
                }}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!selectedVariant) {
                    showModal("error", "Select Variant", "Please select a variant first");
                    return;
                  }

                  const selectedAddOnsArray = Object.entries(selectedAddOns)
                    .filter(([_, selected]) => selected)
                    .map(([addonId]) => {
                      const addon = addOns.find((a) => a.id === addonId);
                      return addon!;
                    });

                  addToCart(selectedProduct, selectedVariant, selectedAddOnsArray);
                }}
                className="flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium"
                style={{ backgroundColor: brandColor }}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 text-white" style={{ backgroundColor: brandColor }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FiShoppingCart size={18} />
                Cart
              </h2>
              <p className="text-blue-100 text-xs">{cart.length} items</p>
            </div>
          </div>

          {/* Customer Name Input */}
          <div className="mb-3">
            <label className="block text-xs font-bold text-blue-100 mb-1">
              Customer Name <span className="text-red-300">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name..."
              className="w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder-blue-200 focus:outline-none text-sm"
            />
          </div>

          {/* Special Requests */}
          <div>
            <label className="block text-xs font-bold text-blue-100 mb-1">Special Requests (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., No sugar, extra syrup..."
              className="w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder-blue-200 focus:outline-none text-sm resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-12 h-12 text-slate-300 mx-auto mb-3 flex justify-center">
                <FiShoppingCart size={24} />
              </div>
              <p className="text-base font-bold text-slate-600">Cart is empty</p>
              <p className="text-slate-400 text-xs">Add products to get started</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {cart.map((item) => (
                  <div key={item.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 text-sm">{item.product_name}</h4>
                          <p className="text-xs text-slate-600">{item.variant_name}</p>
                          {item.addOns.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {item.addOns.map((addon) => (
                                <p key={addon.id} className="text-xs text-orange-600">
                                  + {addon.name}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-600 hover:bg-red-600 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-all"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1.5 mb-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded flex items-center justify-center text-sm"
                        >
                          <FiMinus size={12} />
                        </button>
                        <span className="font-bold text-slate-800 flex-1 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="bg-green-600 hover:bg-green-700 text-white w-6 h-6 rounded flex items-center justify-center text-sm"
                        >
                          <FiPlus size={12} />
                        </button>
                      </div>

                      <div className="bg-slate-50 rounded-lg p-2 mb-2">
                        <p className="flex justify-between text-xs">
                          <span className="text-slate-600">Item Total:</span>
                          <span className="font-bold" style={{ color: brandColor }}>
                            ₱{((item.price - (item.discount || 0)) * item.quantity).toFixed(2)}
                          </span>
                        </p>
                      </div>

                      <button
                        onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                        className="w-full text-center text-xs font-bold hover:underline"
                        style={{ color: brandColor }}
                      >
                        {expandedItem === item.id ? "Hide Options" : "More Options"}
                      </button>
                    </div>

                    {expandedItem === item.id && (
                      <div className="border-t border-slate-200 bg-slate-50 p-3 space-y-3">
                        {/* Order Type */}
                        <div>
                          <p className="text-xs font-bold text-slate-800 mb-2">Order Type</p>
                          <div className="space-y-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`orderType-${item.id}`}
                                checked={item.orderType === "dine-in"}
                                onChange={() => {
                                  setCart(
                                    cart.map((i) => (i.id === item.id ? { ...i, orderType: "dine-in" } : i))
                                  );
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-xs text-slate-700">Dine In</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`orderType-${item.id}`}
                                checked={item.orderType === "takeout"}
                                onChange={() => {
                                  setCart(cart.map((i) => (i.id === item.id ? { ...i, orderType: "takeout" } : i)));
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-xs text-slate-700">Takeout</span>
                            </label>
                          </div>
                        </div>

                        {/* Discount */}
                        <div className="bg-white rounded-lg p-2 border border-amber-200">
                          <p className="text-xs font-bold text-slate-800 mb-2">Item Discount</p>
                          <div className="space-y-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`discount-${item.id}`}
                                checked={item.discount_type === "none" || !item.discount_type}
                                onChange={() => updateItemDiscount(item.id, "none")}
                                className="w-4 h-4"
                              />
                              <span className="text-xs text-slate-700">No Discount</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`discount-${item.id}`}
                                checked={item.discount_type === "senior"}
                                onChange={() => updateItemDiscount(item.id, "senior")}
                                className="w-4 h-4"
                              />
                              <span className="text-xs text-slate-700">Senior Citizen (-₱5)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`discount-${item.id}`}
                                checked={item.discount_type === "pwd"}
                                onChange={() => updateItemDiscount(item.id, "pwd")}
                                className="w-4 h-4"
                              />
                              <span className="text-xs text-slate-700">PWD (-₱5)</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2 mb-3 border border-slate-200">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-bold">₱{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-slate-300 pt-2">
                  <span>Total:</span>
                  <span style={{ color: brandColor }}>₱{calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Input */}
              <div className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-200">
                <label className="block font-bold text-slate-800 text-sm mb-2">Amount Paid</label>
                <input
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Enter amount..."
                  className="w-full px-3 py-2 rounded-lg border border-blue-300 focus:outline-none text-lg font-bold"
                  style={{ borderColor: brandColor }}
                />
                {amountPaid && !isNaN(parseFloat(amountPaid)) && (
                  <div
                    className={`mt-2 p-2 rounded-lg text-white font-bold flex justify-between text-sm ${
                      parseFloat(amountPaid) >= calculateTotal() ? "bg-green-600" : "bg-red-600"
                    }`}
                  >
                    <span>{parseFloat(amountPaid) >= calculateTotal() ? "Change:" : "Need more:"}</span>
                    <span>₱{Math.abs(parseFloat(amountPaid) - calculateTotal()).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Checkout */}
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || !customerName.trim()}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-lg transition-all disabled:cursor-not-allowed"
              >
                Checkout
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
