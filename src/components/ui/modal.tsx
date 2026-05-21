"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

// Modal: backdrop blur + scale-in from 0.96 → 1.0 (Framer Motion).
// On mobile, slides up from bottom (sheet behavior).

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const modalWidths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };

export function Modal({ open, onClose, title, description, children, size = "md" }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Backdrop */}
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </Dialog.Overlay>

            {/* Content — centered on md+, sheet on mobile */}
            <Dialog.Content asChild>
              <motion.div
                className={cn(
                  "fixed z-50 bg-[var(--bg-elevated)] shadow-xl",
                  "focus:outline-none",
                  // Desktop: centered dialog
                  "md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
                  "md:rounded-[var(--radius-lg)] md:p-6 md:w-full",
                  modalWidths[size],
                  // Mobile: bottom sheet
                  "left-0 right-0 bottom-0 rounded-t-[var(--radius-xl)] p-5",
                  "md:left-auto md:right-auto md:bottom-auto md:rounded-[var(--radius-lg)]"
                )}
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 4 }}
                transition={{ duration: 0.2, ease: [0.175, 0.885, 0.32, 1.1] }}
              >
                {(title || description) && (
                  <div className="mb-5">
                    {title && (
                      <Dialog.Title className="text-base font-semibold text-[var(--text-primary)]">
                        {title}
                      </Dialog.Title>
                    )}
                    {description && (
                      <Dialog.Description className="mt-1 text-sm text-[var(--text-secondary)]">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                )}

                {children}

                <Dialog.Close
                  onClick={onClose}
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--neutral-bg)] hover:text-[var(--text-primary)] transition-colors duration-fast"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Dialog.Close>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
