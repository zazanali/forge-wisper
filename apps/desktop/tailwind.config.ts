import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        blade: {
          DEFAULT: "#FF4D5E",
          hover: "#E8404F",
          soft: "rgba(255, 77, 94, 0.12)",
          glow: "rgba(255, 77, 94, 0.25)",
        },
        teal: {
          DEFAULT: "#3FE3C4",
          hover: "#2DC9AD",
          soft: "rgba(63, 227, 196, 0.10)",
        },
        forge: {
          bg: "#0C0E14",
          panel: "#151820",
          surface: "#151820",
          raised: "#1C2028",
          "raised-hover": "#252A34",
          hover: "#252A34",
          border: "#2A2E38",
          "border-soft": "#222630",
          "border-focus": "rgba(255, 77, 94, 0.4)",
          accent: "#FF4D5E",
          strong: "#FF4D5E",
          blade: "#FF4D5E",
          teal: "#3FE3C4",
          text: "#E8ECF2",
          "text-2": "#9BA3B5",
          muted: "#5C6478",
          success: "#3FE3C4",
          warning: "#FBBF24",
          error: "#FF4D5E",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Cascadia Code'", "monospace"],
      },
      borderRadius: {
        xs: "6px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        surface: "16px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.25)",
        md: "0 4px 16px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.15)",
        lg: "0 16px 48px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.2)",
        glow: "0 0 20px rgba(255, 77, 94, 0.25)",
        "glow-blade": "0 0 25px rgba(255, 77, 94, 0.35)",
        "glow-teal": "0 0 20px rgba(63, 227, 196, 0.25)",
      },
      animation: {
        pulse_subtle: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        wave: "wave 1.2s ease-in-out infinite",
        fadeIn: "fadeIn 0.3s ease-in-out forwards",
        fadeUp: "fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1.0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
