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
      const addOnsPrice = item.addOns.reduce((acc, addon) => acc + (Number(addon?.price) || 0), 0);
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
        customer_phone: customerPhone ? parseInt(customerPhone, 10) : null,
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
      <div className="min-h-screen bg-slate-50 pb-20">
        <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm">
          {receiptHtml && (
            <div className="p-4">
              <iframe
                srcDoc={receiptHtml}
                className="w-full border-0 bg-white rounded-lg shadow-sm overflow-hidden"
                style={{ height: "600px" }}
                title="Order Receipt"
              />
            </div>
          )}

          <div className="p-6 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${brandColor}20` }}
            >
              <span style={{ color: brandColor, display: "inline-flex" }}>
                <FiCheckCircle size={32} />
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Order Placed!</h2>
            <p className="text-slate-500 mb-2">Your order number is:</p>
            <p className="text-3xl font-bold mb-6" style={{ color: brandColor }}>
              {submittedOrderId}
            </p>
            <p className="text-sm text-slate-500 mb-8">
              Show this receipt to the cashier when you are ready.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => window.print()}
                className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 rounded-lg transition-all"
                style={{ backgroundColor: brandColor }}
              >
                <FiPrinter size={20} /> Print Receipt
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
                className="w-full text-slate-600 font-bold py-3 rounded-lg transition-all bg-slate-100 hover:bg-slate-200"
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
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm relative">
        {modal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
              <h3 className="text-lg font-bold mb-2 text-slate-800">{modal.title}</h3>
              <p className="text-slate-600 mb-6">{modal.message}</p>
              <button
                onClick={() => {
                  setModal({ ...modal, isOpen: false });
                  modal.onConfirm?.();
                }}
                className="w-full text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                style={{ backgroundColor: brandColor }}
              >
                OK
              </button>
            </div>
          </div>
        )}

        <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-xl font-bold text-slate-800">{shopInfo?.name || "Menu"}</h1>
            <button
              onClick={() => setCartOpen(true)}
              className="p-2 relative rounded-full hover:bg-slate-100 transition-colors"
              style={{ color: brandColor }}
            >
              <FiShoppingCart size={24} />
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {cart.length}
                </span>
              )}
            </button>
          </div>

          <div className="px-4 pb-4">
            <div className="relative">
              <FiSearch
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-xl border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-sm"
              />
            </div>
          </div>

          <div className="px-4 pb-4 overflow-x-auto flex gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${selectedCategory === "all" ? "text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
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
                  className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${selectedCategory === String(category.id) ? "text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  style={selectedCategory === String(category.id) ? { backgroundColor: brandColor } : undefined}
                >
                  {category.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-6">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <FiPackage className="mx-auto text-slate-300 mb-3" size={48} />
              <p className="text-slate-500 font-medium">No products found</p>
              <p className="text-slate-400 text-sm">Try a different search term or category</p>
            </div>
          ) : (
            <>
              {groupedProducts.map((category) => (
                <div key={category.id}>
                  <h2 className="text-lg font-bold text-slate-800 mb-3">{category.name}</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {category.products.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((v) => getVariantStock(v) > 0);
                      const minPrice = Math.min(...variants.map((v) => Number(v.price)));
                      return (
                        <div
                          key={product.id}
                          onClick={() => hasStock && handleProductClick(product)}
                          className={`bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-all flex flex-col ${hasStock ? "cursor-pointer hover:shadow-md hover:border-blue-200 active:scale-[0.98]" : "opacity-60 cursor-not-allowed grayscale-[0.5]"}`}
                        >
                          <div className="h-28 sm:h-32 md:h-36 bg-slate-100 relative shrink-0">
                            {product.image ? (
                              <img src={product.image} alt={product.product_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <FiPackage size={32} />
                              </div>
                            )}
                            {!hasStock && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                                  SOLD OUT
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-2.5 flex-1 flex flex-col justify-between">
                            <h3 className="font-semibold text-slate-800 text-xs sm:text-sm leading-tight line-clamp-2 mb-1.5">
                              {product.product_name}
                            </h3>
                            <p className="font-bold text-xs sm:text-sm mt-auto" style={{ color: brandColor }}>
                              {variants.length > 1 ? `From ₱${minPrice.toFixed(2)}` : `₱${minPrice.toFixed(2)}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {uncategorizedProducts.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-3">Uncategorized</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {uncategorizedProducts.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((v) => getVariantStock(v) > 0);
                      const minPrice = Math.min(...variants.map((v) => Number(v.price)));
                      return (
                        <div
                          key={product.id}
                          onClick={() => hasStock && handleProductClick(product)}
                          className={`bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-all flex flex-col ${hasStock ? "cursor-pointer hover:shadow-md hover:border-blue-200 active:scale-[0.98]" : "opacity-60 cursor-not-allowed grayscale-[0.5]"}`}
                        >
                          <div className="h-28 sm:h-32 md:h-36 bg-slate-100 relative shrink-0">
                            {product.image ? (
                              <img src={product.image} alt={product.product_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <FiPackage size={32} />
                              </div>
                            )}
                            {!hasStock && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                                  SOLD OUT
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-2.5 flex-1 flex flex-col justify-between">
                            <h3 className="font-semibold text-slate-800 text-xs sm:text-sm leading-tight line-clamp-2 mb-1.5">
                              {product.product_name}
                            </h3>
                            <p className="font-bold text-xs sm:text-sm mt-auto" style={{ color: brandColor }}>
                              {variants.length > 1 ? `From ₱${minPrice.toFixed(2)}` : `₱${minPrice.toFixed(2)}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
            <div className="max-w-md mx-auto pointer-events-auto">
              <button
                onClick={() => setCartOpen(true)}
                className="w-full text-white font-bold py-3.5 px-5 rounded-xl flex items-center justify-between shadow-lg transition-transform active:scale-[0.98]"
                style={{ backgroundColor: brandColor }}
              >
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 px-2 py-0.5 rounded-md text-sm">{cart.length}</span>
                  <span>View Cart</span>
                </div>
                <span>₱{calculateTotal().toFixed(2)}</span>
              </button>
            </div>
          </div>
        )}

        {showVariantModal && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{selectedProduct.product_name}</h3>
                  <p className="text-sm text-slate-500">Select options</p>
                </div>
                <button
                  onClick={() => {
                    setShowVariantModal(false);
                    setSelectedProduct(null);
                    setSelectedVariant(null);
                    setSelectedAddOns({});
                  }}
                  className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-4 space-y-6 flex-1">
                <div>
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="bg-slate-100 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Size / Variant <span className="text-red-500 text-xs font-normal">*Required</span>
                  </h4>
                  <div className="space-y-2">
                    {getProductVariants(selectedProduct).map((variant) => {
                      const isOutOfStock = getVariantStock(variant) === 0;
                      const isSelected = selectedVariant?.id === variant.id;
                      return (
                        <button
                          key={variant.id}
                          onClick={() => setSelectedVariant(variant)}
                          disabled={isOutOfStock}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all flex justify-between items-center ${isSelected ? "border-blue-500 bg-blue-50/50" : isOutOfStock ? "bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed" : "bg-white border-slate-100 hover:border-blue-200"}`}
                          style={isSelected ? { borderColor: brandColor } : undefined}
                        >
                          <span className="font-medium text-slate-800">{variant.name}</span>
                          <span className="font-bold" style={{ color: isOutOfStock ? "#94a3b8" : brandColor }}>
                            {isOutOfStock ? "Sold Out" : `₱${Number(variant.price).toFixed(2)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {addOns.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="bg-slate-100 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                      Add-ons <span className="text-slate-400 text-xs font-normal">Optional</span>
                    </h4>
                    <div className="space-y-2">
                      {addOns.map((addon) => {
                        const isSelected = selectedAddOns[addon.id] || false;
                        return (
                          <label
                            key={addon.id}
                            className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${isSelected ? "border-blue-500 bg-blue-50/50" : "border-slate-100 bg-white hover:border-blue-200"}`}
                            style={isSelected ? { borderColor: brandColor } : undefined}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? "bg-blue-500 border-blue-500" : "border-slate-300"}`}
                                style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
                              >
                                {isSelected && <FiCheckCircle size={14} className="text-white" />}
                              </div>
                              <span className="font-medium text-slate-800">{addon.name}</span>
                            </div>
                            <span className="font-semibold text-slate-600">+₱{Number(addon.price).toFixed(2)}</span>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={isSelected}
                              onChange={(e) => {
                                setSelectedAddOns((prev) => ({
                                  ...prev,
                                  [addon.id]: e.target.checked,
                                }));
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0">
                <button
                  onClick={() => {
                    if (!selectedVariant) {
                      showModal("error", "Select Variant", "Please select a size/variant first");
                      return;
                    }
                    const selectedAddOnsArray = Object.entries(selectedAddOns)
                      .filter(([_, selected]) => selected)
                      .map(([addonId]) => addOns.find((a) => a.id === addonId))
                      .filter((addon): addon is AddOn => Boolean(addon));
                    addToCart(selectedProduct, selectedVariant, selectedAddOnsArray);
                  }}
                  className="w-full text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
                  style={{
                    backgroundColor: brandColor,
                    opacity: selectedVariant ? 1 : 0.5,
                  }}
                >
                  Add to Cart • ₱
                  {selectedVariant
                    ? (
                        Number(selectedVariant.price) +
                        Object.entries(selectedAddOns)
                          .filter(([_, s]) => s)
                          .reduce((acc, [id]) => acc + (Number(addOns.find((a) => a.id === id)?.price) || 0), 0)
                      ).toFixed(2)
                    : "0.00"}
                </button>
              </div>
            </div>
          </div>
        )}

        {cartOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <h2 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                  <FiShoppingCart size={24} style={{ color: brandColor }} />
                  Your Cart
                </h2>
                <button
                  onClick={() => setCartOpen(false)}
                  className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <FiShoppingCart className="mx-auto text-slate-300 mb-3" size={48} />
                    <p className="text-slate-500 font-medium">Your cart is empty</p>
                    <button
                      onClick={() => setCartOpen(false)}
                      className="mt-4 text-sm font-bold hover:underline"
                      style={{ color: brandColor }}
                    >
                      Continue Shopping
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {cart.map((item) => {
                        const itemTotal =
                          (Number(item.price) + item.addOns.reduce((a, b) => a + (Number(b?.price) || 0), 0)) *
                          item.quantity;
                        return (
                          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-bold text-slate-800">{item.product_name}</h4>
                                <p className="text-sm text-slate-500">{item.variant_name}</p>
                                {item.addOns.some((addon) => Boolean(addon)) && (
                                  <div className="mt-1 space-y-0.5">
                                    {item.addOns.filter((addon): addon is AddOn => Boolean(addon)).map((addon) => (
                                      <p key={addon.id} className="text-xs text-slate-400 flex items-center gap-1">
                                        <FiPlus size={10} /> {addon.name} (+₱{Number(addon.price)})
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <p className="font-bold text-slate-800">₱{itemTotal.toFixed(2)}</p>
                            </div>

                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors flex items-center gap-1 text-sm font-medium"
                              >
                                <FiTrash2 size={16} /> Remove
                              </button>

                              <div className="flex items-center gap-3 bg-slate-100 rounded-lg p-1">
                                <button
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="w-7 h-7 bg-white rounded-md shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900"
                                >
                                  <FiMinus size={14} />
                                </button>
                                <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="w-7 h-7 bg-white rounded-md shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900"
                                >
                                  <FiPlus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 space-y-4">
                      <h3 className="font-bold text-slate-800">Customer Details</h3>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Juan Dela Cruz"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={11}
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                          placeholder="0912 345 6789"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Less ice, extra sugar..."
                          rows={2}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none resize-none"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-4 border-t border-slate-100 bg-white">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-500 font-medium">Total Amount</span>
                    <span className="text-2xl font-bold" style={{ color: brandColor }}>
                      ₱{calculateTotal().toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={!customerName.trim()}
                    className="w-full text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: brandColor }}
                  >
                    Place Order
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
