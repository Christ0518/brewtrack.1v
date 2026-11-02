"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { getShopTheme } from "@/lib/theme";
import {
  FiBarChart2,
  FiBox,
  FiCreditCard,
  FiGrid,
  FiLayers,
  FiLogOut,
  FiMenu,
  FiSettings,
  FiX,
} from "react-icons/fi";

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [shopName, setShopName] = useState("Shop");
  const [shopLogo, setShopLogo] = useState("");
  const [shopColor, setShopColor] = useState("#6c3030");
  const [shopId, setShopId] = useState<string | null>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [user, setUser] = useState<{
    name?: string;
    first_name?: string;
    last_name?: string;
    role?: string;
  } | null>(null);

  useEffect(() => {
    const storedShop = localStorage.getItem("shopName");
    const storedLogo = localStorage.getItem("shopLogo");
    const storedShopId = localStorage.getItem("shopId");
    const storedColor = localStorage.getItem("shopColor");
    const storedUser = localStorage.getItem("user");
    const theme = getShopTheme(storedShopId || "1");

    if (storedShop) setShopName(storedShop);
    if (storedLogo) setShopLogo(storedLogo);
    setShopId(storedShopId || "1");
    setShopColor(storedShopId === "1" ? theme.accentColor : storedColor || theme.accentColor);
    if (storedUser && storedUser !== "undefined") {
      try {
        const storedUserData = JSON.parse(storedUser);
        const role = storedUserData.role ?? storedUserData.user_role ?? storedUserData.userRole;
        setUser({ ...storedUserData, role: typeof role === "string" ? role.trim().toLowerCase() : undefined });
      } catch (error) {
        console.error("Failed to parse user data in sidebar:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!shopId) return;

    let cancelled = false;
    const loadLowStockCount = async () => {
      try {
        const response = await fetch(`${api_links.tbl_ingredients}?shop_id=${shopId}`, {
          headers: { "x-shop-id": shopId },
        });
        if (!response.ok) {
          throw new Error(`Ingredient request failed with status ${response.status}`);
        }

        const ingredients: unknown = await response.json();
        if (!Array.isArray(ingredients)) {
          throw new Error("Ingredient response was not a list");
        }

        const count = ingredients.filter(
          (ingredient) => Number(ingredient?.quantity || 0) <= 5
        ).length;
        if (!cancelled) setLowStockCount(count);
      } catch (error) {
        if (!cancelled) console.error("Failed to load low-stock ingredient count:", error);
      }
    };

    loadLowStockCount();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const menuItems = [
    { name: "Dashboard", path: "/dashboard", icon: FiGrid },
    { name: "Products", path: "/dashboard/products", icon: FiBox },
    { name: "Ingredients", path: "/dashboard/ingredients", icon: FiLayers },
    { name: "Reports", path: "/dashboard/reports", icon: FiBarChart2 },
    { name: "Transactions", path: "/dashboard/transactions", icon: FiCreditCard },
    { name: "Settings", path: "/dashboard/settings", icon: FiSettings },
  ];

  const handleLogout = async () => {
    try {
      await Fetch_to(api_links.jwt.deauth);
      localStorage.removeItem("shopId");
      localStorage.removeItem("shopName");
      localStorage.removeItem("shopLogo");
      localStorage.removeItem("shopColor");
      localStorage.removeItem("user");
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E9DFDB] bg-[#FAF6F4] text-[#514441] shadow-md transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84] lg:hidden"
        aria-label="Open navigation menu"
        aria-expanded={isMobileOpen}
        aria-controls="primary-navigation"
      >
        <FiMenu aria-hidden="true" className="h-5 w-5" />
      </button>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#2D2626]/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-dvh flex-col border-r border-[#E9DFDB] bg-[#FAF6F4] shadow-xl transition-[width,transform] duration-200 ease-out lg:z-30 lg:translate-x-0 lg:shadow-sm ${
          isExpanded ? "w-64" : "w-20"
        } ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Primary navigation"
      >
        <div className={`relative flex min-h-[76px] shrink-0 items-center border-b border-[#E9DFDB] ${isExpanded ? "gap-3 px-4" : "justify-center px-3"}`}>
          <button
            type="button"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84]"
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={isExpanded}
            aria-controls="primary-navigation"
            title={isExpanded ? "Collapse navigation" : "Expand navigation"}
          >
            {shopLogo ? (
              <img src={shopLogo} alt="" className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: shopColor }}>
                {shopName.split(" ").map((word) => word[0]).join("").slice(0, 2) || "S"}
              </span>
            )}
          </button>
          {isExpanded && (
            <Link
              href="/dashboard"
              onClick={() => setIsMobileOpen(false)}
              className="min-w-0 flex-1 truncate rounded-lg text-base font-bold text-[#2D2626] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84]"
            >
              {shopName}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#8A7C78] transition-colors hover:bg-[#ECE6E2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84] lg:hidden"
            aria-label="Close navigation menu"
          >
            <FiX aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        {isExpanded && user && (
          <div className="shrink-0 border-b border-[#E9DFDB] bg-[#F3ECE8] px-4 py-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: shopColor }}
              >
                {(user.first_name || user.name || "U")[0]}{user.last_name?.[0] || ""}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[#2D2626]">
                  {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.name || "User"}
                </div>
                <div className="text-xs capitalize text-[#8A7C78]">{user.role}</div>
              </div>
            </div>
          </div>
        )}

        <nav id="primary-navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {menuItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(`${item.path}/`));
            return (
              <Link
                key={item.name}
                href={item.path}
                onClick={() => {
                  setIsMobileOpen(false);
                }}
                className={`group relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84] ${
                  isActive
                    ? "bg-[#C98A84] text-white shadow-sm shadow-[#C98A84]/20"
                    : "text-[#796E6B] hover:bg-[#ECE6E2] hover:text-[#514441]"
                } ${!isExpanded ? "justify-center" : ""}`}
                title={!isExpanded ? item.name : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                {isExpanded && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
                {item.name === "Ingredients" && lowStockCount > 0 && (
                  <span
                    className={`inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[#D4AC68] px-1.5 text-xs font-bold leading-none text-[#382F2D] ${
                      isExpanded ? "" : "absolute right-0 top-0 -translate-y-1/4 translate-x-1/4"
                    }`}
                    aria-label={`${lowStockCount} low-stock ingredients`}
                    title={`${lowStockCount} low-stock ingredients`}
                  >
                    {lowStockCount > 99 ? "99+" : lowStockCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-[#E9DFDB] p-3">
          <button
            onClick={() => setShowLogoutModal(true)}
            className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#796E6B] transition-colors hover:bg-[#F8EDEA] hover:text-[#A76560] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84] ${
              !isExpanded ? "justify-center" : ""
            }`}
            title={!isExpanded ? "Logout" : undefined}
          >
            <FiLogOut aria-hidden="true" className="h-5 w-5 shrink-0" />
            {isExpanded && <span>Logout</span>}
          </button>

          {isExpanded && <p className="px-2 pt-3 text-center text-xs text-[#A39490]">© 2025 {shopName}</p>}
        </div>
      </aside>

      <div className={`hidden shrink-0 transition-[width] duration-200 lg:block ${isExpanded ? "w-64" : "w-20"}`} aria-hidden="true" />

      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          role="presentation"
          onClick={() => setShowLogoutModal(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E9DFDB] bg-[#FAF6F4] p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="logout-title" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#B91C1C]">
                <FiLogOut aria-hidden="true" className="h-5 w-5" />
              </div>
              <h3 id="logout-title" className="text-xl font-bold text-[#2D2626]">Confirm logout</h3>
            </div>

            <p className="mb-6 text-sm leading-6 text-[#796E6B]">
              Are you sure you want to logout? You will need to sign in again to access your account.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="min-h-12 rounded-xl border border-[#DCCFC9] px-4 text-sm font-semibold text-[#514441] transition-colors hover:bg-[#ECE6E2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A84]"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="min-h-12 rounded-xl bg-[#DC2626] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#B91C1C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5]"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
