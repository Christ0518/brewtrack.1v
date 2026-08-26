"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { FiShoppingCart, FiSearch, FiX, FiTrash2, FiPlus, FiMinus, FiArrowLeft, FiPackage, FiMenu, FiClock } from "react-icons/fi";
import { buildBarceloReceiptHtml } from "@/components/receipt/barcelo";
import { buildGoodcoffeeReceiptHtml } from "@/components/receipt/goodcoffee";
import { getShopTheme } from "@/lib/theme";

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
  quantity_per_item?: number;
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

interface CustomerOrder {
  id: string | number;
  order_number?: string;
  customer_name?: string;
  notes?: string;
  edit_reason?: string | null;
  status?: string;
  created_at?: string;
  items: Array<{
    product_name?: string;
    variant_name?: string;
    quantity: number;
  }>;
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
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
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
  const [showCategories, setShowCategories] = useState(true);
  const [showCart, setShowCart] = useState(true);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [showEditPasswordModal, setShowEditPasswordModal] = useState(false);
  const knownOrderStatuses = useRef(new Map<string, string>());
  const [modal, setModal] = useState<Modal>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });
  const brandColor = getShopTheme(userData?.shop_id).accentColor;

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
      const storedUserData = JSON.parse(storedUser);
      const user = {
        ...storedUserData,
        role: String(storedUserData.role || storedUserData.user_role || storedUserData.userRole || "").trim().toLowerCase(),
      } as CashierUser;
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

  useEffect(() => {
    const savedOrder = sessionStorage.getItem("cashierEditOrder");
    if (!savedOrder) return;

    try {
      const order = JSON.parse(savedOrder);
      const editItems: CartItem[] = (Array.isArray(order.items) ? order.items : []).map((item: any, index: number) => ({
        id: `edit-${order.id}-${index}`,
        product_id: String(item.variant_id || item.product_id || ""),
        product_name: item.product_name || "Item",
        variant_id: String(item.variant_id || ""),
        variant_name: item.variant_name || "Default",
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        discount_type: "none",
        discount: 0,
        addOns: [],
        orderType: "dine-in",
      }));

      setEditingOrderId(String(order.id));
      setCart(editItems);
      setCustomerName(order.customer_name || "Walk-in");
      setNotes(order.notes || "");
      setEditReason(order.edit_reason || "");
      setShowCart(true);
      sessionStorage.removeItem("cashierEditOrder");
    } catch (error) {
      console.error("Failed to load order for editing:", error);
      sessionStorage.removeItem("cashierEditOrder");
    }
  }, []);

  const loadCustomerOrders = async () => {
    if (!userData) return;
    setOrdersLoading(true);
    try {
      const response = await fetch(`${api_links.tbl_orders}?shop_id=${userData.shop_id}`, {
        cache: "no-store",
        headers: {
          "x-shop-id": userData.shop_id || "",
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load customer orders: ${response.status} - ${errorText.substring(0, 120)}`);
      }
      const data = await response.json();
      const normalizedOrders = Array.isArray(data) ? data : [];
      const hasLoadedOrdersBefore = knownOrderStatuses.current.size > 0;
      const completedOrders: any[] = [];
      const newIncomingOrders: any[] = [];

      normalizedOrders.forEach((order: any) => {
        const orderId = String(order.id);
        const status = String(order.status || "").toLowerCase();
        const previousStatus = knownOrderStatuses.current.get(orderId);
        knownOrderStatuses.current.set(orderId, status);
        if (status === "completed" && previousStatus === "preparing") completedOrders.push(order);
        if (
          hasLoadedOrdersBefore &&
          (status === "pending" || status === "awaiting_acceptance") &&
          !previousStatus
        ) {
          newIncomingOrders.push(order);
        }
      });

      if (completedOrders.length > 0) {
        const completedOrder = completedOrders[0];
        showModal(
          "success",
          "Order Ready",
          `${completedOrder.order_number || `Order #${completedOrder.id}`} has been marked done by the kitchen.`
        );
      }

      if (newIncomingOrders.length > 0) {
        const incomingOrder = newIncomingOrders[0];
        showModal(
          "warning",
          "New Incoming Order",
          `${incomingOrder.order_number || `Order #${incomingOrder.id}`} is waiting for acceptance.`
        );
      }

      const pendingOrders = normalizedOrders
        .filter((order: any) => {
          const status = String(order.status).toLowerCase();
          return status === "pending" || status === "awaiting_acceptance";
        })
        .map((order: any) => {
          const items = Array.isArray(order.items) ? order.items : [];
          return {
            id: order.id,
            order_number: order.order_number || `ORD-${String(order.id).padStart(6, "0")}`,
            customer_name: order.customer_name || "Walk-in",
            notes: order.notes || order.special_notes || "",
            status: order.status,
            created_at: order.created_at || order.createdAt || new Date().toISOString(),
            items: items.map((item: any) => ({
              product_name: item.product_name || item.tbl_product_variants?.[0]?.tbl_products?.[0]?.product_name || "Item",
              variant_name: item.variant_name || item.tbl_product_variants?.[0]?.name || "",
              quantity: Number(item.quantity) || 0,
            })),
          } as CustomerOrder;
        })
        .sort((a: CustomerOrder, b: CustomerOrder) => {
          const aTime = new Date(a.created_at || "").getTime();
          const bTime = new Date(b.created_at || "").getTime();
          return aTime - bTime;
        });
      setCustomerOrders(pendingOrders);
    } catch (error) {
      console.error("Error loading customer orders:", error);
      setCustomerOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (!userData) return;
    loadCustomerOrders();
    const interval = setInterval(loadCustomerOrders, 10000);
    return () => clearInterval(interval);
  }, [userData]);

  const handleAcceptCustomerOrder = async (orderId: string | number) => {
    try {
      const response = await fetch(api_links.tbl_orders, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-shop-id": userData?.shop_id || "",
        },
        body: JSON.stringify({ id: orderId, status: "preparing" }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to accept customer order: ${response.status} - ${errorText.substring(0, 120)}`);
      }

      setCustomerOrders((current) => current.filter((order) => order.id !== orderId));
      showModal("success", "Order Accepted", "Customer order sent to kitchen for preparation.");
    } catch (error) {
      console.error("Error accepting customer order:", error);
      showModal("error", "Accept Failed", error instanceof Error ? error.message : "Failed to accept order");
    }
  };

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
    const unavailableAddOn = selectedAddOnsArray.find(isAddOnOutOfStock);
    if (unavailableAddOn) {
      showModal("error", "Add-On Out of Stock", `${unavailableAddOn.name} is out of stock and cannot be added.`);
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
          const newQty = Math.max(0, item.quantity + change);
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
      const addOnsPrice = item.addOns.reduce((acc, addon) => acc + (addon?.price || 0), 0);
      return sum + (itemPrice + addOnsPrice) * item.quantity;
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal();
  };

  const handleCheckout = async (providedAdminPassword?: string) => {
    if (cart.length === 0) {
      showModal("error", "Empty Cart", "Please add items to cart");
      return;
    }

    if (cart.some((item) => item.quantity === 0)) {
      showModal("error", "Invalid Quantity", "Remove or update zero-quantity items before checkout.");
      return;
    }

    const addOnRequirements = new Map<string, number>();
    cart.forEach((item) => {
      item.addOns.forEach((addon) => {
        const required = (Number(addon.quantity_per_item) || 1) * item.quantity;
        addOnRequirements.set(String(addon.id), (addOnRequirements.get(String(addon.id)) || 0) + required);
      });
    });

    const unavailableAddOn = Array.from(addOnRequirements.entries()).find(([addonId, required]) => {
      const addon = addOns.find((item) => String(item.id) === addonId);
      return !addon || isAddOnOutOfStock(addon) || Number(addon.quantity) < required;
    });

    if (unavailableAddOn) {
      const addon = addOns.find((item) => String(item.id) === unavailableAddOn[0]);
      showModal(
        "error",
        "Add-On Out of Stock",
        `${addon?.name || "Selected add-on"} does not have enough stock for this order.`
      );
      return;
    }

    if (!customerName.trim()) {
      showModal("error", "Customer Name Required", "Please enter customer name");
      return;
    }

    if (editingOrderId && !editReason.trim()) {
      showModal("error", "Edit Reason Required", "Please explain why this order is being edited.");
      return;
    }

    const adminPassword = providedAdminPassword || editAdminPassword;
    if (editingOrderId && !adminPassword) {
      setShowEditPasswordModal(true);
      return;
    }

    try {
      const total = calculateTotal();
      const orderPayload = editingOrderId
        ? {
            id: editingOrderId,
            admin_password: adminPassword,
            total,
            discount_type: "per-item",
            discount: cart.reduce((sum, item) => sum + (item.discount || 0), 0),
            customer_name: customerName.trim(),
            notes: notes || null,
            edit_reason: editReason.trim(),
            paid: amountPaid ? Number(amountPaid) : total,
            change: amountPaid ? Number(amountPaid) - total : 0,
            items: cart.map((item) => ({
              variant_id: item.variant_id,
              quantity: item.quantity,
              price: item.price,
              discount_type: item.discount_type,
              discount: item.discount,
              addOns: item.addOns,
            })),
          }
        : {
            cashier_id: userData?.id,
            order_type: orderType,
            status: "preparing",
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
        method: editingOrderId ? "PUT" : "POST",
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

      showModal("success", editingOrderId ? "Order Updated" : "Order Created", editingOrderId ? `Order #${editingOrderId} was updated.` : `Order #${result.order_id} sent to kitchen!`, () => {
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
        setEditingOrderId(null);
        setEditAdminPassword("");
        setEditReason("");
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

  const handleQuantityInputChange = (itemId: string, value: string) => {
    const parsedValue = Number(value);
    const nextQuantity = Number.isFinite(parsedValue) ? Math.max(0, Math.floor(parsedValue)) : 0;

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === itemId ? { ...item, quantity: nextQuantity } : item
      )
    );
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
      : "bg-slate-100 text-slate-700 hover:bg-[#6c3030] hover:text-white";
  };

  const getCategoryButtonStyle = (categoryId: string) => {
    return selectedCategory === categoryId
      ? { backgroundColor: brandColor, boxShadow: `0 4px 12px ${brandColor}55` }
      : undefined;
  };

  // Helper function to build product card classes
  const getProductCardClass = (hasStock: boolean) => {
    return hasStock
      ? "cursor-pointer shadow-sm hover:border-[#bc9b7a] hover:shadow-md"
      : "cursor-not-allowed bg-red-50 opacity-75 shadow-sm";
  };

  // Helper function to build variant button classes
  const getVariantButtonClass = (isSelected: boolean, isOutOfStock: boolean) => {
    if (isOutOfStock) return "bg-red-50 border-red-300 text-red-700 opacity-75 cursor-not-allowed";
    if (isSelected) return "border-[#6c3030] bg-[#f3e3cf]";
    return "bg-white border-slate-300 hover:border-[#bc9b7a] hover:bg-[#f8f1e8]";
  };

  const pendingOrderCount = customerOrders.length;
  const isRecentOrder = (createdAt?: string) => {
    if (!createdAt) return false;
    const created = new Date(createdAt).getTime();
    return !Number.isNaN(created) && Date.now() - created < 1000 * 60 * 5;
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#f4f6f8] md:flex-row">
      {/* Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-slate-900">{modal.title}</h2>
            <p className="mb-6 text-slate-600">{modal.message}</p>
            <button
              onClick={() => {
                setModal({ ...modal, isOpen: false });
                modal.onConfirm?.();
              }}
              className="w-full px-4 py-2 font-semibold text-white"
              style={{ backgroundColor: brandColor }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showEditPasswordModal && editingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm border border-slate-200 bg-white p-6 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Admin authorization</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Save order changes</h2>
            <p className="mt-2 text-sm text-slate-500">Enter an admin account password to update this order.</p>
            <input
              type="password"
              value={editAdminPassword}
              onChange={(event) => setEditAdminPassword(event.target.value)}
              placeholder="Admin password"
              autoFocus
              autoComplete="current-password"
              className="mt-5 w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
            />
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowEditPasswordModal(false)} className="flex-1 border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  setShowEditPasswordModal(false);
                  void handleCheckout(editAdminPassword);
                }}
                disabled={!editAdminPassword || cart.some((item) => item.quantity === 0)}
                className="flex-1 bg-[#16834b] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#116b3d] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Sidebar */}
      <div className={`${showCategories ? "flex" : "hidden"} max-h-44 w-full flex-col overflow-hidden border-b border-[#6c3030] bg-[#35231d] text-white shadow-xl md:max-h-none md:w-40 md:shrink-0 md:border-b-0 md:border-r lg:w-56`}>
        <div className="border-b border-white/10 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">{userData?.role?.trim() || "User"} workspace</p>
          <h2 className="mt-1 truncate text-lg font-black">{shopInfo?.name || "BrewTrack"}</h2>
          <p className="mt-1 text-xs text-white/55">Build an order</p>
        </div>

        <div className="flex flex-1 gap-1 overflow-x-auto overflow-y-hidden p-3 md:block md:space-y-1 md:overflow-x-hidden md:overflow-y-auto">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`w-max shrink-0 px-3 py-2 text-left text-sm font-semibold transition-all md:w-full ${getCategoryButtonClass("all")}`}
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
                className={`w-max shrink-0 px-3 py-2 text-left text-sm font-medium capitalize transition-all md:w-full ${getCategoryButtonClass(String(category.id))}`}
                style={getCategoryButtonStyle(String(category.id))}
              >
                {category.name} ({count})
              </button>
            );
          })}
        </div>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-left text-sm font-semibold text-white/65 transition hover:bg-[#6c3030] hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Menu Section */}
        <div className="border-b border-slate-200 bg-[#f4f6f8] px-4 py-4 sm:px-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCategories((visible) => !visible)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                aria-label={showCategories ? "Hide categories" : "Show categories"}
              >
                <FiMenu size={18} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Order builder</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Menu</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/cashier/order-history")}
                className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <FiClock size={16} />
                <span className="hidden sm:inline">History</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCart((visible) => !visible)}
                className="inline-flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 md:inline-flex lg:hidden"
                aria-label={showCart ? "Hide cart" : "Show cart"}
              >
                <FiShoppingCart size={17} />
              </button>

            </div>
          </div>

          <div
            className={`mb-4 flex items-center justify-between gap-3 border px-4 py-3 transition-all ${
              pendingOrderCount > 0
                ? "border-red-200 bg-red-50 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  pendingOrderCount > 0 ? "animate-pulse bg-red-600" : "bg-slate-300"
                }`}
              />
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.2em] ${pendingOrderCount > 0 ? "text-red-700" : "text-slate-500"}`}>Incoming queue</p>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {pendingOrderCount > 0 ? `${pendingOrderCount} incoming order${pendingOrderCount > 1 ? "s" : ""} waiting` : "No incoming orders"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/cashier/incoming-orders")}
              className={`shrink-0 px-3 py-2 text-xs font-bold text-white transition ${
                pendingOrderCount > 0 ? "bg-red-600 hover:bg-red-700" : "bg-slate-500 hover:bg-slate-600"
              }`}
            >
              View Queue
            </button>
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
              className="w-full border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>

          {!showCategories && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`shrink-0 px-3 py-2 text-sm font-semibold transition-all ${getCategoryButtonClass("all")}`}
                style={getCategoryButtonStyle("all")}
              >
                All ({products.length})
              </button>
              {categories.map((category) => {
                const count = products.filter((product) => product.category_id === category.id).length;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(String(category.id))}
                    className={`shrink-0 px-3 py-2 text-sm font-medium capitalize transition-all ${getCategoryButtonClass(String(category.id))}`}
                    style={getCategoryButtonStyle(String(category.id))}
                  >
                    {category.name} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {filteredProducts.length === 0 ? (
            <div className="border border-slate-200 bg-white py-16 text-center">
              <div className="text-slate-400 text-4xl mx-auto mb-3 flex justify-center">
                <FiPackage />
              </div>
              <p className="text-lg text-slate-900 font-bold">No products found</p>
              <p className="text-slate-500 text-sm">Try a different search term or category</p>
            </div>
          ) : (
              <div className="space-y-8">
              {groupedProducts.map((category) => (
                <section key={category.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 capitalize">{category.name}</h2>
                    <span className="text-xs font-semibold text-slate-500">{category.products.length} items</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-4">
                    {category.products.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((variant) => getVariantStock(variant) > 0);
                      return (
                        <div
                          key={product.id}
                          onClick={() => hasStock && handleProductClick(product)}
                          className={`overflow-hidden transition-all ${getProductCardClass(hasStock || false)}`}
                        >
                          <div className="relative flex h-40 items-center justify-center overflow-hidden bg-slate-100">
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
                          <div className="p-4">
                            <h3 className="mb-2 line-clamp-2 text-base font-bold text-slate-900">{product.product_name}</h3>
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
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-4">
                    {uncategorizedProducts.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((variant) => getVariantStock(variant) > 0);
                      return (
                        <div
                          key={product.id}
                          onClick={() => hasStock && handleProductClick(product)}
                          className={`overflow-hidden transition-all ${getProductCardClass(hasStock || false)}`}
                        >
                          <div className="relative flex h-60 items-center justify-center overflow-hidden bg-slate-100">
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
                          <div className="p-4">
                            <h3 className="mb-2 line-clamp-2 text-base font-bold text-slate-900">{product.product_name}</h3>
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
          <div className="bg-white rounded-md shadow-xl w-full max-w-5xl p-6 max-h-[85vh] overflow-y-auto md:w-3/4 xl:w-1/2">
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
                  className={`w-full text-left p-3 rounded-md border transition-all ${getVariantButtonClass(
                    selectedVariant?.id === variant.id,
                    getVariantStock(variant) === 0
                  )}`}
                >
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-slate-900">{variant.name}</p>
                    <p className="font-bold" style={{ color: brandColor }}>₱{Number(variant.price)}</p>
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
                      onClick={(event) => {
                        if (isAddOnOutOfStock(addon)) event.preventDefault();
                      }}
                      className={`flex items-center gap-3 p-2 border rounded-md transition-all ${
                        isAddOnOutOfStock(addon)
                          ? "pointer-events-none cursor-not-allowed border-red-300 bg-red-50 text-red-700"
                          : "cursor-pointer border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!isAddOnOutOfStock(addon) && (selectedAddOns[addon.id] || false)}
                        onChange={(e) => {
                          if (isAddOnOutOfStock(addon)) return;
                          setSelectedAddOns((prev) => ({
                            ...prev,
                            [addon.id]: e.target.checked,
                          }));
                        }}
                        disabled={isAddOnOutOfStock(addon)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isAddOnOutOfStock(addon) ? "text-red-700" : "text-slate-900"}`}>{addon.name}</p>
                        <p className={`text-xs ${isAddOnOutOfStock(addon) ? "text-red-600" : "text-slate-500"}`}>
                          {addon.quantity} {addon.unit}{isAddOnOutOfStock(addon) && " (out of stock)"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: brandColor }}>+₱{Number(addon.price)}</p>
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
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                disabled={Object.entries(selectedAddOns).some(
                  ([addonId, selected]) => selected && isAddOnOutOfStock(
                    addOns.find((addon) => String(addon.id) === String(addonId)) || {
                      id: addonId,
                      name: "Selected add-on",
                      price: 0,
                      quantity: 0,
                      unit: "",
                    }
                  )
                )}
                onClick={() => {
                  if (!selectedVariant) {
                    showModal("error", "Select Variant", "Please select a variant first");
                    return;
                  }

                  const selectedAddOnsArray = Object.entries(selectedAddOns)
                    .filter(([_, selected]) => selected)
                    .map(([addonId]) => addOns.find((a) => String(a.id) === String(addonId)))
                    .filter((addon): addon is AddOn => Boolean(addon));

                  addToCart(selectedProduct, selectedVariant, selectedAddOnsArray);
                }}
                className="flex-1 px-4 py-2 text-white rounded-md transition-colors font-medium disabled:cursor-not-allowed disabled:bg-slate-300"
                style={{ backgroundColor: brandColor }}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      <div className={`${showCart ? "flex" : "hidden"} max-h-[45vh] w-full flex-col overflow-hidden border-t border-slate-200 bg-white md:max-h-none md:w-96 md:shrink-0 md:border-l md:border-t-0 lg:flex lg:w-[28rem]`}>
        <div className="border-b border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Current order</p>
              <h2 className="mt-1 flex items-center gap-2 text-xl font-black text-slate-950">
                <FiShoppingCart size={19} style={{ color: brandColor }} />
                Cart <span className="text-sm font-medium text-slate-400">({cart.length})</span>
              </h2>
            </div>
          </div>

          {/* Customer Name Input */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-bold text-slate-600">
              Customer Name <span className="text-red-300">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name..."
              className="w-full border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Special Requests */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">Special Requests (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., No sugar, extra syrup..."
              className="w-full resize-none border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
              rows={2}
            />
          </div>
          {editingOrderId && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-bold text-slate-600">
                Reason for Editing Order <span className="text-red-300">*</span>
              </label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why this order is being edited..."
                className="w-full resize-none border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                rows={2}
                required
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {cart.length === 0 ? (
            <div className="border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
              <div className="w-12 h-12 text-slate-300 mx-auto mb-3 flex justify-center">
                <FiShoppingCart size={24} />
              </div>
              <p className="text-base font-bold text-slate-600">Cart is empty</p>
              <p className="text-slate-400 text-xs">Add products to get started</p>
            </div>
          ) : (
            <>
              <div className="mb-4 divide-y divide-slate-200 border-y border-slate-200">
                {cart.map((item) => (
                  <div key={item.id} className="overflow-hidden bg-white">
                    <div className="py-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 text-sm">{item.product_name}</h4>
                          <p className="text-xs text-slate-600">{item.variant_name}</p>
                          {item.addOns.length > 0 && (
                            <div className="mt-2 border-l-2 border-amber-400 bg-amber-50 p-2">
                              <p className="text-[10px] uppercase tracking-[.18em] text-amber-700 font-semibold mb-1">Add-Ons</p>
                              <div className="space-y-1">
                                {item.addOns.map((addon) => (
                                  <p key={addon.id} className="text-xs text-amber-800">
                                    + {addon.name} · ₱{Number(addon.price).toFixed(2)}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          aria-label={`Remove ${item.product_name}`}
                          className="flex h-7 w-7 items-center justify-center text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>

                      <div className="mb-2 flex items-center gap-2 bg-slate-50 p-1.5">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          aria-label={`Decrease ${item.product_name} quantity`}
                          className="flex h-7 w-7 items-center justify-center bg-slate-200 text-slate-700 transition hover:bg-slate-300"
                        >
                          <FiMinus size={12} />
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => handleQuantityInputChange(item.id, e.target.value)}
                          className="w-full border border-slate-300 bg-white px-2 py-1 text-center font-bold text-slate-800"
                        />

                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          aria-label={`Increase ${item.product_name} quantity`}
                          className="flex h-7 w-7 items-center justify-center bg-slate-200 text-slate-700 transition hover:bg-slate-300"
                        >
                          <FiPlus size={12} />
                        </button>
                      </div>

                      <div className="mb-2 border-b border-slate-100 pb-2">
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
                      <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3">
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

                        {/* Add-ons */}
                        {addOns.length > 0 && (
                          <div className="border border-[#d6c3af] bg-white p-2">
                            <p className="text-xs font-bold text-slate-800 mb-2">Add-Ons</p>
                            <div className="space-y-1">
                              {addOns.map((addon) => {
                                const isSelected = item.addOns.some(
                                  (selectedAddon) => String(selectedAddon.id) === String(addon.id)
                                );
                                const isOutOfStock = isAddOnOutOfStock(addon);

                                return (
                                  <label
                                    key={addon.id}
                                    onClick={(event) => {
                                      if (isOutOfStock) event.preventDefault();
                                    }}
                                    className={`flex items-center gap-2 p-1.5 text-xs ${
                                      isOutOfStock ? "pointer-events-none cursor-not-allowed text-red-600" : "cursor-pointer text-slate-700"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      disabled={isOutOfStock}
                                      onChange={(event) => {
                                        setCart((currentCart) => currentCart.map((cartItem) => {
                                          if (cartItem.id !== item.id) return cartItem;
                                          const nextAddOns = event.target.checked
                                            ? [...cartItem.addOns, addon]
                                            : cartItem.addOns.filter(
                                                (selectedAddon) => String(selectedAddon.id) !== String(addon.id)
                                              );
                                          return { ...cartItem, addOns: nextAddOns };
                                        }));
                                      }}
                                      className="h-4 w-4 accent-[#6c3030]"
                                    />
                                    <span className="flex-1">
                                      {addon.name} (+₱{Number(addon.price).toFixed(2)})
                                      {isOutOfStock && <span className="ml-1 font-semibold">(out of stock)</span>}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Discount */}
                        <div className="border border-amber-200 bg-white p-2">
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
              <div className="mb-3 space-y-2 border-y border-slate-200 py-3">
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
              <div className="mb-3 border border-slate-200 bg-slate-50 p-3">
                <label className="mb-2 block text-sm font-bold text-slate-800">Amount Paid</label>
                <input
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Enter amount..."
                  className="w-full border border-slate-300 bg-white px-3 py-2 text-lg font-bold focus:outline-none"
                  style={{ borderColor: brandColor }}
                />
                {amountPaid && !isNaN(parseFloat(amountPaid)) && (
                  <div
                    className={`mt-2 flex justify-between p-2 text-sm font-bold text-white ${
                      parseFloat(amountPaid) >= calculateTotal() ? "bg-green-600" : "bg-red-600"
                    }`}
                  >
                    <span>{parseFloat(amountPaid) >= calculateTotal() ? "Change:" : "Need more:"}</span>
                    <span>₱{Math.abs(parseFloat(amountPaid) - calculateTotal()).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Checkout */}
              {cart.some((item) => item.quantity === 0) && (
                <div className="mb-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  Some items have zero quantity and cannot be ordered. Update or remove them to continue.
                </div>
              )}

              <button
                onClick={() => handleCheckout()}
                disabled={cart.length === 0 || !customerName.trim() || cart.some((item) => item.quantity === 0)}
                className="w-full bg-[#16834b] py-3 font-bold text-white transition-all hover:bg-[#116b3d] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {editingOrderId ? "Save Changes" : "Checkout"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
