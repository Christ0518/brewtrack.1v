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
      accentColor: "#bc9b7a",
      accentHoverColor: "#9b7653",
      accentTextColor: "#ffffff",
      accentSoftColor: "#f3e3cf",
      accentClass: "bg-[#bc9b7a] text-white",
      accentHoverClass: "hover:bg-[#9b7653]",
      accentTextClass: "text-[#8a6245]",
      accentBorderClass: "border-[#bc9b7a]",
      accentRingClass: "focus:border-[#bc9b7a] focus:ring-[#f3e3cf]",
      accentSoftClass: "bg-[#f3e3cf] text-[#754c35]",
      accentSolidClass: "bg-[#bc9b7a] text-white",
      accentMutedTextClass: "text-[#8a6245]",
    };
  }

  return {
    accentColor: "#6c3030",
    accentHoverColor: "#522424",
    accentTextColor: "#ffffff",
    accentSoftColor: "#ead8c5",
    accentClass: "bg-[#6c3030] text-white",
    accentHoverClass: "hover:bg-[#522424]",
    accentTextClass: "text-[#6c3030]",
    accentBorderClass: "border-[#6c3030]",
    accentRingClass: "focus:border-[#6c3030] focus:ring-[#ead8c5]",
    accentSoftClass: "bg-[#ead8c5] text-[#6c3030]",
    accentSolidClass: "bg-[#6c3030] text-white",
    accentMutedTextClass: "text-[#6c3030]",
  };
};
