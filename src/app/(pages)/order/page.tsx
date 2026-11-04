"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import CustomerOrdering from "@/components/MobileOrder";

export default function OrderPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    Fetch_to(api_links.jwt.verify).then((response) => {
      if (!response.success) {
        router.replace("/?next=%2Forder");
        return;
      }

      const payload = response.data as { message?: { role?: string } } | undefined;
      const role = payload?.message?.role?.trim().toLowerCase();
      if (role !== "admin" && role !== "cashier") {
        router.replace("/");
        return;
      }

      setAuthorized(true);
    }).catch((error) => {
      console.error("Order route role check failed:", error);
      router.replace("/?next=%2Forder");
    });
  }, [router]);

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF6F4] text-[#2D2626]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#C98A84] border-t-transparent" />
          <p className="font-bold text-[#4D413E]">Checking access...</p>
        </div>
      </main>
    );
  }

  return <CustomerOrdering />;
}
