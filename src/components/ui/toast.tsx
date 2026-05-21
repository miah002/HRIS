"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/format";
import { slideInFromBottom } from "@/lib/motion";

export type ToastVariant = "success" | "warning" | "error" | "info";

interface ToastData {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
}

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-[var(--success)]" />,
  warning: <AlertCircle className="h-4 w-4 text-[var(--warning)]" />,
  error:   <XCircle className="h-4 w-4 text-[var(--error)]" />,
  info:    <Info className="h-4 w-4 text-[var(--brand)]" />,
};

// Minimal context — for a real app swap with a library like sonner
const ToastCtx = React.createContext<(t: Omit<ToastData, "id">) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const addToast = React.useCallback((t: Omit<ToastData, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={addToast}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 md:bottom-6 md:right-6 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] left-4 right-4 md:left-auto md:w-80"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role="alert"
              className={cn(
                "flex items-start gap-3 rounded-[var(--radius-md)] border p-4",
                "bg-[var(--bg-elevated)] shadow-lg",
                "border-[var(--border)]"
              )}
              {...slideInFromBottom}
            >
              <span className="flex-shrink-0 mt-0.5">{icons[t.variant]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{t.message}</p>}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastCtx);
}
