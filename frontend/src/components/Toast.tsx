"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ToastItem as ShadcnToastItem, ToastViewport, ToastProvider as ShadcnToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

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
    <ShadcnToastItem
      key={item.id}
      className={cn("flex w-full items-start gap-3", item.variant === "error" ? "border-icta-red/50" : "")}
    >
      <Icon className={`mt-0.5 size-4.5 shrink-0 ${ICON_CLASSES[item.variant]}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-icta-gray-900">{item.title}</p>
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
        className="shrink-0 rounded-md p-1 text-icta-gray-600 transition-colors hover:bg-icta-gray-50 hover:text-icta-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </ShadcnToastItem>
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
    <ShadcnToastProvider>
      <ToastContext.Provider value={{ toast }}>
        {children}
        <ToastViewport />
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
    </ShadcnToastProvider>
  );
}
