"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [shopName, setShopName] = useState("Shop");
  const [shopColor, setShopColor] = useState("#073dbe");
  const [user, setUser] = useState<{
    first_name?: string;
    last_name?: string;
    role?: string;
  } | null>(null);

  useEffect(() => {
    const storedShop = localStorage.getItem("shopName");
    const storedColor = localStorage.getItem("shopColor");
    const storedUser = localStorage.getItem("user");
    if (storedShop) setShopName(storedShop);
    if (storedColor) setShopColor(storedColor);
    if (storedUser && storedUser !== "undefined") {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Failed to parse user data in sidebar:", error);
      }
    }
  }, []);

  const menuItems = [
    { name: "Dashboard", path: "/dashboard", icon: "📊" },
    { name: "Products", path: "/dashboard/products", icon: "📦" },
    { name: "Ingredients", path: "/dashboard/ingredients", icon: "🗂️" },
    { name: "Reports", path: "/dashboard/reports", icon: "📄" },
    { name: "Transactions", path: "/dashboard/transactions", icon: "💰" },
    { name: "Kitchen Display", path: "/kitchen", icon: "🍳" },
    { name: "Cashier", path: "/cashier", icon: "💳" },
    { name: "Settings", path: "/dashboard/settings", icon: "⚙️" },
  ];

  const handleLogout = async () => {
    try {
      await Fetch_to(api_links.jwt.deauth);
      localStorage.removeItem("shopId");
      localStorage.removeItem("shopName");
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
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } fixed top-0 left-0 h-screen ${
          isOpen ? "w-64" : "w-0 lg:w-20"
        } bg-white border-r border-slate-200 flex flex-col transition-all duration-300 shadow-lg z-50 lg:z-30`}
      >
        {/* Logo Section - Clickable to toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center p-4 border-b border-slate-200 min-h-16 shrink-0 hover:bg-slate-50 transition-colors cursor-pointer"
          aria-label="Toggle sidebar"
        >
          {isOpen ? (
            <div className="text-2xl font-bold" style={{ color: shopColor }}>
              {shopName}
            </div>
          ) : (
            <div className="text-lg font-bold text-center" style={{ color: shopColor }}>
              {shopName?.split(' ').map((w) => w[0]).join('') || 'S'}
            </div>
          )}
        </button>

        {/* User Info (when expanded) */}
        {isOpen && user && (
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: shopColor }}
              >
                {user.first_name?.[0]}{user.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {user.first_name} {user.last_name}
                </div>
                <div className="text-xs text-slate-600 capitalize">{user.role}</div>
              </div>
            </div>
          </div>
        )}

        {/* Menu Items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.name}
                href={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setIsOpen(false);
                  }
                }}
                className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all group relative
                ${
                  isActive
                    ? "text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }
                ${!isOpen ? "justify-center lg:px-3" : ""}`}
                style={isActive ? { backgroundColor: shopColor } : {}}
                title={!isOpen ? item.name : ""}
              >
                <span className={`text-lg shrink-0`}>
                  {item.icon}
                </span>
                {isOpen && (
                  <>
                    <span className="text-sm font-medium flex-1">{item.name}</span>
                    {isActive && (
                      <span className="text-white text-sm">›</span>
                    )}
                  </>
                )}

                {/* Tooltip for collapsed state */}
                {!isOpen && (
                  <div className="absolute left-full ml-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-lg z-50">
                    {item.name}
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45" />
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="shrink-0 border-t border-slate-200">
          {/* Logout Button */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className={`flex items-center gap-3 m-3 p-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all hover:shadow-md group w-[calc(100%-1.5rem)]
            ${!isOpen ? "justify-center" : ""}`}
            title={!isOpen ? "Logout" : ""}
          >
            <span className="text-lg shrink-0">🚪</span>
            {isOpen && <span className="text-sm font-medium">Logout</span>}

            {/* Tooltip for collapsed state */}
            {!isOpen && (
              <div className="absolute left-full ml-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-lg z-50">
                Logout
                <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45" />
              </div>
            )}
          </button>

          {/* Copyright */}
          {isOpen && (
            <div className="px-4 pb-3 text-center">
              <p className="text-xs text-slate-500">© 2025 {shopName}</p>
            </div>
          )}
        </div>
      </aside>

      {/* Spacer for main content */}
      <div
        className={`${
          isOpen ? "w-64" : "w-0 lg:w-20"
        } shrink-0 transition-all duration-300`}
      />

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-lg">
                ⚠️
              </div>
              <h3 className="text-xl font-bold text-slate-900">Confirm Logout</h3>
            </div>

            <p className="text-slate-600 mb-6">
              Are you sure you want to logout? You will need to sign in again to access your account.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
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
