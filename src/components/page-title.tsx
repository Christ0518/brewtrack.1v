"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import api_links from "@/config/fetch_links/api_links.json";

const getPageTitle = (pathname: string) => {
  if (pathname === "/" || pathname === "/barcelo" || pathname === "/goodcoffee") return "Login";
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/dashboard/products")) return "Products";
  if (pathname.startsWith("/dashboard/ingredients")) return "Ingredients";
  if (pathname === "/dashboard/reports/transactions") return "Cashflow Transactions";
  if (pathname.startsWith("/dashboard/reports")) return "Reports";
  if (pathname.startsWith("/dashboard/transactions/")) return "Transaction Details";
  if (pathname === "/dashboard/transactions") return "Transactions";
  if (pathname.startsWith("/dashboard/settings")) return "Settings";
  if (pathname.startsWith("/dashboard/help")) return "Help";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname === "/cashier/incoming-orders") return "Incoming Orders";
  if (pathname === "/cashier/order-history") return "Order History";
  if (pathname === "/cashier") return "Cashier";
  if (pathname.startsWith("/kitchen")) return "Kitchen";
  if (pathname.startsWith("/order")) return "Mobile Ordering";
  return "BrewTrack";
};

export default function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const updateBranding = async () => {
      const shopName = localStorage.getItem("shopName");
      const shopId = localStorage.getItem("shopId") || "1";
      const title = getPageTitle(pathname);
      document.title = shopName ? `${title} | ${shopName}` : `${title} | BrewTrack`;

      let logo = localStorage.getItem("shopLogo");
      try {
        const response = await fetch(`${api_links.tbl_shops}?id=${shopId}`, { cache: "no-store" });
        if (response.ok) {
          const shop = await response.json();
          if (shop.name) {
            localStorage.setItem("shopName", shop.name);
            document.title = `${title} | ${shop.name}`;
          }
          if (shop.logo_url) {
            logo = shop.logo_url;
            localStorage.setItem("shopLogo", shop.logo_url);
          } else {
            logo = "";
            localStorage.removeItem("shopLogo");
          }
        }
      } catch (error) {
        console.error("Failed to load page branding:", error);
      }

      const existingIcons = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');
      let icon = document.querySelector<HTMLLinkElement>('link[data-brewtrack-favicon="true"]')
        || existingIcons[0];
      if (!icon) {
        icon = document.createElement("link");
        icon.rel = "icon";
        icon.dataset.brewtrackFavicon = "true";
        document.head.appendChild(icon);
      }
      existingIcons.forEach((existingIcon) => {
        existingIcon.href = logo || "/favicon.ico";
      });
      icon.href = logo || "/favicon.ico";
    };

    void updateBranding();
    window.addEventListener("storage", updateBranding);
    window.addEventListener("brewtrack-shop-updated", updateBranding);

    return () => {
      window.removeEventListener("storage", updateBranding);
      window.removeEventListener("brewtrack-shop-updated", updateBranding);
    };
  }, [pathname]);

  return null;
}