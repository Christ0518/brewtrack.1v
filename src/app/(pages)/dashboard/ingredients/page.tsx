"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import { IngredientsPage } from "@/components/ingredients";

export default function IngredientsRoute() {
  const [shopId, setShopId] = useState(() => {
    if (typeof window === "undefined") return "1";
    return localStorage.getItem("shopId") || "1";
  });

  useEffect(() => {
    const storedShopId = localStorage.getItem("shopId");
    if (storedShopId) setShopId(storedShopId);
  }, []);

  return (
    <div className="flex h-screen bg-[#f8f1e8]">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <IngredientsPage shopId={shopId} />
      </div>
    </div>
  );
}
