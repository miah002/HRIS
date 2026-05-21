// Shared Framer Motion transition presets.
// All durations are intentionally short — premium software feels snappy.

export const spring = { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.8 };
export const springBounce = { type: "spring" as const, stiffness: 500, damping: 25, mass: 0.6 };

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
};

export const slideUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: 3 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 0.98 },
  transition: { duration: 0.2, ease: [0.175, 0.885, 0.32, 1.1] },
};

export const slideInFromBottom = {
  initial: { opacity: 0, y: "100%" },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: "100%" },
  transition: { type: "spring" as const, stiffness: 500, damping: 40 },
};

// Stagger list items: use as container variants
export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.05 } },
};
export const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
};
