"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import { IngredientsPage } from "@/components/ingredients";

export default function IngredientsRoute() {
  const [shopId, setShopId] = useState("1");

  useEffect(() => {
    const storedShopId = localStorage.getItem("shopId");
    if (storedShopId) setShopId(storedShopId);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <IngredientsPage shopId={shopId} />
        </div>
      </div>
    </div>
  );
}
