"use client";

import { useEffect, useState } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { buildBarceloReceiptHtml } from "@/components/receipt/barcelo";
import { buildGoodcoffeeReceiptHtml } from "@/components/receipt/goodcoffee";
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
  logo_url?: string | null;
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

interface PopularProduct {
  name: string;
  quantity: number;
  image?: string;
}

export default function CustomerOrdering({ defaultShopId }: { defaultShopId?: string }) {
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState<string>(defaultShopId ? String(defaultShopId) : "1");
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [orderType, setOrderType] = useState<"dine-in" | "takeout">("dine-in");
  const [discountType, setDiscountType] = useState<"none" | "senior" | "pwd">("none");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, boolean>>({});
  // const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState("");
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState<string>("");
  const [popularProduct, setPopularProduct] = useState<PopularProduct | null>(null);
  const [modal, setModal] = useState<Modal>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const brandColor = "#C98A84";
  const discountAmount = discountType === "none" ? 0 : 5;

  const getProductVariants = (product: Product) => product.tbl_product_variants || product.variants || [];

  const getVariantStock = (variant: Variant) => Number(variant.calculated_stock ?? variant.quantity ?? 0);

  const isAddOnOutOfStock = (addon: AddOn) => {
    const quantity = Number(addon.quantity);
    return !Number.isFinite(quantity) || quantity <= 0;
  };

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
      return;
    }

    const storedShopId = localStorage.getItem("shopId");
    if (storedShopId) setShopId(storedShopId);
  }, [defaultShopId]);

  // Load products when shop changes
  useEffect(() => {
    if (!shopId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        let normalizedProducts: Product[] = [];

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
          normalizedProducts = Array.isArray(productsData)
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
          const normalizedAddOns: AddOn[] = Array.isArray(addOnsData)
            ? addOnsData
            : Array.isArray(addOnsData?.toppings)
              ? addOnsData.toppings
              : Array.isArray(addOnsData?.addOns)
                ? addOnsData.addOns
                : [];
          const filteredAddOns = normalizedAddOns.filter((addon) => {
            if (addon.shop_id === undefined || addon.shop_id === null) return true;
            return String(addon.shop_id) === String(shopId);
          });
          setAddOns(filteredAddOns);
        }

        // Find the most purchased product from recent completed orders.
        try {
          const ordersRes = await fetch(`${api_links.tbl_orders}?shop_id=${shopId}`, {
            cache: "no-store",
            headers: { "x-shop-id": shopId },
          });

          if (ordersRes.ok) {
            const ordersData = await ordersRes.json();
            const weekStart = new Date();
            weekStart.setHours(0, 0, 0, 0);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const productTotals = new Map<string, number>();

            (Array.isArray(ordersData) ? ordersData : [])
              .filter((order: any) => {
                const status = String(order.status || "").toLowerCase();
                const createdAt = new Date(order.created_at || "");
                return status === "completed" && createdAt >= weekStart;
              })
              .forEach((order: any) => {
                (Array.isArray(order.items) ? order.items : []).forEach((item: any) => {
                  const productName = String(item.product_name || "").trim();
                  if (!productName) return;
                  productTotals.set(productName, (productTotals.get(productName) || 0) + (Number(item.quantity) || 0));
                });
              });

            const topProduct = [...productTotals.entries()].sort((a, b) => b[1] - a[1])[0];
            if (topProduct) {
              const matchingProduct = normalizedProducts.find(
                (product: Product) => product.product_name === topProduct[0]
              );
              setPopularProduct({
                name: topProduct[0],
                quantity: topProduct[1],
                image: matchingProduct?.image,
              });
            } else {
              setPopularProduct(null);
            }
          }
        } catch (error) {
          console.warn("Could not load popular product:", error);
          setPopularProduct(null);
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

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const resetKioskTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setCart([]);
        setCustomerName("");
        setTableNumber("");
        setNotes("");
        setConfirmingOrder(false);
        localStorage.removeItem("customerCart");
      }, 15 * 60 * 1000);
    };

    ["pointerdown", "keydown", "touchstart"].forEach((eventName) =>
      window.addEventListener(eventName, resetKioskTimer)
    );
    resetKioskTimer();
    return () => {
      clearTimeout(timeout);
      ["pointerdown", "keydown", "touchstart"].forEach((eventName) =>
        window.removeEventListener(eventName, resetKioskTimer)
      );
    };
  }, []);

  const handleProductClick = (product: Product) => {
    const hasStock = getProductVariants(product).some((variant) => getVariantStock(variant) > 0);
    if (!hasStock) {
      showModal("error", "Out of Stock", `${product.product_name} is out of stock!`);
      return;
    }

    const variants = getProductVariants(product);

    if (variants.length === 1 && addOns.length === 0) {
      addToCart(product, variants[0], []);
    } else {
      setSelectedProduct(product);
      setSelectedVariant(null);
      setSelectedAddOns({});
      setShowVariantModal(true);
    }
  };

  const addToCart = (product: Product, variant: Variant, selectedAddOnsArray: AddOn[]) => {
    const unavailableAddOn = selectedAddOnsArray.find(isAddOnOutOfStock);
    if (unavailableAddOn) {
      showModal("error", "Add-On Unavailable", `${unavailableAddOn.name} is out of stock.`);
      return;
    }

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
    return Math.max(0, calculateSubtotal() - discountAmount);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      showModal("error", "Empty Cart", "Please add items to cart");
      return;
    }

    if (!customerName.trim()) {
      showModal("error", "Name Required", "Please enter your name");
      return;
    }
    if (orderType === "dine-in" && !tableNumber) {
      showModal("error", "Table Required", "Please select a table number for dine-in orders");
      return;
    }
    if (paymentMethod === "online" && !paymentReference.trim()) {
      showModal("error", "Payment Reference Required", "Please enter the online payment reference");
      return;
    }
    setCartOpen(false);
    setConfirmingOrder(true);
  };

  const submitOrder = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const total = calculateTotal();
      const orderPayload = {
        customer_name: customerName.trim(),
        table_number: orderType === "dine-in" && tableNumber ? parseInt(tableNumber, 10) : null,
        order_type: orderType,
        status: "awaiting_acceptance",
        total,
        discount_type: discountType,
        discount: discountAmount,
        payment_method: paymentMethod,
        payment_reference: paymentMethod === "online" ? paymentReference.trim() : null,
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
      const subtotal = calculateSubtotal();
      const receiptItems = cart.map((item) => ({
        productName: `${item.product_name} - ${item.variant_name}`,
        quantity: item.quantity,
        lineTotal:
          (Number(item.price) +
            item.addOns.reduce((sum, addOn) => sum + (Number(addOn.price) || 0), 0)) *
          item.quantity,
      }));

      const receiptData = {
        referenceNumber: String(result.order_id),
        shopName: shopInfo?.name || "Shop",
        customerName: customerName,
        orderType,
        createdAt: formattedDate,
        subtotal: subtotal,
        discount: discountAmount,
        total,
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
      setConfirmingOrder(false);
      setOrderSubmitted(true);
      setCart([]);
      localStorage.removeItem("customerCart");
    } catch (error: any) {
      console.error("Checkout error:", error);
      showModal("error", "Order Failed", error.message || "Failed to submit order");
    } finally {
      setIsSubmitting(false);
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
      <div className="min-h-screen bg-[#FAF6F4] px-4 pb-20 pt-6 text-[#2D2626] sm:px-6">
        <div className="mx-auto min-h-screen max-w-3xl overflow-hidden rounded-2xl border border-[#E9DEDA] bg-[#FFFCFA] shadow-[0_8px_24px_rgba(74,49,44,0.06)]">
          {receiptHtml && (
            <div className="border-b border-[#E9DEDA] bg-[#FAF6F4] p-4 sm:p-6">
              <iframe
                srcDoc={receiptHtml}
                className="w-full overflow-hidden rounded-xl border border-[#E9DEDA] bg-white shadow-sm"
                style={{ height: "600px" }}
                title="Order Receipt"
              />
            </div>
          )}

          <div className="p-6 text-center sm:p-10">
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${brandColor}20` }}
            >
              <span style={{ color: brandColor, display: "inline-flex" }}>
                <FiCheckCircle size={32} />
              </span>
            </div>
            <h2 className="mb-2 text-2xl font-black text-[#2D2626]">Order placed!</h2>
            <p className="mb-2 text-[#796E6B]">Your order number is:</p>
            <p className="mb-6 text-3xl font-black" style={{ color: brandColor }}>
              {submittedOrderId}
            </p>
            <p className="mb-8 text-sm text-[#796E6B]">
              Show this receipt to the cashier when you are ready.
            </p>

            <div className="mx-auto max-w-sm space-y-3">
              <button
                onClick={() => window.print()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-4 py-3 font-bold text-white shadow-sm transition hover:bg-[#B97873]"
              >
                <FiPrinter size={20} /> Print Receipt
              </button>
              <button
                onClick={() => {
                  setOrderSubmitted(false);
                  setSubmittedOrderId("");
                  setOrderType("dine-in");
                  setDiscountType("none");
                  setPaymentMethod("cash");
                  setPaymentReference("");
                  setCustomerName("");
                  setTableNumber("");
                  setNotes("");
                  setCart([]);
                  setReceiptHtml("");
                }}
                className="min-h-12 w-full rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] py-3 font-bold text-[#796E6B] transition hover:bg-[#FBF2F0]"
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F4] pb-24 font-sans text-[#2D2626]">
      <div className="relative mx-auto min-h-screen w-full bg-[#FAF6F4] px-4 shadow-sm sm:px-6 lg:px-8 md:max-w-5xl lg:max-w-[1500px]">
        {modal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2626]/35 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-[#E9DEDA] bg-[#FFFCFA] p-6 shadow-2xl">
              <h3 className="mb-2 text-lg font-bold text-[#2D2626]">{modal.title}</h3>
              <p className="mb-6 text-[#796E6B]">{modal.message}</p>
              <button
                onClick={() => {
                  setModal({ ...modal, isOpen: false });
                  modal.onConfirm?.();
                }}
                className="min-h-12 w-full rounded-xl bg-[#C98A84] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[#B97873]"
              >
                OK
              </button>
            </div>
          </div>
        )}

        <div className="sticky top-0 z-20 border-b border-[#E9DEDA] bg-[#FAF6F4]/95 shadow-[0_8px_24px_rgba(74,49,44,0.06)] backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[#C98A84] text-sm font-black text-white shadow-sm">
                {shopInfo?.logo_url ? <img src={shopInfo.logo_url} alt="" className="h-full w-full object-cover" /> : "B"}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A08F89]">Customer ordering</p>
                <h1 className="mt-1 text-xl font-black text-[#2D2626]">{shopInfo?.name || "Menu"}</h1>
              </div>
            </div>
            <button
              onClick={() => setCartOpen(true)}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#E9DEDA] bg-white text-[#A76560] shadow-sm transition hover:bg-[#FBF2F0]"
              style={{ color: brandColor }}
            >
              <FiShoppingCart size={24} />
              {cart.length > 0 && (
                <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#FAF6F4] bg-[#C98A84] text-[10px] font-bold text-white">
                  {cart.length}
                </span>
              )}
            </button>
          </div>

          <div className="mx-auto max-w-[1500px] px-4 pb-4 sm:px-6">
            <div className="relative">
              <FiSearch
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A08F89]"
                size={18}
              />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-transparent bg-[#FBF2F0] py-3.5 pl-10 pr-4 text-base text-[#2D2626] outline-none transition-all placeholder:text-[#A08F89] focus:border-[#C98A84] focus:bg-white focus:ring-2 focus:ring-[#C98A84]/20"
              />
            </div>
          </div>

          <div className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto px-4 pb-4 sm:px-6">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`min-h-11 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all ${selectedCategory === "all" ? "bg-[#C98A84] text-white shadow-sm hover:bg-[#B97873]" : "bg-white/70 text-[#796E6B] hover:bg-white hover:text-[#2D2626]"}`}
              style={selectedCategory === "all" ? { boxShadow: "0 4px 12px #C98A8433" } : undefined}
            >
              All ({products.length})
            </button>
            {categories.map((category) => {
              const count = products.filter((p) => p.category_id === category.id).length;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(String(category.id))}
                  className={`min-h-11 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium capitalize transition-all ${selectedCategory === String(category.id) ? "bg-[#C98A84] text-white shadow-sm hover:bg-[#B97873]" : "bg-white/70 text-[#796E6B] hover:bg-white hover:text-[#2D2626]"}`}
                  style={selectedCategory === String(category.id) ? { boxShadow: "0 4px 12px #C98A8433" } : undefined}
                >
                  {category.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {popularProduct && (
          <section className="mx-4 mt-5 overflow-hidden rounded-2xl border border-[#C98A84] bg-[#FBF2F0] text-[#2D2626] shadow-sm sm:mx-6 lg:mx-0">
            <div className="flex items-center gap-4 p-4 sm:p-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white sm:h-20 sm:w-20">
                {popularProduct.image ? (
                  <img src={popularProduct.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <FiPackage size={28} className="text-[#CDBDB7]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C98A84]">Top seller this week</p>
                <h2 className="mt-1 truncate text-lg font-black sm:text-xl">{popularProduct.name}</h2>
                <p className="mt-1 text-sm text-[#796E6B]">Ordered {popularProduct.quantity} times this week</p>
              </div>
            </div>
          </section>
        )}

        <div className="p-4">
          <div className="space-y-6">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <FiPackage className="mx-auto mb-3 text-[#CDBDB7]" size={48} />
              <p className="font-medium text-[#796E6B]">No products found</p>
              <p className="text-sm text-[#A08F89]">Try a different search term or category</p>
            </div>
          ) : (
            <>
              {groupedProducts.map((category) => (
                <div key={category.id}>
                  <h2 className="mb-3 text-lg font-bold text-[#2D2626]">{category.name}</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {category.products.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((v) => getVariantStock(v) > 0);
                      const minPrice = Math.min(...variants.map((v) => Number(v.price)));
                      return (
                        <div
                          key={product.id}
                          onClick={() => {
                            if (hasStock) handleProductClick(product);
                          }}
                          aria-disabled={!hasStock}
                          className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_4px_18px_rgba(74,49,44,0.05)] transition-all ${hasStock ? "cursor-pointer border-[#E9DEDA] hover:-translate-y-0.5 hover:border-[#C98A84] hover:shadow-[0_10px_24px_rgba(74,49,44,0.10)] active:scale-[0.98]" : "cursor-not-allowed border-red-200 bg-red-50 opacity-75"}`}
                        >
                          <div className="relative h-28 shrink-0 bg-[#FBF2F0] sm:h-32 md:h-36">
                            {product.image ? (
                              <img src={product.image} alt={product.product_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#CDBDB7]">
                                <FiPackage size={32} />
                              </div>
                            )}
                            {!hasStock && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="rounded-lg bg-[#A65F58] px-2 py-1 text-[9px] font-bold text-white">
                                  SOLD OUT
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-3">
                            <h3 className="mb-1.5 line-clamp-2 text-sm font-bold leading-tight text-[#2D2626] sm:text-base">
                              {product.product_name}
                            </h3>
                            <p className="font-bold text-sm mt-auto" style={{ color: brandColor }}>
                              {variants.length > 1 ? `From ₱${minPrice.toFixed(2)}` : `₱${minPrice.toFixed(2)}`}
                            </p>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (hasStock) handleProductClick(product);
                              }}
                              disabled={!hasStock}
                              className="mt-3 min-h-11 w-full rounded-xl bg-[#C98A84] px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#B97873] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {hasStock ? "Add" : "Sold out"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {uncategorizedProducts.length > 0 && (
                <div>
                  <h2 className="mb-3 text-lg font-bold text-[#2D2626]">Uncategorized</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {uncategorizedProducts.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((v) => getVariantStock(v) > 0);
                      const minPrice = Math.min(...variants.map((v) => Number(v.price)));
                      return (
                        <div
                          key={product.id}
                          onClick={() => {
                            if (hasStock) handleProductClick(product);
                          }}
                          aria-disabled={!hasStock}
                          className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_4px_18px_rgba(74,49,44,0.05)] transition-all ${hasStock ? "cursor-pointer border-[#E9DEDA] hover:-translate-y-0.5 hover:border-[#C98A84] hover:shadow-[0_10px_24px_rgba(74,49,44,0.10)] active:scale-[0.98]" : "cursor-not-allowed border-red-200 bg-red-50 opacity-75"}`}
                        >
                          <div className="relative h-28 shrink-0 bg-[#FBF2F0] sm:h-32 md:h-36">
                            {product.image ? (
                              <img src={product.image} alt={product.product_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#CDBDB7]">
                                <FiPackage size={32} />
                              </div>
                            )}
                            {!hasStock && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="rounded-lg bg-[#A65F58] px-2 py-1 text-[9px] font-bold text-white">
                                  SOLD OUT
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-3">
                            <h3 className="mb-1.5 line-clamp-2 text-sm font-bold leading-tight text-[#2D2626] sm:text-base">
                              {product.product_name}
                            </h3>
                            <p className="font-bold text-sm mt-auto" style={{ color: brandColor }}>
                              {variants.length > 1 ? `From ₱${minPrice.toFixed(2)}` : `₱${minPrice.toFixed(2)}`}
                            </p>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (hasStock) handleProductClick(product);
                              }}
                              disabled={!hasStock}
                              className="mt-3 min-h-11 w-full rounded-xl bg-[#C98A84] px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#B97873] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {hasStock ? "Add" : "Sold out"}
                            </button>
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
        </div>

        {cart.length > 0 && (
          <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 bg-linear-to-t from-[#FAF6F4] via-[#FAF6F4] to-transparent p-4">
            <div className="w-full mx-auto pointer-events-auto md:max-w-3xl lg:max-w-4xl">
              <button
                onClick={() => setCartOpen(true)}
                className="flex min-h-12 w-full items-center justify-between rounded-xl bg-[#C98A84] px-5 py-3.5 font-bold text-white shadow-lg transition hover:bg-[#B97873] active:scale-[0.98]"
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
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2D2626]/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[#E9DEDA] bg-[#FFFCFA] shadow-2xl sm:max-w-lg sm:rounded-2xl md:max-w-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E9DEDA] bg-[#FFFCFA] p-4">
                <div>
                  <h3 className="text-lg font-black text-[#2D2626]">{selectedProduct.product_name}</h3>
                  <p className="text-sm text-[#796E6B]">Select options</p>
                </div>
                <button
                  onClick={() => {
                    setShowVariantModal(false);
                    setSelectedProduct(null);
                    setSelectedVariant(null);
                    setSelectedAddOns({});
                  }}
                  className="min-h-11 min-w-11 rounded-xl bg-[#FBF2F0] text-[#796E6B] transition hover:bg-[#E9DEDA]"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto p-4">
                <div>
                  <h4 className="mb-3 flex items-center gap-2 font-bold text-[#2D2626]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FBF2F0] text-xs">1</span>
                    Size / Variant <span className="text-xs font-normal text-[#A65F58]">*Required</span>
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
                          className={`flex min-h-12 w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${isSelected ? "border-[#C98A84] bg-[#FBF2F0]" : isOutOfStock ? "cursor-not-allowed border-red-200 bg-red-50 opacity-75" : "border-[#E9DEDA] bg-white hover:border-[#C98A84] hover:bg-[#FBF2F0]"}`}
                          style={isSelected ? { borderColor: brandColor } : undefined}
                        >
                          <span className="font-semibold text-[#2D2626]">{variant.name}</span>
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
                    <h4 className="mb-3 flex items-center gap-2 font-bold text-[#2D2626]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FBF2F0] text-xs">2</span>
                      Add-ons <span className="text-xs font-normal text-[#A08F89]">Optional</span>
                    </h4>
                    <div className="space-y-2">
                      {addOns.map((addon) => {
                        const isSelected = selectedAddOns[addon.id] || false;
                        return (
                          <label
                            key={addon.id}
                            onClick={(event) => {
                              if (isAddOnOutOfStock(addon)) event.preventDefault();
                            }}
                            className={`flex min-h-12 items-center justify-between rounded-xl border p-4 transition-all ${isAddOnOutOfStock(addon) ? "cursor-not-allowed border-red-200 bg-red-50 opacity-75" : isSelected ? "cursor-pointer border-[#C98A84] bg-[#FBF2F0]" : "cursor-pointer border-[#E9DEDA] bg-white hover:border-[#C98A84] hover:bg-[#FBF2F0]"}`}
                            style={isSelected ? { borderColor: brandColor } : undefined}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded border ${isSelected ? "border-[#C98A84] bg-[#C98A84]" : "border-[#CDBDB7]"}`}
                                style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
                              >
                                {isSelected && <FiCheckCircle size={14} className="text-white" />}
                              </div>
                              <span className="font-semibold text-[#2D2626]">{addon.name}</span>
                            </div>
                            <span className="font-semibold text-[#796E6B]">+₱{Number(addon.price).toFixed(2)}</span>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={isSelected}
                              disabled={isAddOnOutOfStock(addon)}
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

              <div className="sticky bottom-0 border-t border-[#E9DEDA] bg-[#FFFCFA] p-4">
                <button
                  onClick={() => {
                    if (!selectedVariant) {
                      showModal("error", "Select Variant", "Please select a size/variant first");
                      return;
                    }
                    const selectedAddOnsArray = Object.entries(selectedAddOns)
                      .filter(([_, selected]) => selected)
                      .map(([addonId]) => addOns.find((addon) => String(addon.id) === addonId))
                      .filter((addon): addon is AddOn => Boolean(addon));
                    addToCart(selectedProduct, selectedVariant, selectedAddOnsArray);
                  }}
                  className="min-h-12 w-full rounded-xl bg-[#C98A84] py-3.5 font-bold text-white shadow-sm transition hover:bg-[#B97873] active:scale-[0.98]"
                  style={{ opacity: selectedVariant ? 1 : 0.5 }}
                >
                  Add to Cart • ₱
                  {selectedVariant
                    ? (
                        Number(selectedVariant.price) +
                        Object.entries(selectedAddOns)
                          .filter(([_, s]) => s)
                          .reduce((acc, [id]) => acc + (Number(addOns.find((addon) => String(addon.id) === id)?.price) || 0), 0)
                      ).toFixed(2)
                    : "0.00"}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmingOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2D2626]/35 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-[#E9DEDA] bg-[#FFFCFA] p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#C98A84]">Final check</p>
                  <h2 className="mt-1 text-2xl font-black text-[#2D2626]">Confirm order</h2>
                </div>
                <button onClick={() => setConfirmingOrder(false)} className="min-h-11 min-w-11 rounded-xl border border-[#E9DEDA] bg-[#FBF2F0] text-[#796E6B] transition hover:bg-[#E9DEDA]">
                  <FiX className="mx-auto" size={20} />
                </button>
              </div>
              <div className="mb-5 max-h-56 space-y-2 overflow-y-auto rounded-xl bg-[#FAF6F4] p-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 text-sm">
                    <span>
                      <strong>{item.quantity}x</strong> {item.product_name} · {item.variant_name}
                      {item.addOns.length > 0 && (
                        <span className="block text-xs text-[#796E6B]">
                          Add-ons: {item.addOns.map((addOn) => addOn.name).join(", ")}
                        </span>
                      )}
                    </span>
                    <strong>₱{((Number(item.price) + item.addOns.reduce((sum, addon) => sum + Number(addon.price || 0), 0)) * item.quantity).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
              <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-[#E9DEDA] p-3">
                  <p className="text-[#796E6B]">Order type</p>
                  <p className="font-black">{orderType === "dine-in" ? `Dine-in · Table ${tableNumber}` : "Takeout"}</p>
                </div>
                <div className="rounded-xl border border-[#E9DEDA] p-3">
                  <p className="text-[#796E6B]">Customer</p>
                  <p className="truncate font-black">{customerName}</p>
                </div>
                <div className="rounded-xl border border-[#E9DEDA] p-3">
                  <p className="text-[#796E6B]">Discount</p>
                  <p className="font-black">{discountType === "none" ? "None" : `${discountType.toUpperCase()} · ₱${discountAmount.toFixed(2)}`}</p>
                </div>
                <div className="rounded-xl border border-[#E9DEDA] p-3">
                  <p className="text-[#796E6B]">Payment</p>
                  <p className="font-black">{paymentMethod === "online" ? "Online" : "Cash"}</p>
                </div>
              </div>
              <div className="mb-5 flex items-center justify-between border-t border-[#E9DEDA] pt-4">
                <span className="font-bold text-[#796E6B]">Total</span>
                <span className="text-2xl font-black" style={{ color: brandColor }}>₱{calculateTotal().toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmingOrder(false)} disabled={isSubmitting} className="min-h-14 rounded-xl border border-[#E9DEDA] bg-[#FBF2F0] font-bold text-[#796E6B] transition hover:bg-[#E9DEDA]">
                  Go back
                </button>
                <button onClick={submitOrder} disabled={isSubmitting} className="min-h-14 rounded-xl bg-[#C98A84] font-bold text-white shadow-sm transition hover:bg-[#B97873] disabled:opacity-60">
                  {isSubmitting ? "Sending..." : "Send to kitchen"}
                </button>
              </div>
            </div>
          </div>
        )}

        {cartOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-[#2D2626]/35 backdrop-blur-sm">
            <div className="flex h-full w-full max-w-md flex-col border-l border-[#E9DEDA] bg-[#FFFCFA] shadow-2xl sm:max-w-lg md:max-w-2xl">
              <div className="flex items-center justify-between border-b border-[#E9DEDA] bg-[#FFFCFA] p-4">
                <h2 className="flex items-center gap-2 text-xl font-black text-[#2D2626]">
                  <FiShoppingCart size={24} style={{ color: brandColor }} />
                  Your Cart
                </h2>
                <button
                  onClick={() => setCartOpen(false)}
                  className="min-h-11 min-w-11 rounded-xl bg-[#FBF2F0] text-[#796E6B] transition hover:bg-[#E9DEDA]"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto bg-[#FAF6F4] p-4">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <FiShoppingCart className="mx-auto mb-3 text-[#CDBDB7]" size={48} />
                    <p className="font-medium text-[#796E6B]">Your cart is empty</p>
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
                            <div key={item.id} className="rounded-2xl border border-[#E9DEDA] bg-white p-4 shadow-sm">
                            <div className="mb-2 flex items-start justify-between">
                              <div>
                                <h4 className="font-bold text-[#2D2626]">{item.product_name}</h4>
                                <p className="text-sm text-[#796E6B]">{item.variant_name}</p>
                                {item.addOns.some((addon) => Boolean(addon)) && (
                                  <div className="mt-1 space-y-0.5">
                                    {item.addOns.filter((addon): addon is AddOn => Boolean(addon)).map((addon) => (
                                      <p key={addon.id} className="flex items-center gap-1 text-xs text-[#A08F89]">
                                        <FiPlus size={10} /> {addon.name} (+₱{Number(addon.price)})
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <p className="font-bold text-[#2D2626]">₱{itemTotal.toFixed(2)}</p>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-[#FBF2F0] pt-3">
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="flex min-h-10 items-center gap-1 rounded-xl px-2 text-sm font-medium text-[#A65F58] transition hover:bg-red-50"
                              >
                                <FiTrash2 size={16} /> Remove
                              </button>

                              <div className="flex items-center gap-3 rounded-xl bg-[#FBF2F0] p-1">
                                <button
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#796E6B] shadow-sm hover:text-[#2D2626]"
                                >
                                  <FiMinus size={14} />
                                </button>
                                <span className="w-4 text-center text-sm font-bold">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#796E6B] shadow-sm hover:text-[#2D2626]"
                                >
                                  <FiPlus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-4 rounded-2xl border border-[#E9DEDA] bg-white p-5 shadow-sm">
                      <h3 className="font-bold text-[#2D2626]">Customer details</h3>

                      <div className="grid grid-cols-2 gap-2">
                        {(["dine-in", "takeout"] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setOrderType(type)}
                            className={`min-h-12 rounded-xl text-sm font-bold ${orderType === type ? "bg-[#C98A84] text-white shadow-sm hover:bg-[#B97873]" : "bg-[#FBF2F0] text-[#796E6B] hover:bg-[#E9DEDA]"}`}
                          >
                            {type === "dine-in" ? "Dine-in" : "Takeout"}
                          </button>
                        ))}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#2D2626]">Discount</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["none", "senior", "pwd"] as const).map((type) => (
                            <button
                              key={type}
                              onClick={() => setDiscountType(type)}
                              className={`min-h-11 rounded-xl text-sm font-bold uppercase ${discountType === type ? "bg-[#C98A84] text-white shadow-sm hover:bg-[#B97873]" : "bg-[#FBF2F0] text-[#796E6B] hover:bg-[#E9DEDA]"}`}
                            >
                              {type === "none" ? "None" : type}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#2D2626]">Payment method</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["cash", "online"] as const).map((method) => (
                            <button
                              key={method}
                              onClick={() => setPaymentMethod(method)}
                              className={`min-h-11 rounded-xl text-sm font-bold capitalize ${paymentMethod === method ? "bg-[#C98A84] text-white shadow-sm hover:bg-[#B97873]" : "bg-[#FBF2F0] text-[#796E6B] hover:bg-[#E9DEDA]"}`}
                            >
                              {method}
                            </button>
                          ))}
                        </div>
                      </div>

                      {paymentMethod === "online" && (
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-[#2D2626]">Payment reference *</label>
                          <input
                            value={paymentReference}
                            onChange={(event) => setPaymentReference(event.target.value)}
                            placeholder="Reference number"
                            className="min-h-12 w-full rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] px-4 py-2.5 text-[#2D2626] outline-none transition-all placeholder:text-[#A08F89] focus:border-[#C98A84] focus:bg-white focus:ring-2 focus:ring-[#C98A84]/20"
                          />
                        </div>
                      )}

                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#2D2626]">Name *</label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Juan Dela Cruz"
                          className="min-h-12 w-full rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] px-4 py-2.5 text-[#2D2626] outline-none transition-all placeholder:text-[#A08F89] focus:border-[#C98A84] focus:bg-white focus:ring-2 focus:ring-[#C98A84]/20"
                        />
                      </div>

                      {orderType === "dine-in" && <div>
                        <label className="mb-1 block text-sm font-semibold text-[#2D2626]">Table number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={11}
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value.replace(/\D/g, ""))}
                          placeholder="e.g. 12"
                          className="min-h-12 w-full rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] px-4 py-2.5 text-[#2D2626] outline-none transition-all placeholder:text-[#A08F89] focus:border-[#C98A84] focus:bg-white focus:ring-2 focus:ring-[#C98A84]/20"
                        />
                      </div>}

                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#2D2626]">Notes (optional)</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Less ice, extra sugar..."
                          rows={2}
                          className="min-h-20 w-full resize-none rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] px-4 py-2.5 text-[#2D2626] outline-none transition-all placeholder:text-[#A08F89] focus:border-[#C98A84] focus:bg-white focus:ring-2 focus:ring-[#C98A84]/20"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-[#E9DEDA] bg-[#FFFCFA] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-medium text-[#796E6B]">Total amount</span>
                    <span className="text-2xl font-black" style={{ color: brandColor }}>
                      ₱{calculateTotal().toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={!customerName.trim()}
                    className="min-h-12 w-full rounded-xl bg-[#C98A84] py-3.5 font-bold text-white shadow-sm transition hover:bg-[#B97873] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Review Order
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
