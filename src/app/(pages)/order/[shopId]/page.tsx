"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import CustomerOrdering from "@/components/MobileOrder";

interface Props {
  params: Promise<{
    shopId: string;
  }>;
}

export default function OrderShopPage({ params }: Props) {
  const { shopId } = use(params);
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    Fetch_to(api_links.jwt.verify).then((response) => {
      if (!response.success) {
        router.replace(`/?next=${encodeURIComponent(`/order/${shopId}`)}`);
        return;
      }

      const payload = response.data as { message?: { role?: string } } | undefined;
      const role = payload?.message?.role?.trim().toLowerCase();
      if (role === "admin" || role === "cashier") {
        setAuthorized(true);
      } else {
        router.replace("/");
      }
    }).catch((error) => {
      console.error("Order route authorization failed:", error);
      router.replace(`/?next=${encodeURIComponent(`/order/${shopId}`)}`);
    });
  }, [router, shopId]);

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

  return <CustomerOrdering defaultShopId={shopId} />;
}
