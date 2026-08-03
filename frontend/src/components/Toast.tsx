"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ToastVariant = "success" | "info" | "error";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ICONS: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle2,
  info: Info,
  error: AlertCircle,
};

const ICON_CLASSES: Record<ToastVariant, string> = {
  success: "text-icta-green",
  info: "text-icta-link",
  error: "text-icta-red",
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = ICONS[item.variant];
  return (
    <div
      className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-icta-gray-200 bg-white p-3.5 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)]"
      role={item.variant === "error" ? "alert" : "status"}
    >
      <Icon className={`mt-0.5 size-4.5 shrink-0 ${ICON_CLASSES[item.variant]}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-icta-black">{item.title}</p>
        {item.description ? (
          <p className="mt-0.5 text-sm leading-relaxed text-icta-gray-600">
            {item.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-md p-1 text-icta-gray-600 transition-colors hover:bg-icta-gray-50 hover:text-icta-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "success", duration = 4000 }: ToastOptions) => {
      const id = nextId.current++;
      setToasts((items) => [...items.slice(-3), { id, title, description, variant }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2.5"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
