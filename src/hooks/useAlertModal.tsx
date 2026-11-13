"use client";

import { useState } from "react";

export type AlertVariant = "info" | "success" | "error";

type AlertOptions = {
  title?: string;
  variant?: AlertVariant;
  buttonText?: string;
  onClose?: () => void;
};

type AlertState = {
  open: boolean;
  title: string;
  message: string;
  variant: AlertVariant;
  buttonText: string;
  onClose?: () => void;
};

const DEFAULT_STATE: AlertState = {
  open: false,
  title: "Notice",
  message: "",
  variant: "info",
  buttonText: "OK",
};

export function useAlertModal() {
  const [state, setState] = useState<AlertState>(DEFAULT_STATE);

  const closeAlert = () => {
    setState(DEFAULT_STATE);
  };

  const showAlert = (message: string, options: AlertOptions = {}) => {
    setState({
      open: true,
      title:
        options.title ??
        (options.variant === "success" ? "Success" : options.variant === "error" ? "Error" : "Notice"),
      message,
      variant: options.variant ?? "info",
      buttonText: options.buttonText ?? "OK",
      onClose: options.onClose,
    });
  };

  const AlertModal = () => {
    if (!state.open) return null;

    const variantStyles = {
      info: "border-[#E9DFDB] bg-[#FAF6F4] text-[#A76560]",
      success: "border-[#E5C7C2] bg-[#F8EDEA] text-[#A76560]",
      error: "border-red-200 bg-red-50 text-red-700",
    }[state.variant];

    const titleStyles = {
      info: "text-[#2D2626]",
      success: "text-[#2D2626]",
      error: "text-red-900",
    }[state.variant];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2626]/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-[#E9DFDB] bg-white shadow-2xl">
          <div className={`border-b px-5 py-4 ${variantStyles}`}>
            <h2 className={`text-lg font-bold ${titleStyles}`}>{state.title}</h2>
          </div>
          <div className="px-5 py-5">
            <p className="text-sm leading-6 text-[#796E6B]">{state.message}</p>
          </div>
          <div className="flex justify-end gap-3 border-t border-[#F0E9E6] px-5 py-4">
            <button
              type="button"
              onClick={() => {
                const onClose = state.onClose;
                closeAlert();
                onClose?.();
              }}
              className="min-h-12 rounded-xl bg-[#C98A84] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#B97872]"
            >
              {state.buttonText}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return { showAlert, closeAlert, AlertModal };
}