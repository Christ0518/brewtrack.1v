"use client";

import { useEffect } from "react";

export default function DisableNumberScroll() {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const numberInput =
        target instanceof HTMLInputElement && target.type === "number"
          ? target
          : (target.closest("input[type='number']") as HTMLInputElement | null);

      if (!numberInput) return;
      if (document.activeElement !== numberInput) return;

      event.preventDefault();
      numberInput.blur();
    };

    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });

    return () => {
      window.removeEventListener("wheel", handleWheel, true);
    };
  }, []);

  return null;
}
