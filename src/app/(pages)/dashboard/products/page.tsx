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
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <ProductsPage shopId={shopId} />
        </div>
      </div>
    </div>
  );
}
