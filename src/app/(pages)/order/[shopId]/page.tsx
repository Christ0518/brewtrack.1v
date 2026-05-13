import { use } from "react";
import CustomerOrdering from "@/components/MobileOrder";

interface Props {
  params: Promise<{
    shopId: string;
  }>;
}

export default function OrderShopPage({ params }: Props) {
  const { shopId } = use(params);
  return <CustomerOrdering defaultShopId={shopId} />;
}
