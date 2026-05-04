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
      info: "border-sky-200 bg-sky-50 text-sky-700",
      success: "border-emerald-200 bg-emerald-50 text-emerald-700",
      error: "border-red-200 bg-red-50 text-red-700",
    }[state.variant];

    const titleStyles = {
      info: "text-slate-900",
      success: "text-emerald-900",
      error: "text-red-900",
    }[state.variant];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className={`border-b px-5 py-4 ${variantStyles}`}>
            <h2 className={`text-lg font-bold ${titleStyles}`}>{state.title}</h2>
          </div>
          <div className="px-5 py-5">
            <p className="text-sm leading-6 text-slate-600">{state.message}</p>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={() => {
                const onClose = state.onClose;
                closeAlert();
                onClose?.();
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
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