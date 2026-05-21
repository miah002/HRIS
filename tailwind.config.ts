import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Strict container to 1400px for dashboards
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1400px" } },
    extend: {
      // Map CSS vars → Tailwind — opacity modifiers (bg-brand/50) won't work on var() colors,
      // use inline styles for those edge cases.
      colors: {
        brand:    { DEFAULT: "var(--brand)", dim: "var(--brand-dim)", bright: "var(--brand-bright)", subtle: "var(--brand-subtle)" },
        surface:  { DEFAULT: "var(--bg)", subtle: "var(--bg-subtle)", elevated: "var(--bg-elevated)", overlay: "var(--bg-overlay)", inverted: "var(--bg-inverted)" },
        text:     { primary: "var(--text-primary)", secondary: "var(--text-secondary)", tertiary: "var(--text-tertiary)", inverse: "var(--text-inverse)", brand: "var(--text-brand)" },
        line:     { DEFAULT: "var(--border)", strong: "var(--border-strong)", focus: "var(--border-focus)" },
        ok:       { DEFAULT: "var(--success)", bg: "var(--success-bg)", border: "var(--success-border)" },
        warn:     { DEFAULT: "var(--warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
        err:      { DEFAULT: "var(--error)", bg: "var(--error-bg)", border: "var(--error-border)" },
        neutral:  { bg: "var(--neutral-bg)" },
        // shadcn compat aliases
        background: "var(--bg)",
        foreground: "var(--text-primary)",
        border:     "var(--border)",
        input:      "var(--border-strong)",
        ring:       "var(--brand-ring)",
        primary:    { DEFAULT: "var(--brand)", foreground: "#FFFFFF" },
        secondary:  { DEFAULT: "var(--bg-subtle)", foreground: "var(--text-primary)" },
        muted:      { DEFAULT: "var(--bg-subtle)", foreground: "var(--text-secondary)" },
        accent:     { DEFAULT: "var(--brand-subtle)", foreground: "var(--text-brand)" },
        destructive: { DEFAULT: "var(--error)", foreground: "#FFFFFF" },
        card:       { DEFAULT: "var(--bg-elevated)", foreground: "var(--text-primary)" },
        popover:    { DEFAULT: "var(--bg-elevated)", foreground: "var(--text-primary)" },
      },

      fontFamily: {
        sans:    ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        serif:   ["var(--font-instrument-serif)", "Georgia", "serif"],
        mono:    ["var(--font-geist-mono)", "monospace"],
      },

      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        xs:    ["0.8125rem", { lineHeight: "1.125rem" }],
        sm:    ["0.875rem",  { lineHeight: "1.375rem" }],
        base:  ["1rem",      { lineHeight: "1.6rem" }],
        lg:    ["1.125rem",  { lineHeight: "1.75rem" }],
        xl:    ["1.25rem",   { lineHeight: "1.875rem" }],
        "2xl": ["1.75rem",   { lineHeight: "2.125rem" }],
        "3xl": ["2.5rem",    { lineHeight: "2.875rem", letterSpacing: "-0.02em" }],
        "4xl": ["3.5rem",    { lineHeight: "4rem",     letterSpacing: "-0.03em" }],
        "5xl": ["4.5rem",    { lineHeight: "1",         letterSpacing: "-0.04em" }],
      },

      letterSpacing: {
        tightest: "-0.04em",
        tighter:  "-0.02em",
        tight:    "-0.01em",
        normal:   "0",
        wide:     "0.03em",
        wider:    "0.06em",
        widest:   "0.12em",
      },

      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "brand-glow": "0 0 0 3px var(--brand-ring)",
      },

      spacing: { 18: "4.5rem", 22: "5.5rem", 26: "6.5rem", 30: "7.5rem" },

      transitionDuration: {
        fast: "100ms",
        base: "150ms",
        slow: "200ms",
        enter: "250ms",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.175, 0.885, 0.32, 1.1)",
        out:    "cubic-bezier(0.16, 1, 0.3, 1)",
        "in":   "cubic-bezier(0.7, 0, 0.84, 0)",
      },

      animation: {
        "shimmer": "shimmer 1.6s ease-in-out infinite",
        "fade-in": "fade-in 200ms var(--ease-out) both",
        "slide-up": "slide-up 200ms var(--ease-out) both",
        "scale-in": "scale-in 200ms var(--ease-spring) both",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-up": {
          from: { transform: "translateY(4px)", opacity: "0" },
          to:   { transform: "translateY(0)",  opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.97)", opacity: "0" },
          to:   { transform: "scale(1)",    opacity: "1" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
