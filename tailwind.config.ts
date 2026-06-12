import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1A1A17",
        paper: "#F7F3EC",
        parchment: "#EFE8D8",
        void: "#080808",
        surface: "#111110",
        "surface-2": "#1A1A18",
        spruce: {
          DEFAULT: "#0D3B2E",
          light: "#1F5C45",
          dark: "#082822",
          glow: "rgba(13,59,46,0.45)",
        },
        brass: {
          DEFAULT: "#C9A227",
          light: "#E0BE54",
          dark: "#9C7C18",
          glow: "rgba(201,162,39,0.25)",
        },
        clay: "#B5694A",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      backgroundImage: {
        "grain": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        stamp: {
          "0%": { transform: "scale(2.2) rotate(-18deg)", opacity: "0" },
          "60%": { transform: "scale(0.95) rotate(-12deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(-12deg)", opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        stamp: "stamp 0.7s cubic-bezier(.2,1.4,.4,1) forwards",
        "fade-up": "fade-up 0.6s ease-out forwards",
        ticker: "ticker 28s linear infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
