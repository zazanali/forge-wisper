import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        forge: {
          bg: "#0E0E0E",
          surface: "#1C1B1B",
          hover: "#2A2A2A",
          accent: "#FFB595",
          strong: "#CA5924",
          text: "#E5E2E1",
          muted: "#78716C",
          "dark-accent": "#4C1A00",
          border: "rgba(229, 226, 225, 0.08)",
          "border-focus": "rgba(255, 181, 149, 0.4)",
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#EF4444",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["'Inter'", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        surface: "16px",
      },
      boxShadow: {
        forge: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glow: "0 0 20px rgba(255, 181, 149, 0.15)",
        "glow-strong": "0 0 25px rgba(202, 89, 36, 0.25)",
      },
      animation: {
        pulse_subtle: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        wave: "wave 1.2s ease-in-out infinite",
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1.0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
