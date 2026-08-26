"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const getPageTitle = (pathname: string) => {
  if (pathname === "/" || pathname === "/barcelo" || pathname === "/goodcoffee") return "Login";
  if (pathname.startsWith("/dashboard/products")) return "Products";
  if (pathname.startsWith("/dashboard/ingredients")) return "Ingredients";
  if (pathname.startsWith("/dashboard/reports")) return "Reports";
  if (pathname.startsWith("/dashboard/transactions")) return "Transactions";
  if (pathname.startsWith("/dashboard/settings")) return "Settings";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/cashier/incoming-orders")) return "Incoming Orders";
  if (pathname.startsWith("/cashier/order-history")) return "Order History";
  if (pathname.startsWith("/cashier")) return "Cashier";
  if (pathname.startsWith("/kitchen")) return "Kitchen";
  if (pathname.startsWith("/order")) return "Mobile Ordering";
  return "BrewTrack";
};

export default function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const shopName = localStorage.getItem("shopName");
    const title = getPageTitle(pathname);
    document.title = shopName ? `${title} | ${shopName}` : `${title} | BrewTrack`;

    const logo = localStorage.getItem("shopLogo");
    if (!logo) return;

    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = logo;
  }, [pathname]);

  return null;
}