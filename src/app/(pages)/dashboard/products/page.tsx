"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import ProductsPage from "@/components/products/page";

export default function ProductsRoute() {
  const [shopId, setShopId] = useState(() => {
    if (typeof window === "undefined") return "1";
    return localStorage.getItem("shopId") || "1";
  });

  useEffect(() => {
    const storedShopId = localStorage.getItem("shopId");
    if (storedShopId) setShopId(storedShopId);
  }, []);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#FAF6F4]">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <div>
          <ProductsPage shopId={shopId} />
        </div>
      </div>
    </div>
  );
}
