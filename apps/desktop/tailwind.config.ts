import type { Config } from "tailwindcss";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "var(--bg-app)",
          surface: "var(--surface-primary)",
          elevated: "var(--surface-elevated)",
          hover: "var(--surface-hover)",
          active: "var(--surface-active)",
        },
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          disabled: "var(--text-disabled)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          contrast: "var(--accent-contrast)",
          hover: "var(--accent-hover)",
          active: "var(--accent-active)",
          subtle: "var(--accent-subtle)",
          border: "var(--accent-border)",
        },
        success: {
          DEFAULT: "var(--success)",
          bg: "var(--success-bg)",
          border: "var(--success-border)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          bg: "var(--warning-bg)",
          border: "var(--warning-border)",
        },
        error: {
          DEFAULT: "var(--error)",
          bg: "var(--error-bg)",
          border: "var(--error-border)",
        },
      },
      fontFamily: {
        sans: ["'Geist'", "'Inter'", "'Segoe UI'", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["'Geist'", "'Inter'", "'Segoe UI'", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["'Geist Mono'", "'Cascadia Code'", "'Fira Code'", "monospace"],
      },
      fontSize: {
        title: ["24px", { lineHeight: "1.2", fontWeight: "600" }],
        heading: ["20px", { lineHeight: "1.25", fontWeight: "600" }],
        section: ["15px", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        secondary: ["13px", { lineHeight: "1.4", fontWeight: "400" }],
        metadata: ["12px", { lineHeight: "1.4", fontWeight: "400" }],
        label: ["11px", { lineHeight: "1.4", letterSpacing: "0.02em", fontWeight: "500" }],
        shortcut: ["13px", { lineHeight: "1.4", fontWeight: "500" }],
        technical: ["12px", { lineHeight: "1.4", fontWeight: "400" }],
      },
      borderRadius: {
        control: "6px",
        btn: "7px",
        input: "7px",
        card: "8px",
        container: "10px",
        pill: "999px",
        DEFAULT: "7px",
      },
      boxShadow: {
        subtle: "var(--shadow-subtle)",
        none: "none",
      },
      animation: {
        fadeIn: "fadeIn 0.2s ease-in-out forwards",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
