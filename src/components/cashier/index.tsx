"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { FiShoppingCart, FiSearch, FiX, FiTrash2, FiPlus, FiMinus, FiArrowLeft, FiPackage, FiMenu, FiClock } from "react-icons/fi";
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
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [orderType, setOrderType] = useState<"dine-in" | "takeout">("dine-in");
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, boolean>>({});
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(true);
  const [showCart, setShowCart] = useState(true);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [originalEditState, setOriginalEditState] = useState<{
    cart: CartItem[];
    customerName: string;
    notes: string;
    editReason: string;
    amountPaid: string;
    paymentMethod: "cash" | "online";
    paymentReference: string;
  } | null>(null);
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
  const brandColor = "#C98A84";

  const getProductVariants = (product: Product) => product.variants ?? product.tbl_product_variants ?? [];

  const getVariantStock = (variant: Variant) => Number(variant.quantity ?? 0);

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
            .map((product: Product) => ({ ...product }))
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
        discount_type: item.discount_type || "none",
        discount: Number(item.discount) || 0,
        addOns: [],
        orderType: order.order_type === "takeout" ? "takeout" : "dine-in",
      }));

      setEditingOrderId(String(order.id));
      setCart(editItems);
      setCustomerName(order.customer_name || "Walk-in");
      setNotes(order.notes || "");
      setEditReason(order.edit_reason || "");
      setOriginalEditState({
        cart: editItems.map((item) => ({ ...item, addOns: [...item.addOns] })),
        customerName: order.customer_name || "Walk-in",
        notes: order.notes || "",
        editReason: order.edit_reason || "",
        amountPaid: order.paid === undefined || order.paid === null ? "" : String(order.paid),
        paymentMethod: order.payment_method === "online" ? "online" : "cash",
        paymentReference: order.payment_reference || "",
      });
      setAmountPaid(order.paid === undefined || order.paid === null ? "" : String(order.paid));
      setPaymentMethod(order.payment_method === "online" ? "online" : "cash");
      setPaymentReference(order.payment_reference || "");
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

  const cancelEdit = () => {
    if (originalEditState) {
      setCart(originalEditState.cart.map((item) => ({ ...item, addOns: [...item.addOns] })));
      setCustomerName(originalEditState.customerName);
      setNotes(originalEditState.notes);
      setEditReason(originalEditState.editReason);
      setAmountPaid(originalEditState.amountPaid);
      setPaymentMethod(originalEditState.paymentMethod);
      setPaymentReference(originalEditState.paymentReference);
    }
    setEditingOrderId(null);
    setOriginalEditState(null);
    sessionStorage.removeItem("cashierEditOrder");
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

    if (!customerName.trim()) {
      showModal("error", "Customer Name Required", "Please enter customer name");
      return;
    }

    if (paymentMethod === "online" && !paymentReference.trim()) {
      showModal("error", "Payment Reference Required", "Please enter the online payment reference.");
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
            payment_method: paymentMethod,
            payment_reference: paymentMethod === "online" ? paymentReference.trim() : null,
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
            payment_method: paymentMethod,
            payment_reference: paymentMethod === "online" ? paymentReference.trim() : null,
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
        setPaymentMethod("cash");
        setPaymentReference("");
        setCustomerName("");
        setNotes("");
        setEditingOrderId(null);
        setEditAdminPassword("");
        setEditReason("");
      });
    } catch (error: any) {
      console.error("Checkout error:", error);
      const message = error.message || "Failed to create order";
      showModal(
        "error",
        message.startsWith("Not enough inventory.") || message.startsWith("Not enough ingredients.")
          ? "Not Enough Ingredients"
          : "Checkout Failed",
        message
      );
      if (editingOrderId && originalEditState) {
        setCart(originalEditState.cart.map((item) => ({ ...item, addOns: [...item.addOns] })));
        setCustomerName(originalEditState.customerName);
        setNotes(originalEditState.notes);
        setEditReason(originalEditState.editReason);
        setAmountPaid(originalEditState.amountPaid);
      }
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
    return selectedCategory === categoryId
      ? "bg-[#C98A84] text-white shadow-sm"
      : "bg-white/70 text-[#796E6B] hover:bg-white hover:text-[#2D2626]";
  };

  const getCategoryButtonStyle = (categoryId: string) => {
    return selectedCategory === categoryId
      ? { backgroundColor: brandColor, boxShadow: "0 4px 12px #C98A8433" }
      : undefined;
  };

  // Helper function to build product card classes
  const getProductCardClass = (hasStock: boolean) => {
    return hasStock
      ? "cursor-pointer border border-[#E9DEDA] bg-white shadow-[0_4px_18px_rgba(74,49,44,0.05)] hover:-translate-y-0.5 hover:border-[#C98A84] hover:shadow-[0_10px_24px_rgba(74,49,44,0.10)]"
      : "cursor-not-allowed border border-red-200 bg-red-50 opacity-75 shadow-sm";
  };

  // Helper function to build variant button classes
  const getVariantButtonClass = (isSelected: boolean, isOutOfStock: boolean) => {
    if (isOutOfStock) return "bg-red-50 border-red-300 text-red-700 opacity-75 cursor-not-allowed";
    if (isSelected) return "border-[#C98A84] bg-[#FBF2F0]";
    return "bg-white border-[#E9DEDA] hover:border-[#C98A84] hover:bg-[#FBF2F0]";
  };

  const pendingOrderCount = customerOrders.length;
  const isRecentOrder = (createdAt?: string) => {
    if (!createdAt) return false;
    const created = new Date(createdAt).getTime();
    return !Number.isNaN(created) && Date.now() - created < 1000 * 60 * 5;
  };

  if (loading || !userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF6F4]">
        <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#C98A84]"></div>
        <p className="text-[#796E6B]">Loading cashier interface...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#FAF6F4] text-[#2D2626] md:flex-row">
      {/* Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2626]/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#E9DEDA] bg-[#FFFCFA] p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-bold text-[#2D2626]">{modal.title}</h2>
            <p className="mb-6 text-[#796E6B]">
              {modal.message}
            </p>
            <button
              onClick={() => {
                setModal({ ...modal, isOpen: false });
                modal.onConfirm?.();
              }}
              className="min-h-12 w-full rounded-xl bg-[#C98A84] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#B97873]"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showEditPasswordModal && editingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#E9DEDA] bg-[#FFFCFA] p-6 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A65F58]">Order edit authorization</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Save order changes</h2>
            <p className="mt-2 text-sm text-slate-500">Enter an administrator password to authorize this order edit.</p>
            <input
              type="password"
              value={editAdminPassword}
              onChange={(event) => setEditAdminPassword(event.target.value)}
              placeholder="Admin password"
              autoFocus
              autoComplete="current-password"
              className="mt-5 w-full rounded-xl border border-[#E9DEDA] px-3 py-2.5 text-sm outline-none focus:border-[#C98A84] focus:ring-2 focus:ring-[#C98A84]/20"
            />
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowEditPasswordModal(false)} className="min-h-12 flex-1 rounded-xl border border-[#E9DEDA] px-4 py-2.5 text-sm font-bold text-[#796E6B] hover:bg-[#F6EFEC]">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  setShowEditPasswordModal(false);
                  void handleCheckout(editAdminPassword);
                }}
                disabled={!editAdminPassword || cart.some((item) => item.quantity === 0)}
                className="min-h-12 flex-1 rounded-xl bg-[#C98A84] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#B97873] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Sidebar */}
      <div className={`${showCategories ? "flex max-h-36 w-full md:max-h-none md:w-56" : "hidden md:flex md:w-20"} shrink-0 flex-col overflow-hidden border-b border-[#E2D6D2] bg-[#ECE6E2] text-[#2D2626] shadow-[0_8px_24px_rgba(74,49,44,0.06)] md:border-b-0 md:border-r md:border-[#E2D6D2] md:py-3`}>
        <div className="border-b border-[#DCD0CC] p-3 md:px-3 md:py-4">
          <button
            type="button"
            onClick={() => setShowCategories((visible) => !visible)}
            aria-label={showCategories ? "Collapse categories sidebar" : "Expand categories sidebar"}
            aria-expanded={showCategories}
            title={showCategories ? "Collapse menu" : "Expand menu"}
            className={`flex min-h-12 w-full items-center gap-3 rounded-xl text-left transition hover:bg-white/70 ${showCategories ? "px-2.5" : "justify-center px-1"}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C98A84] text-white shadow-sm">
              <FiPackage size={20} />
            </span>
            {showCategories && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{shopInfo?.name || "BrewTrack"}</span>
                <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-[#8D7E79]">
                  {userData?.role?.trim() || "User"} register
                </span>
              </span>
            )}
          </button>
        </div>

        {showCategories && (
          <div className="flex flex-1 gap-1 overflow-x-auto overflow-y-hidden p-3 md:block md:space-y-1 md:overflow-x-hidden md:overflow-y-auto">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`min-h-11 w-max shrink-0 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-all md:w-full ${getCategoryButtonClass("all")}`}
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
                  className={`min-h-11 w-max shrink-0 rounded-xl px-3 py-2 text-left text-sm font-medium capitalize transition-all md:w-full ${getCategoryButtonClass(String(category.id))}`}
                  style={getCategoryButtonStyle(String(category.id))}
                >
                  {category.name} ({count})
                </button>
              );
            })}
          </div>
        )}

        <div className="border-t border-[#DCD0CC] p-3">
          <button
            onClick={handleLogout}
            title="Logout"
            className={`min-h-11 w-full rounded-xl px-3 py-2 text-sm font-semibold text-[#796E6B] transition hover:bg-white/80 hover:text-[#2D2626] ${showCategories ? "text-left" : "text-center"}`}
          >
            {showCategories ? "Log out" : <FiArrowLeft className="mx-auto rotate-180" size={18} />}
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Menu Section */}
        <div className="border-b border-[#E9DEDA] bg-[#FAF6F4] px-4 py-4 sm:px-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCategories((visible) => !visible)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E9DEDA] bg-white text-[#A76560] shadow-sm transition hover:bg-[#FBF2F0]"
                aria-label={showCategories ? "Hide categories" : "Show categories"}
              >
                <FiMenu size={18} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A08F89]">Point of sale</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#2D2626]">Register</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/cashier/order-history")}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E9DEDA] bg-white px-3 py-2 text-sm font-bold text-[#796E6B] shadow-sm transition hover:bg-[#FBF2F0] hover:text-[#A76560]"
              >
                <FiClock size={16} />
                <span className="hidden sm:inline">History</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCart((visible) => !visible)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#E9DEDA] bg-white text-[#A76560] shadow-sm transition hover:bg-[#FBF2F0] md:inline-flex lg:hidden"
                aria-label={showCart ? "Hide cart" : "Show cart"}
              >
                <FiShoppingCart size={17} />
              </button>

            </div>
          </div>

          <div
            className={`mb-4 flex items-center justify-between gap-3 border px-4 py-3 transition-all ${
              pendingOrderCount > 0
                ? "rounded-xl border-red-200 bg-red-50 shadow-sm"
                  : "rounded-xl border-[#E9DEDA] bg-white shadow-sm"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  pendingOrderCount > 0 ? "animate-pulse bg-[#C98A84]" : "bg-[#D8CCC8]"
                }`}
              />
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.2em] ${pendingOrderCount > 0 ? "text-[#A76560]" : "text-[#8D7E79]"}`}>Incoming queue</p>
                <p className="truncate text-sm font-semibold text-[#4D413E]">
                  {pendingOrderCount > 0 ? `${pendingOrderCount} incoming order${pendingOrderCount > 1 ? "s" : ""} waiting` : "No incoming orders"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/cashier/incoming-orders")}
              className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition ${
                pendingOrderCount > 0 ? "bg-[#C98A84] hover:bg-[#B97873]" : "bg-[#8D7E79] hover:bg-[#796E6B]"
              }`}
            >
              View Queue
            </button>
          </div>

          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A08F89]">
              <FiSearch size={18} />
            </div>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-[#E9DEDA] bg-white py-2 pl-10 pr-3 text-sm text-[#2D2626] placeholder:text-[#A08F89] shadow-sm focus:border-[#C98A84] focus:ring-2 focus:ring-[#C98A84]/20 focus:outline-none"
            />
          </div>

          {!showCategories && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${getCategoryButtonClass("all")}`}
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
                    className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-medium capitalize transition-all ${getCategoryButtonClass(String(category.id))}`}
                    style={getCategoryButtonStyle(String(category.id))}
                  >
                    {category.name} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-[#FAF6F4] px-4 py-5 sm:px-5">
          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-[#E9DEDA] bg-white py-16 text-center shadow-sm">
              <div className="mx-auto mb-3 flex justify-center text-4xl text-[#C3B4AF]">
                <FiPackage />
              </div>
              <p className="text-lg font-bold text-[#2D2626]">No products found</p>
              <p className="text-sm text-[#8D7E79]">Try a different search term or category</p>
            </div>
          ) : (
              <div className="space-y-8">
              {groupedProducts.map((category) => (
                <section key={category.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold capitalize text-[#2D2626]">{category.name}</h2>
                    <span className="text-xs font-semibold text-[#8D7E79]">{category.products.length} items</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {category.products.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((variant) => getVariantStock(variant) > 0);
                      return (
                        <div
                          key={product.id}
                          onClick={() => hasStock && handleProductClick(product)}
                          className={`overflow-hidden rounded-2xl transition-all ${getProductCardClass(hasStock || false)}`}
                        >
                          <div className="relative flex h-32 items-center justify-center overflow-hidden bg-[#F3ECE9] sm:h-36">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.product_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="text-3xl text-[#C3B4AF]">
                                <FiPackage />
                              </div>
                            )}
                            {!hasStock && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="rounded bg-[#DC2626] px-3 py-1 text-xs font-bold text-white">
                                  OUT OF STOCK
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="min-h-24 p-3 sm:p-4">
                            <h3 className="mb-2 line-clamp-2 text-sm font-bold text-[#2D2626] sm:text-base">{product.product_name}</h3>
                            {variants.length > 0 && (
                              <div>
                                {variants.length === 1 ? (
                                  <p className="font-bold text-[#A76560]">₱{Number(variants[0].price).toFixed(2)}</p>
                                ) : (
                                  <p className="font-bold text-[#A76560]">
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
                    <h2 className="text-lg font-bold text-[#2D2626]">Uncategorized</h2>
                    <span className="text-xs font-semibold text-slate-500">{uncategorizedProducts.length} items</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {uncategorizedProducts.map((product) => {
                      const variants = getProductVariants(product);
                      const hasStock = variants.some((variant) => getVariantStock(variant) > 0);
                      return (
                        <div
                          key={product.id}
                          onClick={() => hasStock && handleProductClick(product)}
                          className={`overflow-hidden rounded-2xl transition-all ${getProductCardClass(hasStock || false)}`}
                        >
                          <div className="relative flex h-32 items-center justify-center overflow-hidden bg-[#F3ECE9] sm:h-36">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.product_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="text-3xl text-[#C3B4AF]">
                                <FiPackage />
                              </div>
                            )}
                            {!hasStock && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="rounded bg-[#DC2626] px-3 py-1 text-xs font-bold text-white">
                                  OUT OF STOCK
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="min-h-24 p-3 sm:p-4">
                            <h3 className="mb-2 line-clamp-2 text-sm font-bold text-[#2D2626] sm:text-base">{product.product_name}</h3>
                            {variants.length > 0 && (
                              <div>
                                {variants.length === 1 ? (
                                  <p className="font-bold text-[#A76560]">₱{Number(variants[0].price).toFixed(2)}</p>
                                ) : (
                                  <p className="font-bold text-[#A76560]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2626]/35 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[#E9DEDA] bg-[#FFFCFA] p-5 shadow-2xl sm:p-6 md:w-3/4 xl:w-1/2">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-[#2D2626]">{selectedProduct.product_name}</h3>
                <p className="text-sm text-[#8D7E79]">Select a variant</p>
              </div>
              <button
                onClick={() => {
                  setShowVariantModal(false);
                  setSelectedProduct(null);
                  setSelectedVariant(null);
                  setSelectedAddOns({});
                }}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#8D7E79] hover:bg-[#F3ECE9] hover:text-[#2D2626]"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="mb-6 space-y-2">
              {getProductVariants(selectedProduct).map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant)}
                  disabled={getVariantStock(variant) === 0}
                  className={`min-h-14 w-full rounded-xl border p-4 text-left transition-all ${getVariantButtonClass(
                    selectedVariant?.id === variant.id,
                    getVariantStock(variant) === 0
                  )}`}
                >
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-[#2D2626]">{variant.name}</p>
                    <p className="font-bold" style={{ color: brandColor }}>₱{Number(variant.price)}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Add-ons Selection */}
            {addOns.length > 0 && (
              <div className="mb-6 border-t border-[#E9DEDA] pt-6">
                <h4 className="mb-3 text-sm font-bold text-[#2D2626]">Add-Ons (Optional)</h4>
                <div className="space-y-2">
                  {addOns.map((addon) => (
                    <label
                      key={addon.id}
                      onClick={(event) => {
                        if (isAddOnOutOfStock(addon)) event.preventDefault();
                      }}
                      className={`flex min-h-12 items-center gap-3 rounded-xl border p-3 transition-all ${
                        isAddOnOutOfStock(addon)
                          ? "pointer-events-none cursor-not-allowed border-red-300 bg-red-50 text-red-700"
                          : "cursor-pointer border-[#E9DEDA] hover:bg-[#FBF2F0]"
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
                        className="h-5 w-5 accent-[#C98A84]"
                      />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isAddOnOutOfStock(addon) ? "text-red-700" : "text-[#2D2626]"}`}>{addon.name}</p>
                        <p className={`text-xs ${isAddOnOutOfStock(addon) ? "text-red-600" : "text-[#8D7E79]"}`}>
                          {addon.quantity} {addon.unit}{isAddOnOutOfStock(addon) && " (out of stock)"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: brandColor }}>+₱{Number(addon.price)}</p>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 border-t border-[#E9DEDA] pt-6">
              <button
                onClick={() => {
                  setShowVariantModal(false);
                  setSelectedProduct(null);
                  setSelectedVariant(null);
                  setSelectedAddOns({});
                }}
                className="min-h-12 flex-1 rounded-xl bg-[#ECE6E2] px-4 py-2 font-medium text-[#796E6B] transition-colors hover:bg-[#E2D9D5]"
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
                className="min-h-12 flex-1 rounded-xl bg-[#C98A84] px-4 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-[#B97873] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      <div className={`${showCart ? "flex" : "hidden"} max-h-[45vh] w-full shrink-0 flex-col overflow-hidden border-t border-[#E9DEDA] bg-[#FFFCFA] shadow-[0_0_24px_rgba(74,49,44,0.06)] md:max-h-none md:w-[22rem] md:border-l md:border-t-0 xl:w-[26rem] lg:flex`}>
        <div className="border-b border-[#E9DEDA] bg-[#FFFCFA] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A08F89]">Current order</p>
              <h2 className="mt-1 flex items-center gap-2 text-xl font-black text-[#2D2626]">
                <FiShoppingCart size={19} className="text-[#C98A84]" />
                Ticket <span className="text-sm font-medium text-[#A08F89]">({cart.length})</span>
              </h2>
            </div>
          </div>

          {/* Customer Name Input */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-bold text-[#796E6B]">
              Customer Name <span className="text-red-300">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name..."
              className="min-h-11 w-full rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] px-3 py-2 text-sm text-[#2D2626] placeholder:text-[#A08F89] focus:border-[#C98A84] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C98A84]/20"
            />
          </div>

          {/* Special Requests */}
          <div>
            <label className="mb-1 block text-xs font-bold text-[#796E6B]">Special Requests (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., No sugar, extra syrup..."
              className="w-full resize-none rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] px-3 py-2 text-sm text-[#2D2626] placeholder:text-[#A08F89] focus:border-[#C98A84] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C98A84]/20"
              rows={2}
            />
          </div>
          {editingOrderId && (
            <div className="mt-3">
              <button
                type="button"
                onClick={cancelEdit}
                className="mb-2 min-h-10 rounded-xl border border-[#C98A84] px-3 py-2 text-xs font-bold text-[#9E625D] hover:bg-[#F6EFEC]"
              >
                Cancel Editing
              </button>
              <label className="mb-1 block text-xs font-bold text-[#796E6B]">
                Reason for Editing Order <span className="text-red-300">*</span>
              </label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why this order is being edited..."
                className="w-full resize-none rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] px-3 py-2 text-sm text-[#2D2626] placeholder:text-[#A08F89] focus:border-[#C98A84] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C98A84]/20"
                rows={2}
                required
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {cart.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E9DEDA] bg-[#FAF6F4] py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 justify-center text-[#C3B4AF]">
                <FiShoppingCart size={24} />
              </div>
              <p className="text-base font-bold text-[#4D413E]">Ticket is empty</p>
              <p className="text-xs text-[#A08F89]">Tap a product to get started</p>
            </div>
          ) : (
            <>
              <div className="mb-4 divide-y divide-[#EEE5E1]">
                {cart.map((item) => (
                  <div key={item.id} className="overflow-hidden bg-[#FFFCFA]">
                    <div className="py-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-[#2D2626]">{item.product_name}</h4>
                          <p className="text-xs text-[#8D7E79]">{item.variant_name}</p>
                          {item.addOns.length > 0 && (
                            <div className="mt-2 rounded-lg border-l-2 border-[#C98A84] bg-[#FBF2F0] p-2">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-[#A76560]">Add-Ons</p>
                              <div className="space-y-1">
                                {item.addOns.map((addon) => (
                                  <p key={addon.id} className="text-xs text-[#796E6B]">
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
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-red-50 hover:text-[#DC2626]"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>

                      <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#ECE6E2] p-1.5">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          aria-label={`Decrease ${item.product_name} quantity`}
                          className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#796E6B] shadow-sm transition hover:bg-[#FBF2F0] hover:text-[#A76560]"
                        >
                          <FiMinus size={12} />
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => handleQuantityInputChange(item.id, e.target.value)}
                          className="min-h-11 w-full rounded-lg border border-[#E9DEDA] bg-white px-2 py-1 text-center font-bold text-[#2D2626] focus:border-[#C98A84] focus:outline-none"
                        />

                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          aria-label={`Increase ${item.product_name} quantity`}
                          className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#796E6B] shadow-sm transition hover:bg-[#FBF2F0] hover:text-[#A76560]"
                        >
                          <FiPlus size={12} />
                        </button>
                      </div>

                      <div className="mb-2 border-b border-[#F0E7E3] pb-2">
                        <p className="flex justify-between text-xs">
                          <span className="text-[#8D7E79]">Item Total:</span>
                          <span className="font-bold text-[#2D2626]">
                            ₱{((item.price - (item.discount || 0)) * item.quantity).toFixed(2)}
                          </span>
                        </p>
                      </div>

                      <button
                        onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                        className="min-h-10 w-full rounded-lg py-1 text-center text-xs font-bold text-[#A76560] hover:bg-[#FBF2F0]"
                      >
                        {expandedItem === item.id ? "Hide Options" : "More Options"}
                      </button>
                    </div>

                    {expandedItem === item.id && (
                      <div className="space-y-3 border-t border-[#E9DEDA] bg-[#F7F1EE] p-3">
                        {/* Order Type */}
                        <div>
                          <p className="mb-2 text-xs font-bold text-[#4D413E]">Order Type</p>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#E9DEDA] bg-white px-3 text-sm text-[#796E6B]">
                              <input
                                type="radio"
                                name={`orderType-${item.id}`}
                                checked={item.orderType === "dine-in"}
                                onChange={() => {
                                  setCart(
                                    cart.map((i) => (i.id === item.id ? { ...i, orderType: "dine-in" } : i))
                                  );
                                }}
                                className="h-4 w-4 accent-[#C98A84]"
                              />
                              <span>Dine In</span>
                            </label>
                            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#E9DEDA] bg-white px-3 text-sm text-[#796E6B]">
                              <input
                                type="radio"
                                name={`orderType-${item.id}`}
                                checked={item.orderType === "takeout"}
                                onChange={() => {
                                  setCart(cart.map((i) => (i.id === item.id ? { ...i, orderType: "takeout" } : i)));
                                }}
                                className="h-4 w-4 accent-[#C98A84]"
                              />
                              <span>Takeout</span>
                            </label>
                          </div>
                        </div>

                        {/* Add-ons */}
                        {addOns.length > 0 && (
                          <div className="rounded-xl border border-[#E9DEDA] bg-white p-2">
                            <p className="mb-2 text-xs font-bold text-[#4D413E]">Add-Ons</p>
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
                                      className="h-4 w-4 accent-[#C98A84]"
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
                        <div className="rounded-xl border border-[#E9DEDA] bg-white p-2">
                          <p className="mb-2 text-xs font-bold text-[#4D413E]">Item Discount</p>
                          <div className="grid grid-cols-1 gap-1.5">
                            <label className="flex min-h-10 items-center gap-2 rounded-lg bg-[#FAF6F4] px-3 text-sm text-[#796E6B]">
                              <input
                                type="radio"
                                name={`discount-${item.id}`}
                                checked={item.discount_type === "none" || !item.discount_type}
                                onChange={() => updateItemDiscount(item.id, "none")}
                                className="h-4 w-4 accent-[#C98A84]"
                              />
                              <span>No Discount</span>
                            </label>
                            <label className="flex min-h-10 items-center gap-2 rounded-lg bg-[#FAF6F4] px-3 text-sm text-[#796E6B]">
                              <input
                                type="radio"
                                name={`discount-${item.id}`}
                                checked={item.discount_type === "senior"}
                                onChange={() => updateItemDiscount(item.id, "senior")}
                                className="h-4 w-4 accent-[#C98A84]"
                              />
                              <span>Senior Citizen (-₱5)</span>
                            </label>
                            <label className="flex min-h-10 items-center gap-2 rounded-lg bg-[#FAF6F4] px-3 text-sm text-[#796E6B]">
                              <input
                                type="radio"
                                name={`discount-${item.id}`}
                                checked={item.discount_type === "pwd"}
                                onChange={() => updateItemDiscount(item.id, "pwd")}
                                className="h-4 w-4 accent-[#C98A84]"
                              />
                              <span>PWD (-₱5)</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mb-3 space-y-2 rounded-xl bg-[#ECE6E2] p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[#796E6B]">Subtotal</span>
                  <span className="font-semibold text-[#4D413E]">₱{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-[#D8CCC8] pt-3 text-lg font-black">
                  <span>Total:</span>
                  <span style={{ color: brandColor }}>₱{calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Input */}
              <div className="mb-3 rounded-2xl border border-[#E9DEDA] bg-[#FAF6F4] p-3">
                <label className="mb-2 block text-sm font-bold text-[#4D413E]">Mode of Payment</label>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  {(["cash", "online"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`min-h-11 rounded-xl border px-3 text-sm font-bold capitalize transition ${
                        paymentMethod === method
                          ? "border-[#C98A84] bg-[#C98A84] text-white"
                          : "border-[#E9DEDA] bg-white text-[#796E6B] hover:border-[#C98A84]"
                      }`}
                    >
                      {method === "online" ? "Online payment" : "Cash"}
                    </button>
                  ))}
                </div>
                <label className="mb-2 block text-sm font-bold text-[#4D413E]">
                  {paymentMethod === "online" ? "Amount Received" : "Amount Paid"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Enter amount..."
                  className="min-h-14 w-full rounded-xl border border-[#E9DEDA] bg-white px-3 py-2 text-right text-2xl font-black text-[#2D2626] placeholder:text-base placeholder:font-normal placeholder:text-[#B7A8A3] focus:border-[#C98A84] focus:outline-none focus:ring-2 focus:ring-[#C98A84]/20"
                  style={{ borderColor: brandColor }}
                />
                {paymentMethod === "online" && (
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder="Enter payment reference"
                    className="mt-3 min-h-12 w-full rounded-xl border border-[#E9DEDA] bg-white px-3 text-sm text-[#2D2626] outline-none focus:border-[#C98A84] focus:ring-2 focus:ring-[#C98A84]/20"
                  />
                )}
                {paymentMethod === "cash" && amountPaid && !isNaN(parseFloat(amountPaid)) && (
                  <div
                    className={`mt-2 flex justify-between rounded-lg p-2 text-sm font-bold ${
                      parseFloat(amountPaid) >= calculateTotal()
                        ? "bg-[#E5F1E9] text-[#477259]"
                        : "bg-[#F5E7E5] text-[#A65F58]"
                    }`}
                  >
                    <span>{parseFloat(amountPaid) >= calculateTotal() ? "Change:" : "Need more:"}</span>
                    <span>₱{Math.abs(parseFloat(amountPaid) - calculateTotal()).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Checkout */}
              {cart.some((item) => item.quantity === 0) && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-[#DC2626]">
                  Some items have zero quantity and cannot be ordered. Update or remove them to continue.
                </div>
              )}

              <button
                onClick={() => handleCheckout()}
                disabled={cart.length === 0 || !customerName.trim() || cart.some((item) => item.quantity === 0)}
                className="min-h-14 w-full rounded-xl bg-[#C98A84] py-3 text-base font-black text-white shadow-[0_8px_18px_rgba(201,138,132,0.28)] transition-all hover:bg-[#B97873] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
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
