export type ShopTheme = {
  accentColor: string;
  accentHoverColor: string;
  accentTextColor: string;
  accentSoftColor: string;
  accentClass: string;
  accentHoverClass: string;
  accentTextClass: string;
  accentBorderClass: string;
  accentRingClass: string;
  accentSoftClass: string;
  accentSolidClass: string;
  accentMutedTextClass: string;
};

export const getShopTheme = (shopId?: string): ShopTheme => {
  const isShopTwo = String(shopId) === "2";

  if (isShopTwo) {
    return {
      accentColor: "#fec107",
      accentHoverColor: "#e3ad06",
      accentTextColor: "#0f172a",
      accentSoftColor: "#fff3bf",
      accentClass: "bg-[#fec107] text-slate-900",
      accentHoverClass: "hover:bg-[#e3ad06]",
      accentTextClass: "text-[#fec107]",
      accentBorderClass: "border-[#fec107]",
      accentRingClass: "focus:border-[#fec107] focus:ring-yellow-100",
      accentSoftClass: "bg-[#fff3bf] text-[#8a6700]",
      accentSolidClass: "bg-[#fec107] text-slate-900",
      accentMutedTextClass: "text-[#b98900]",
    };
  }

  return {
    accentColor: "#073dbe",
    accentHoverColor: "#052d99",
    accentTextColor: "#ffffff",
    accentSoftColor: "#dbeafe",
    accentClass: "bg-blue-700 text-white",
    accentHoverClass: "hover:bg-blue-800",
    accentTextClass: "text-blue-700",
    accentBorderClass: "border-blue-700",
    accentRingClass: "focus:border-blue-700 focus:ring-blue-100",
    accentSoftClass: "bg-blue-50 text-blue-700",
    accentSolidClass: "bg-blue-700 text-white",
    accentMutedTextClass: "text-blue-700",
  };
};
