"use client";

import { useEffect, useState } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { buildBarceloReceiptHtml } from "@/components/receipt/barcelo";
import { buildGoodcoffeeReceiptHtml } from "@/components/receipt/goodcoffee";
import LoadingPage from "@/components/LoadingPage";
import {
  FiShoppingCart,
  FiSearch,
  FiX,
  FiTrash2,
  FiPlus,
  FiMinus,
  FiMenu,
  FiPackage,
  FiCheckCircle,
  FiPrinter,
  FiCode,
} from "react-icons/fi";

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
  addOns: AddOn[];
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

export default function CustomerOrdering({ defaultShopId }: { defaultShopId?: string }) {
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState<string>("");
  const [shops, setShops] = useState<ShopInfo[]>([]);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, boolean>>({});
  // const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState("");
  const [receiptHtml, setReceiptHtml] = useState<string>("");
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

  // Initialize shop from route params
  useEffect(() => {
    if (defaultShopId) {
      setShopId(String(defaultShopId));
    }
  }, [defaultShopId]);

  // Load shops on mount
  useEffect(() => {
    const loadShops = async () => {
      try {
        const res = await fetch(api_links.tbl_shops);
        if (res.ok) {
          const data = await res.json();
          setShops(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error loading shops:", error);
      }
    };

    loadShops();
  }, []);

  // Load products when shop changes
  useEffect(() => {
    if (!shopId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Load shop info
        const shopRes = await fetch(`${api_links.tbl_shops}?id=${shopId}`);
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          setShopInfo(shopData);
        }

        // Load categories
        const categoriesRes = await fetch(`${api_links.tbl_category}?shop_id=${shopId}`);
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData || []);
        }

        // Load products
        const productsRes = await fetch(`${api_links.tbl_products}?shop_id=${shopId}`);
        if (productsRes.ok) {
          const productsData = await productsRes.json();
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
        }

        // Load add-ons
        const addOnsRes = await fetch(`${api_links.tbl_toppings}?shop_id=${shopId}`);
        if (addOnsRes.ok) {
          const addOnsData = await addOnsRes.json();
          const normalizedAddOns = Array.isArray(addOnsData) ? addOnsData : [];
          const filteredAddOns = normalizedAddOns.filter((addon) => {
            if (addon.shop_id === undefined || addon.shop_id === null) return true;
            return String(addon.shop_id) === String(shopId);
          });
          setAddOns(filteredAddOns);
        }

        setSelectedCategory("all");
        setSearchTerm("");
        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        showModal("error", "Load Error", "Failed to load products");
        setLoading(false);
      }
    };

    loadData();
  }, [shopId]);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem("customerCart", JSON.stringify(cart));
  }, [cart]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("customerCart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error("Error loading cart:", error);
      }
    }
  }, []);

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
      addOns: selectedAddOnsArray,
    };

    setCart([...cart, newItem]);
    setShowVariantModal(false);
    setSelectedProduct(null);
    setSelectedVariant(null);
    setSelectedAddOns({});
    showModal("success", "Added to Cart", `${product.product_name} added successfully!`);
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

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const addOnsPrice = item.addOns.reduce((acc, addon) => acc + (Number(addon.price) || 0), 0);
      return sum + (Number(item.price) + addOnsPrice) * item.quantity;
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
      showModal("error", "Name Required", "Please enter your name");
      return;
    }

    try {
      const total = calculateTotal();
      const orderPayload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        order_type: "dine-in",
        status: "pending",
        total,
        discount_type: "none",
        discount: 0,
        notes: notes || null,
        items: cart.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
          price: item.price,
          discount_type: "none",
          discount: 0,
          addOns: item.addOns,
        })),
        paid: total,
        change: 0,
      };

      const response = await fetch(api_links.tbl_orders, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-shop-id": shopId,
        },
        body: JSON.stringify(orderPayload),
      });

      const result = await response.json();

      console.log("Order response:", { status: response.status, result });

      if (!response.ok) {
        const errorMsg = result.message || result.error || "Failed to create order";
        console.error("Order error details:", errorMsg);
        throw new Error(errorMsg);
      }

      // Generate receipt
      const now = new Date();
      const formattedDate = now.toLocaleString();
      const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
      const receiptItems = cart.map((item) => ({
        productName: `${item.product_name} - ${item.variant_name}`,
        quantity: item.quantity,
        lineTotal: (Number(item.price) || 0) * item.quantity,
      }));

      const receiptData = {
        referenceNumber: String(result.order_id),
        shopName: shopInfo?.name || "Shop",
        customerName: customerName,
        orderType: "dine-in" as "dine-in" | "takeout",
        createdAt: formattedDate,
        subtotal: subtotal,
        discount: 0,
        total: calculateTotal(),
        paid: calculateTotal(),
        change: 0,
        items: receiptItems,
        receiptHeader: shopInfo?.receipt_header,
        receiptFooter: shopInfo?.receipt_footer,
      };

      // Choose receipt builder based on shop
      const receiptHtml =
        String(shopId) === "1"
          ? buildBarceloReceiptHtml(receiptData)
          : String(shopId) === "2"
            ? buildGoodcoffeeReceiptHtml(receiptData)
            : buildBarceloReceiptHtml(receiptData);

      setReceiptHtml(receiptHtml);
      setSubmittedOrderId(result.order_id);
      setOrderSubmitted(true);
      setCart([]);
      localStorage.removeItem("customerCart");
    } catch (error: any) {
      console.error("Checkout error:", error);
      showModal("error", "Order Failed", error.message || "Failed to submit order");
    }
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

  if (orderSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Receipt Display */}
          {receiptHtml && (
            <div className="mb-6">
              <iframe
                srcDoc={receiptHtml}
                className="w-full border-0"
                style={{ height: "600px" }}
                title="Order Receipt"
              />
            </div>
          )}

          {/* Confirmation Message */}
          <div className="p-8 text-center border-t">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}20` }}>
                <span style={{ color: brandColor, display: "inline-flex" }}>
                  <FiCheckCircle size={32} />
                </span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Order Placed!</h2>
            <p className="text-slate-600 mb-2">Your order number is:</p>
            <p className="text-3xl font-bold mb-6" style={{ color: brandColor }}>
              #{submittedOrderId}
            </p>
            <p className="text-sm text-slate-600 mb-8">
              📌 Show this receipt to the cashier when you're ready.
            </p>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 text-white font-bold py-3 rounded-lg transition-all"
                style={{ backgroundColor: brandColor }}
              >
                <FiPrinter size={20} />
                Print Receipt
              </button>
              <button
                onClick={() => {
                  setOrderSubmitted(false);
                  setSubmittedOrderId("");
                  setCustomerName("");
                  setCustomerPhone("");
                  setNotes("");
                  setReceiptHtml("");
                }}
                className="w-full text-white font-bold py-3 rounded-lg transition-all"
                style={{ backgroundColor: brandColor }}
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show QR code selection if no shop selected
  if (!shopId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">No Shop Selected</h1>
          <p className="text-slate-600">Please scan a QR code or use a shop link</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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

      {/* Top Bar with Shop Name & Search */}
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20 shadow-sm">
        {/* Shop Name & Cart Button */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-900">
            {shopInfo?.name || "Menu"}
          </h1>
          <button
            onClick={() => setCartOpen(!cartOpen)}
            className="p-2 relative"
            style={{ color: brandColor }}
          >
            <FiShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
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

        {/* Categories Horizontal Scroll */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
                selectedCategory === "all"
                  ? "text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
              style={selectedCategory === "all" ? { backgroundColor: brandColor } : undefined}
            >
              All ({products.length})
            </button>
            {categories.map((category) => {
              const count = products.filter((p) => p.category_id === category.id).length;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(String(category.id))}
                  className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap capitalize transition-all ${
                    selectedCategory === String(category.id)
                      ? "text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                  style={selectedCategory === String(category.id) ? { backgroundColor: brandColor } : undefined}
                >
                  {category.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Products Grid - Main Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
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
                <h2 className="text-lg font-bold text-slate-900 capitalize">{category.name}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {category.products.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((variant) => getVariantStock(variant) > 0);
                      return (
                        <div
                          key={product.id}
                          onClick={() => hasStock && handleProductClick(product)}
                          className={`bg-white rounded-lg border border-slate-200 overflow-hidden transition-all cursor-pointer ${
                            hasStock
                              ? "hover:border-blue-600 hover:shadow-md"
                              : "opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <div className="h-32 md:h-40 bg-slate-100 flex items-center justify-center overflow-hidden relative">
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
                                <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
                                  OUT OF STOCK
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-2 md:p-3">
                            <h3 className="font-bold text-slate-900 text-xs md:text-sm line-clamp-2 mb-1">
                              {product.product_name}
                            </h3>
                            {variants.length > 0 && (
                              <div>
                                {variants.length === 1 ? (
                                  <p className="font-bold text-sm md:text-base" style={{ color: brandColor }}>
                                    ₱{Number(variants[0].price).toFixed(2)}
                                  </p>
                                ) : (
                                  <p className="font-bold text-sm md:text-base" style={{ color: brandColor }}>
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
                  <h2 className="text-lg font-bold text-slate-900">Uncategorized</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {uncategorizedProducts.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((variant) => getVariantStock(variant) > 0);
                      return (
                        <div
                          key={product.id}
                          onClick={() => hasStock && handleProductClick(product)}
                          className={`bg-white rounded-lg border border-slate-200 overflow-hidden transition-all cursor-pointer ${
                            hasStock
                              ? "hover:border-blue-600 hover:shadow-md"
                              : "opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <div className="h-32 md:h-40 bg-slate-100 flex items-center justify-center overflow-hidden relative">
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
                                <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
                                  OUT OF STOCK
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-2 md:p-3">
                            <h3 className="font-bold text-slate-900 text-xs md:text-sm line-clamp-2 mb-1">
                              {product.product_name}
                            </h3>
                            {variants.length > 0 && (
                              <div>
                                {variants.length === 1 ? (
                                  <p className="font-bold text-sm md:text-base" style={{ color: brandColor }}>
                                    ₱{Number(variants[0].price).toFixed(2)}
                                  </p>
                                ) : (
                                  <p className="font-bold text-sm md:text-base" style={{ color: brandColor }}>
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

      {/* Sticky Cart Footer - Mobile Only */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full text-white font-bold py-3 px-4 flex items-center justify-between transition-all shadow-lg"
            style={{ backgroundColor: brandColor }}
          >
            <div className="flex items-center gap-2">
              <FiShoppingCart size={20} />
              <span>{cart.length} item{cart.length !== 1 ? "s" : ""}</span>
            </div>
            <span className="text-lg font-bold">₱{calculateTotal().toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart Modal */}
      {cartOpen && cart.length > 0 && (
        <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-2xl md:rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col md:rounded-xl">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FiShoppingCart size={20} />
                Your Cart
              </h2>
              <button
                onClick={() => setCartOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Cart Items */}
              <div className="space-y-3 mb-6">
                {cart.map((item) => (
                  <div key={item.id} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden p-3">
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
                        className="text-red-600 hover:bg-red-100 w-7 h-7 rounded flex items-center justify-center transition-all"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white rounded-lg p-1.5 mb-2">
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

                    <div className="bg-white rounded-lg p-2">
                      <p className="flex justify-between text-xs">
                        <span className="text-slate-600">Item Total:</span>
                        <span className="font-bold" style={{ color: brandColor }}>
                          ₱{((Number(item.price) + item.addOns.reduce((acc, a) => acc + (Number(a.price) || 0), 0)) * item.quantity).toFixed(2)}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Customer Info */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-6">
                <p className="text-sm font-bold text-slate-900 mb-3">📋 Your Information</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Your name..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Your phone number..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">📝 Notes (Optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g., No sugar, extra syrup..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none text-xs resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 border border-slate-200 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-bold">₱{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-slate-300 pt-2">
                  <span>Total:</span>
                  <span style={{ color: brandColor }}>₱{calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-white sticky bottom-0 space-y-3">
              <button
                onClick={() => setCartOpen(false)}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Continue Shopping
              </button>
              <button
                onClick={handleCheckout}
                disabled={!customerName.trim()}
                className="w-full text-white font-bold py-3 rounded-lg transition-all disabled:bg-slate-300 disabled:cursor-not-allowed"
                style={{
                  backgroundColor:
                    customerName.trim()
                      ? brandColor
                      : undefined,
                }}
              >
                Place Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variant Modal */}
      {showVariantModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
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

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2 mb-6">
                {getProductVariants(selectedProduct).map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant)}
                    disabled={getVariantStock(variant) === 0}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedVariant?.id === variant.id
                        ? "border-blue-600 bg-blue-50"
                        : getVariantStock(variant) === 0
                          ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed"
                          : "bg-white border-slate-300 hover:border-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-slate-900">{variant.name}</p>
                      <p className="font-bold" style={{ color: brandColor }}>
                        ₱{Number(variant.price).toFixed(2)}
                      </p>
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
                        <p className="text-sm font-semibold" style={{ color: brandColor }}>
                          +₱{Number(addon.price).toFixed(2)}
                        </p>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="border-t border-slate-200 p-6 bg-white flex gap-3">
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
                    .map(([addonId]) => addOns.find((a) => a.id === addonId))
                    .filter((addon): addon is AddOn => Boolean(addon));

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

      {/* Add bottom padding to prevent content from hiding under sticky footer */}
      {cart.length > 0 && <div className="md:hidden h-16" />}
    </div>
  );
}
