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
    <div className="flex min-h-screen overflow-x-hidden bg-[#FAF6F4]">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <IngredientsPage shopId={shopId} />
      </div>
    </div>
  );
}
